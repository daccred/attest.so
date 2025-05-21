import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock ledger and db modules before importing the router
vi.mock('../src/api/indexer/ledger', () => ({
  fetchAndStoreEvents: vi.fn().mockResolvedValue({
    message: 'ok',
    eventsFetched: 1,
    processedUpToLedger: 5,
    lastRpcLedger: 5,
  }),
  getRpcHealth: vi.fn().mockResolvedValue('healthy'),
}));

vi.mock('../src/api/indexer/db', () => ({
  getLastProcessedLedgerFromDB: vi.fn().mockResolvedValue(10),
  connectToMongoDB: vi.fn().mockResolvedValue(true),
  getDbInstance: vi.fn().mockResolvedValue({ command: vi.fn().mockResolvedValue(true) }),
}));

import horizonRouter from '../src/api/indexer/api';
import { fetchAndStoreEvents } from '../src/api/indexer/ledger';
import { getRpcHealth } from '../src/api/indexer/ledger';
import { getLastProcessedLedgerFromDB } from '../src/api/indexer/db';

const app = express();
app.use(express.json());
app.use('/api/horizon', horizonRouter);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Horizon API', () => {
  it('POST /events/ingest triggers ingestion', async () => {
    const res = await request(app)
      .post('/api/horizon/events/ingest')
      .send({ startLedger: 123 });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(fetchAndStoreEvents).toHaveBeenCalledWith(123);
  });

  it('POST /events/ingest with invalid startLedger returns 400', async () => {
    const res = await request(app)
      .post('/api/horizon/events/ingest')
      .send({ startLedger: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid startLedger parameter');
  });

  it('GET /health returns status information', async () => {
    const res = await request(app).get('/api/horizon/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.mongodb_status).toBe('connected');
    expect(res.body.soroban_rpc_status).toBe('healthy');
    expect(getLastProcessedLedgerFromDB).toHaveBeenCalled();
    expect(getRpcHealth).toHaveBeenCalled();
  });
});
