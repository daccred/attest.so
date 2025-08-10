/**
 * Asynchronous job queue system for managing blockchain data ingestion tasks.
 * 
 * Implements an in-memory priority queue with automatic retry logic, exponential
 * backoff, and event-driven architecture for processing various blockchain data
 * ingestion jobs. Supports multiple job types including event fetching, contract
 * operations, and comprehensive data collection.
 * 
 * @module common/queue
 * @requires events
 * @fires IngestQueue#started - When queue processing begins
 * @fires IngestQueue#stopped - When queue processing stops
 * @fires IngestQueue#enqueued - When a new job is added
 * @fires IngestQueue#started:job - When job processing begins
 * @fires IngestQueue#completed:job - When job completes successfully
 * @fires IngestQueue#failed:job - When job execution fails
 * @fires IngestQueue#requeued:job - When job is retried with backoff
 * @fires IngestQueue#dead:job - When job exceeds max attempts
 */

import { EventEmitter } from 'events'
import { fetchAndStoreEvents } from '../repository/events.repository'
import {
  fetchContractOperations,
  fetchContractComprehensiveData,
} from '../repository/contracts.repository'
import { queueLogger } from './logger'

/**
 * Type definition for supported ingestion job types.
 * 
 * Defines the various types of blockchain data ingestion jobs that can be
 * processed by the queue system, each with specific data collection strategies.
 */
export type IngestJobType =
  | 'fetch-events'
  | 'fetch-contract-operations'
  | 'fetch-comprehensive-data'
  | 'backfill-missing-operations'

/**
 * Interface defining the structure of ingestion jobs.
 * 
 * Represents a queued ingestion task with retry logic, payload data,
 * and scheduling information for processing blockchain data.
 */
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

/**
 * Main ingestion queue class for managing asynchronous blockchain data fetching.
 * 
 * Provides a fault-tolerant job processing system with configurable polling intervals,
 * exponential backoff for failed jobs, and comprehensive event emission for monitoring.
 * Jobs are processed sequentially to prevent overwhelming the blockchain RPC endpoints.
 * 
 * @class IngestQueue
 * @extends EventEmitter
 * @param {Object} [options] - Queue configuration options
 * @param {number} [options.pollIntervalMs=1000] - Milliseconds between queue polls
 * @param {number} [options.baseBackoffMs=5000] - Base milliseconds for exponential backoff
 */
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

  /**
   * Starts the queue processing with periodic job polling.
   * 
   * Initiates the queue's main processing loop using setInterval to check
   * for ready jobs. Emits 'started' event for monitoring purposes.
   * 
   * @method start
   * @returns {void}
   */
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

  /**
   * Stops the queue processing and clears the polling interval.
   * 
   * Gracefully shuts down the queue processing loop and emits 'stopped'
   * event. Jobs already in progress will complete, but no new jobs will start.
   * 
   * @method stop
   * @returns {void}
   */
  stop() {
    this.isRunning = false
    if (this.intervalHandle) clearInterval(this.intervalHandle)
    this.intervalHandle = null
    this.emit('stopped')
    queueLogger.info('queue stopped')
  }

  /**
   * Enqueues a job to fetch and store contract events from the blockchain.
   * 
   * Creates a fetch-events job that will retrieve contract events starting from the
   * specified ledger. Jobs are retried with exponential backoff if no events are
   * found, as events may appear on Horizon with some delay.
   * 
   * @method enqueueFetchEvents
   * @param {number} [startLedger] - Starting ledger sequence number to fetch from
   * @param {Object} [opts] - Job configuration options
   * @param {number} [opts.maxAttempts=5] - Maximum retry attempts before marking as dead
   * @param {number} [opts.delayMs=0] - Initial delay before first execution in milliseconds
   * @returns {string} Unique job ID for tracking
   */
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

  /**
   * Enqueues a job to fetch contract operations from the blockchain.
   * 
   * Creates a contract operations job that retrieves operations for specified
   * contracts with optional failed transaction inclusion. Supports custom
   * starting ledger and retry configuration.
   * 
   * @method enqueueContractOperations
   * @param {string[]} contractIds - Target contract IDs to fetch operations for
   * @param {number} [startLedger] - Starting ledger sequence number
   * @param {Object} [opts] - Job configuration options
   * @param {number} [opts.maxAttempts=5] - Maximum retry attempts
   * @param {number} [opts.delayMs=0] - Initial execution delay
   * @param {boolean} [opts.includeFailedTx=true] - Include failed transactions
   * @returns {string} Unique job ID for tracking
   */
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

  /**
   * Enqueues a job for comprehensive contract data collection.
   * 
   * Creates a comprehensive data job that fetches events, operations, and
   * transactions for specified contracts. Provides complete synchronization
   * with configurable retry behavior.
   * 
   * @method enqueueComprehensiveData
   * @param {string[]} contractIds - Target contract IDs for data collection
   * @param {number} [startLedger] - Starting ledger sequence number
   * @param {Object} [opts] - Job configuration options
   * @param {number} [opts.maxAttempts=3] - Maximum retry attempts
   * @param {number} [opts.delayMs=0] - Initial execution delay
   * @returns {string} Unique job ID for tracking
   */
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

  /**
   * Retrieves the current status and state of the ingestion queue.
   * 
   * Provides a snapshot of queue health including pending job count, running state,
   * and details of upcoming jobs. Useful for monitoring and debugging queue behavior.
   * 
   * @method getStatus
   * @returns {Object} Queue status information
   * @returns {number} status.size - Number of pending jobs in queue
   * @returns {boolean} status.running - Whether queue is actively processing
   * @returns {Array} status.nextJobs - Array of up to 10 upcoming jobs with details
   */
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

  /**
   * Internal method for processing ready jobs from the queue.
   * 
   * Executes the next ready job based on scheduling time, handles job processing,
   * implements retry logic with exponential backoff, and manages job lifecycle
   * events. Called periodically by the queue's polling mechanism.
   * 
   * @private
   * @async
   * @method tick
   * @returns {Promise<void>} Completes when job processing cycle is done
   */
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

  /**
   * Computes exponential backoff delay with jitter for job retries.
   * 
   * Calculates retry delay using exponential backoff algorithm with random
   * jitter to prevent thundering herd problems. Ensures minimum delay based
   * on configured base backoff time.
   * 
   * @private
   * @method computeBackoffMs
   * @param {number} attemptIndexZeroBased - Zero-based attempt number for backoff calculation
   * @returns {number} Backoff delay in milliseconds
   */
  private computeBackoffMs(attemptIndexZeroBased: number) {
    // exponential backoff with jitter: base * 2^n +/- 20%
    const factor = Math.pow(2, attemptIndexZeroBased)
    const base = this.baseBackoffMs * factor
    const jitter = base * (Math.random() * 0.4 - 0.2)
    return Math.max(this.baseBackoffMs, Math.floor(base + jitter))
  }
}

/**
 * Singleton instance of the ingestion queue.
 * 
 * Pre-configured queue instance with default settings for immediate use
 * throughout the application. Provides centralized job processing for
 * blockchain data ingestion tasks.
 * 
 * @constant {IngestQueue} ingestQueue
 */
export const ingestQueue = new IngestQueue()
