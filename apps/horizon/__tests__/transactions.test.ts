import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { createMockDb, mockHorizonTransaction, TEST_TX_HASH, TEST_ACCOUNT_ID } from './fixtures/test-data';

vi.mock('../src/common/db', () => ({
  getDB: vi.fn(),
}));

vi.mock('../src/repository/rpc.repository', () => ({
  getRpcHealth: vi.fn().mockResolvedValue('healthy'),
  getLatestRPCLedgerIndex: vi.fn().mockResolvedValue(1021520),
}));

const mockDb = createMockDb();

beforeEach(async () => {
  vi.clearAllMocks();
  const dbModule = await import('../src/common/db');
  (dbModule.getDB as any).mockResolvedValue(mockDb);
  mockDb.horizonTransaction.findMany.mockResolvedValue([mockHorizonTransaction]);
  mockDb.horizonTransaction.count.mockResolvedValue(1);
});

describe('Transactions API (refactored)', () => {
  describe('GET /api/data/transactions', () => {
    it('returns transactions with all relations', async () => {
      const transactionWithRelations = {
        ...mockHorizonTransaction,
        operations: [ { id: 'op1', type: 'invoke_host_function' } ],
        events: [ { id: 'evt1', eventType: 'ATTEST' } ],
        effects: [ { id: 'eff1', type: 'contract_credited' } ],
        payments: [ { id: 'pay1', amount: '100.0000000' } ]
      };

      mockDb.horizonTransaction.findMany.mockResolvedValue([transactionWithRelations]);

      const res = await request(app).get('/api/data/transactions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].hash).toBe(TEST_TX_HASH);
      expect(res.body.data[0].events).toHaveLength(1);
      expect(res.body.data[0].effects).toHaveLength(1);
      expect(res.body.data[0].payments).toHaveLength(1);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {},
        include: { events: true, effects: true, payments: true },
        orderBy: { timestamp: 'desc' },
        take: 50,
        skip: 0
      }));
    });

    it('filters by transaction hash', async () => {
      await request(app).get(`/api/data/transactions?hash=${TEST_TX_HASH}`);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { hash: TEST_TX_HASH }
      }));
    });

    it('filters by sourceAccount', async () => {
      await request(app).get(`/api/data/transactions?sourceAccount=${TEST_ACCOUNT_ID}`);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { sourceAccount: TEST_ACCOUNT_ID }
      }));
    });

    it('filters by successful status', async () => {
      await request(app).get('/api/data/transactions?successful=true');
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { successful: true }
      }));
      await request(app).get('/api/data/transactions?successful=false');
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { successful: false }
      }));
    });
  });
});