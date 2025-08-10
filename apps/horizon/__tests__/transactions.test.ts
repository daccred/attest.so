import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createMockDb, mockHorizonTransaction, TEST_TX_HASH, TEST_ACCOUNT_ID } from './fixtures/test-data';

// Create mocks using factory functions to avoid hoisting issues
vi.mock('../src/api/indexer/db', () => ({
  getDbInstance: vi.fn(),
}));

const mockDb = createMockDb();

vi.mock('../src/api/indexer/ledger', () => ({
  getRpcHealth: vi.fn().mockResolvedValue('healthy'),
  getLatestRPCLedgerIndex: vi.fn().mockResolvedValue(1021520),
}));

vi.mock('../src/api/indexer/constants', () => ({
  STELLAR_NETWORK: 'Testnet',
  CONTRACT_ID_TO_INDEX: 'CDDRYX6CX...'
}));

import horizonRouter from '../src/api/indexer/api';

const app = express();
app.use(express.json());
app.use('/api/indexer', horizonRouter);

beforeEach(async () => {
  vi.clearAllMocks();
  
  // Get and set up the database mock - cast to mock function
  const dbModule = await import('../src/api/indexer/db');
  (dbModule.getDbInstance as any).mockResolvedValue(mockDb);
  mockDb.horizonTransaction.findMany.mockResolvedValue([mockHorizonTransaction]);
  mockDb.horizonTransaction.count.mockResolvedValue(1);
});

describe('Transactions API', () => {
  describe('GET /transactions', () => {
    it('should return transactions with all relations', async () => {
      const transactionWithRelations = {
        ...mockHorizonTransaction,
        operations: [
          { id: 'op1', type: 'invoke_host_function' }
        ],
        events: [
          { id: 'evt1', eventType: 'ATTEST' }
        ],
        effects: [
          { id: 'eff1', type: 'contract_credited' }
        ],
        payments: [
          { id: 'pay1', amount: '100.0000000' }
        ]
      };

      mockDb.horizonTransaction.findMany.mockResolvedValue([transactionWithRelations]);

      const res = await request(app).get('/api/indexer/transactions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].hash).toBe(TEST_TX_HASH);
      expect(res.body.data[0].operations).toHaveLength(1);
      expect(res.body.data[0].events).toHaveLength(1);
      expect(res.body.data[0].effects).toHaveLength(1);
      expect(res.body.data[0].payments).toHaveLength(1);

      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          operations: true,
          events: true,
          effects: true,
          payments: true
        },
        orderBy: { timestamp: 'desc' },
        take: 50,
        skip: 0
      });
    });

    it('should filter transactions by hash', async () => {
      const res = await request(app)
        .get(`/api/indexer/transactions?hash=${TEST_TX_HASH}`);

      expect(res.status).toBe(200);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hash: TEST_TX_HASH }
        })
      );
    });

    it('should filter transactions by sourceAccount', async () => {
      const res = await request(app)
        .get(`/api/indexer/transactions?sourceAccount=${TEST_ACCOUNT_ID}`);

      expect(res.status).toBe(200);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sourceAccount: TEST_ACCOUNT_ID }
        })
      );
    });

    it('should filter transactions by successful status', async () => {
      const res = await request(app)
        .get('/api/indexer/transactions?successful=true');

      expect(res.status).toBe(200);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { successful: true }
        })
      );

      // Test false value
      const resFalse = await request(app)
        .get('/api/indexer/transactions?successful=false');

      expect(resFalse.status).toBe(200);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { successful: false }
        })
      );
    });

    it('should filter transactions by ledger range', async () => {
      const res = await request(app)
        .get('/api/indexer/transactions?ledgerStart=1021500&ledgerEnd=1021510');

      expect(res.status).toBe(200);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { 
            ledger: { 
              gte: 1021500,
              lte: 1021510 
            }
          }
        })
      );
    });

    it('should handle ledgerStart without ledgerEnd', async () => {
      const res = await request(app)
        .get('/api/indexer/transactions?ledgerStart=1021500');

      expect(res.status).toBe(200);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { 
            ledger: { gte: 1021500 }
          }
        })
      );
    });

    it('should handle ledgerEnd without ledgerStart', async () => {
      const res = await request(app)
        .get('/api/indexer/transactions?ledgerEnd=1021510');

      expect(res.status).toBe(200);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { 
            ledger: { lte: 1021510 }
          }
        })
      );
    });

    it('should enforce maximum limit of 200', async () => {
      const res = await request(app)
        .get('/api/indexer/transactions?limit=500');

      expect(res.status).toBe(200);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200
        })
      );
    });

    it('should handle custom pagination', async () => {
      mockDb.horizonTransaction.count.mockResolvedValue(100);

      const res = await request(app)
        .get('/api/indexer/transactions?limit=25&offset=25');

      expect(res.status).toBe(200);
      expect(res.body.pagination).toEqual({
        total: 100,
        limit: 25,
        offset: 25,
        hasMore: true
      });
    });

    it('should combine multiple filters', async () => {
      const res = await request(app)
        .get(`/api/indexer/transactions?sourceAccount=${TEST_ACCOUNT_ID}&successful=true&ledgerStart=1021500`);

      expect(res.status).toBe(200);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { 
            sourceAccount: TEST_ACCOUNT_ID,
            successful: true,
            ledger: { gte: 1021500 }
          }
        })
      );
    });

    it('should return transaction with Soroban resource usage', async () => {
      const res = await request(app).get('/api/indexer/transactions');

      expect(res.status).toBe(200);
      expect(res.body.data[0].sorobanResourceUsage).toBeDefined();
      expect(res.body.data[0].sorobanResourceUsage.cpuInsns).toBe('1234567');
      expect(res.body.data[0].sorobanResourceUsage.memBytes).toBe('8192');
    });

    it('should return fee breakdown', async () => {
      const res = await request(app).get('/api/indexer/transactions');

      expect(res.status).toBe(200);
      expect(res.body.data[0].fee).toBe('100000');
      expect(res.body.data[0].inclusionFee).toBe('100');
      expect(res.body.data[0].resourceFee).toBe('99900');
    });

    it('should return empty array when no transactions found', async () => {
      mockDb.horizonTransaction.findMany.mockResolvedValue([]);
      mockDb.horizonTransaction.count.mockResolvedValue(0);

      const res = await request(app).get('/api/indexer/transactions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it('should order transactions by timestamp desc', async () => {
      const res = await request(app).get('/api/indexer/transactions');

      expect(res.status).toBe(200);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { timestamp: 'desc' }
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle database unavailable', async () => {
      const { getDbInstance } = await import('../src/api/indexer/db');
      vi.mocked(getDbInstance).mockResolvedValueOnce(undefined);

      const res = await request(app).get('/api/indexer/transactions');

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Database not available');
    });

    it('should handle database query errors', async () => {
      mockDb.horizonTransaction.findMany.mockRejectedValue(new Error('Query timeout'));

      const res = await request(app).get('/api/indexer/transactions');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Query timeout');
    });

    it('should handle invalid successful parameter gracefully', async () => {
      const res = await request(app)
        .get('/api/indexer/transactions?successful=maybe');

      expect(res.status).toBe(200);
      // 'maybe' !== 'true', so successful filter should not be applied
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {}
        })
      );
    });

    it('should handle invalid numeric parameters', async () => {
      const res = await request(app)
        .get('/api/indexer/transactions?ledgerStart=invalid&limit=abc&offset=xyz');

      expect(res.status).toBe(200);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {}, // Invalid ledgerStart should be ignored
          take: 50,  // Default limit
          skip: 0    // Default offset
        })
      );
    });
  });
});