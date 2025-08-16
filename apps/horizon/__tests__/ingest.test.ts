import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';

vi.mock('../src/common/queue', () => ({
  ingestQueue: {
    enqueueFetchEvents: vi.fn().mockReturnValue('job-123'),
    enqueueComprehensiveData: vi.fn().mockReturnValue('job-456'),
    enqueueContractOperations: vi.fn().mockReturnValue('job-789'),
    getStatus: vi.fn().mockReturnValue({ size: 0, running: false, nextJobs: [] }),
  },
}));

vi.mock('../src/common/db', () => ({
  getLastProcessedLedgerFromDB: vi.fn().mockResolvedValue(10),
  getDB: vi.fn().mockResolvedValue({ $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]) }),
}));

vi.mock('../src/common/prisma', () => ({
  connectToPostgreSQL: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/repository/rpc.repository', () => ({
  getRpcHealth: vi.fn().mockResolvedValue('healthy'),
  getLatestRPCLedgerIndex: vi.fn().mockResolvedValue(123456),
}));

vi.mock('../src/common/constants', () => ({
  STELLAR_NETWORK: 'testnet',
  CONTRACT_ID_TO_INDEX: 'CAAAAA',
  CONTRACT_IDS: ['CAAAAA', 'CBBBBB'],
  sorobanRpcUrl: 'http://localhost:1337'
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Horizon API (refactored)', () => {
  it('POST /api/ingest/events enqueues ingestion', async () => {
    const res = await request(app)
      .post('/api/ingest/events')
      .send({ startLedger: 123 });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.jobId).toBe('job-123');
  });

  it('POST /api/ingest/events with invalid startLedger returns 400', async () => {
    const res = await request(app)
      .post('/api/ingest/events')
      .send({ startLedger: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid startLedger');
  });

  it('POST /api/ingest/comprehensive initiates job', async () => {
    const res = await request(app)
      .post('/api/ingest/comprehensive')
      .send({ startLedger: 1000 });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Comprehensive data ingestion initiated');
  });

  it('POST /api/ingest/comprehensive invalid startLedger returns 400', async () => {
    const res = await request(app)
      .post('/api/ingest/comprehensive')
      .send({ startLedger: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid startLedger');
  });

  it('POST /api/ingest/contracts/operations enqueues job', async () => {
    const res = await request(app)
      .post('/api/ingest/contracts/operations')
      .send({ startLedger: 1000, includeFailedTx: true, contractIds: ['C1'] });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.jobId).toBe('job-789');
  });

  it('POST /api/ingest/contracts/operations invalid startLedger returns 400', async () => {
    const res = await request(app)
      .post('/api/ingest/contracts/operations')
      .send({ startLedger: 'bad' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid startLedger');
  });

  it('POST /api/ingest/contracts/comprehensive enqueues job', async () => {
    const res = await request(app)
      .post('/api/ingest/contracts/comprehensive')
      .send({ startLedger: 1000, contractIds: ['C1'] });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.jobId).toBe('job-456');
  });

  it('GET /api/health returns status information', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database_status).toContain('connected');
    expect(res.body.soroban_rpc_status).toBe('healthy');
  });
});