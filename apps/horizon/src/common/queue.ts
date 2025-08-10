import { EventEmitter } from 'events'
import { fetchAndStoreEvents } from '../repository/events.repository'
import {
  fetchContractOperations,
  fetchContractComprehensiveData,
} from '../repository/contracts.repository'
import { queueLogger } from './logger'

export type IngestJobType =
  | 'fetch-events'
  | 'fetch-contract-operations'
  | 'fetch-comprehensive-data'
  | 'backfill-missing-operations'

export interface IngestJob {
  id: string
  type: IngestJobType
  payload: {
    startLedger?: number
    contractIds?: string[]
    includeFailedTx?: boolean
    operationType?: string
  }
  attempts: number
  maxAttempts: number
  nextRunAt: number
}

class IngestQueue extends EventEmitter {
  private pendingJobs: IngestJob[] = []
  private isRunning = false
  private processing = false
  private intervalHandle: NodeJS.Timeout | null = null
  private readonly pollIntervalMs: number
  private readonly baseBackoffMs: number

  constructor(options?: { pollIntervalMs?: number; baseBackoffMs?: number }) {
    super()
    this.pollIntervalMs = options?.pollIntervalMs ?? 1000
    this.baseBackoffMs = options?.baseBackoffMs ?? 5000
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.intervalHandle = setInterval(() => this.tick(), this.pollIntervalMs)
    this.emit('started')
    queueLogger.info('queue started', {
      pollIntervalMs: this.pollIntervalMs,
      baseBackoffMs: this.baseBackoffMs,
    })
  }

  stop() {
    this.isRunning = false
    if (this.intervalHandle) clearInterval(this.intervalHandle)
    this.intervalHandle = null
    this.emit('stopped')
    queueLogger.info('queue stopped')
  }

  enqueueFetchEvents(startLedger?: number, opts?: { maxAttempts?: number; delayMs?: number }) {
    const job: IngestJob = {
      id: `fetch-events-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'fetch-events',
      payload: { startLedger },
      attempts: 0,
      maxAttempts: opts?.maxAttempts ?? 5,
      nextRunAt: Date.now() + (opts?.delayMs ?? 0),
    }
    this.pendingJobs.push(job)
    this.emit('enqueued', job)
    queueLogger.info('job enqueued', {
      id: job.id,
      type: job.type,
      payload: job.payload,
      nextRunAt: job.nextRunAt,
    })
    return job.id
  }

  enqueueContractOperations(
    contractIds: string[],
    startLedger?: number,
    opts?: { maxAttempts?: number; delayMs?: number; includeFailedTx?: boolean }
  ) {
    const job: IngestJob = {
      id: `contract-ops-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'fetch-contract-operations',
      payload: { startLedger, contractIds, includeFailedTx: opts?.includeFailedTx ?? true },
      attempts: 0,
      maxAttempts: opts?.maxAttempts ?? 5,
      nextRunAt: Date.now() + (opts?.delayMs ?? 0),
    }
    this.pendingJobs.push(job)
    this.emit('enqueued', job)
    queueLogger.info('job enqueued', {
      id: job.id,
      type: job.type,
      payload: job.payload,
      nextRunAt: job.nextRunAt,
    })
    return job.id
  }

  enqueueComprehensiveData(
    contractIds: string[],
    startLedger?: number,
    opts?: { maxAttempts?: number; delayMs?: number }
  ) {
    const job: IngestJob = {
      id: `comprehensive-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'fetch-comprehensive-data',
      payload: { startLedger, contractIds },
      attempts: 0,
      maxAttempts: opts?.maxAttempts ?? 3,
      nextRunAt: Date.now() + (opts?.delayMs ?? 0),
    }
    this.pendingJobs.push(job)
    this.emit('enqueued', job)
    queueLogger.info('job enqueued', {
      id: job.id,
      type: job.type,
      payload: job.payload,
      nextRunAt: job.nextRunAt,
    })
    return job.id
  }

  getStatus() {
    return {
      size: this.pendingJobs.length,
      running: this.isRunning,
      nextJobs: this.pendingJobs.slice(0, 10).map((j) => ({
        id: j.id,
        type: j.type,
        nextRunInMs: Math.max(0, j.nextRunAt - Date.now()),
        attempts: j.attempts,
      })),
    }
  }

  private async tick() {
    if (this.processing) return
    const now = Date.now()
    const idx = this.pendingJobs.findIndex((j) => j.nextRunAt <= now)
    if (idx === -1) return

    const job = this.pendingJobs.splice(idx, 1)[0]
    this.processing = true
    this.emit('started:job', job)
    queueLogger.info('job started', {
      id: job.id,
      type: job.type,
      attempts: job.attempts,
      payload: job.payload,
    })

    try {
      let result: any

      if (job.type === 'fetch-events') {
        queueLogger.debug('fetchAndStoreEvents request', { id: job.id, payload: job.payload })
        result = await fetchAndStoreEvents(job.payload.startLedger)
        queueLogger.info('fetchAndStoreEvents result', { id: job.id, result })

        // If no events fetched, schedule a retry with backoff (events may land later on Horizon)
        if (result.eventsFetched === 0 && job.attempts + 1 < job.maxAttempts) {
          const backoff = this.computeBackoffMs(job.attempts)
          const retryJob: IngestJob = {
            ...job,
            attempts: job.attempts + 1,
            nextRunAt: Date.now() + backoff,
          }
          this.pendingJobs.push(retryJob)
          this.emit('requeued:job', { job: retryJob, backoffMs: backoff })
          queueLogger.info('job requeued', {
            id: retryJob.id,
            attempts: retryJob.attempts,
            backoffMs: backoff,
          })
        }
      } else if (job.type === 'fetch-contract-operations') {
        queueLogger.debug('fetchContractOperations request', { id: job.id, payload: job.payload })
        result = await fetchContractOperations(
          job.payload.contractIds || [],
          job.payload.startLedger,
          job.payload.includeFailedTx
        )
        queueLogger.info('fetchContractOperations result', { id: job.id, result })
      } else if (job.type === 'fetch-comprehensive-data') {
        queueLogger.debug('fetchContractComprehensiveData request', {
          id: job.id,
          payload: job.payload,
        })
        result = await fetchContractComprehensiveData(
          job.payload.startLedger,
          job.payload.contractIds || []
        )
        queueLogger.info('fetchContractComprehensiveData result', { id: job.id, result })
      }

      this.emit('completed:job', { job, result })
    } catch (error: any) {
      job.attempts += 1
      this.emit('failed:job', { job, error: error?.message || String(error) })
      queueLogger.error('job failed', {
        id: job.id,
        error: error?.message || String(error),
        attempts: job.attempts,
      })
      if (job.attempts < job.maxAttempts) {
        const backoff = this.computeBackoffMs(job.attempts - 1)
        job.nextRunAt = Date.now() + backoff
        this.pendingJobs.push(job)
        this.emit('requeued:job', { job, backoffMs: backoff })
        queueLogger.info('job requeued after failure', {
          id: job.id,
          attempts: job.attempts,
          backoffMs: backoff,
        })
      } else {
        this.emit('dead:job', job)
        queueLogger.warn('job dead', { id: job.id, attempts: job.attempts })
      }
    } finally {
      this.processing = false
    }
  }

  private computeBackoffMs(attemptIndexZeroBased: number) {
    // exponential backoff with jitter: base * 2^n +/- 20%
    const factor = Math.pow(2, attemptIndexZeroBased)
    const base = this.baseBackoffMs * factor
    const jitter = base * (Math.random() * 0.4 - 0.2)
    return Math.max(this.baseBackoffMs, Math.floor(base + jitter))
  }
}

export const ingestQueue = new IngestQueue()
