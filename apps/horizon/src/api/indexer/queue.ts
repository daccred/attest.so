import { EventEmitter } from 'events';
import { fetchAndStoreEvents } from './ledger';

export type IngestJobType = 'fetch-events';

export interface IngestJob {
  id: string;
  type: IngestJobType;
  payload: {
    startLedger?: number;
  };
  attempts: number;
  maxAttempts: number;
  nextRunAt: number;
}

class IngestQueue extends EventEmitter {
  private pendingJobs: IngestJob[] = [];
  private isRunning = false;
  private processing = false;
  private intervalHandle: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs: number;
  private readonly baseBackoffMs: number;

  constructor(options?: { pollIntervalMs?: number; baseBackoffMs?: number }) {
    super();
    this.pollIntervalMs = options?.pollIntervalMs ?? 1000;
    this.baseBackoffMs = options?.baseBackoffMs ?? 5000;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalHandle = setInterval(() => this.tick(), this.pollIntervalMs);
    this.emit('started');
  }

  stop() {
    this.isRunning = false;
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    this.intervalHandle = null;
    this.emit('stopped');
  }

  enqueueFetchEvents(startLedger?: number, opts?: { maxAttempts?: number; delayMs?: number }) {
    const job: IngestJob = {
      id: `fetch-events-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'fetch-events',
      payload: { startLedger },
      attempts: 0,
      maxAttempts: opts?.maxAttempts ?? 5,
      nextRunAt: Date.now() + (opts?.delayMs ?? 0)
    };
    this.pendingJobs.push(job);
    this.emit('enqueued', job);
    return job.id;
  }

  getStatus() {
    return {
      size: this.pendingJobs.length,
      running: this.isRunning,
      nextJobs: this.pendingJobs
        .slice(0, 10)
        .map(j => ({ id: j.id, type: j.type, nextRunInMs: Math.max(0, j.nextRunAt - Date.now()), attempts: j.attempts }))
    };
  }

  private async tick() {
    if (this.processing) return;
    const now = Date.now();
    const idx = this.pendingJobs.findIndex(j => j.nextRunAt <= now);
    if (idx === -1) return;

    const job = this.pendingJobs.splice(idx, 1)[0];
    this.processing = true;
    this.emit('started:job', job);

    try {
      if (job.type === 'fetch-events') {
        const result = await fetchAndStoreEvents(job.payload.startLedger);
        this.emit('completed:job', { job, result });

        // If no events fetched, schedule a retry with backoff (events may land later on Horizon)
        if (result.eventsFetched === 0 && job.attempts + 1 < job.maxAttempts) {
          const backoff = this.computeBackoffMs(job.attempts);
          const retryJob: IngestJob = {
            ...job,
            attempts: job.attempts + 1,
            nextRunAt: Date.now() + backoff
          };
          this.pendingJobs.push(retryJob);
          this.emit('requeued:job', { job: retryJob, backoffMs: backoff });
        }
      }
    } catch (error: any) {
      job.attempts += 1;
      this.emit('failed:job', { job, error: error?.message || String(error) });
      if (job.attempts < job.maxAttempts) {
        const backoff = this.computeBackoffMs(job.attempts - 1);
        job.nextRunAt = Date.now() + backoff;
        this.pendingJobs.push(job);
        this.emit('requeued:job', { job, backoffMs: backoff });
      } else {
        this.emit('dead:job', job);
      }
    } finally {
      this.processing = false;
    }
  }

  private computeBackoffMs(attemptIndexZeroBased: number) {
    // exponential backoff with jitter: base * 2^n +/- 20%
    const factor = Math.pow(2, attemptIndexZeroBased);
    const base = this.baseBackoffMs * factor;
    const jitter = base * (Math.random() * 0.4 - 0.2);
    return Math.max(this.baseBackoffMs, Math.floor(base + jitter));
  }
}

export const ingestQueue = new IngestQueue(); 