import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock database responses
const mockHorizonEvent = {
  id: 'event-uuid-1',
  eventId: '0004387339157639168-0000000001',
  ledger: 1021507,
  timestamp: new Date('2025-05-17T21:36:01Z'),
  contractId: 'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO',
  eventType: 'ATTEST',
  eventData: { topic: ['test'], value: 'test_value' },
  txHash: '12069247060c6f1a0f4244555a841dd76d5acb2194ead69da5a99fb4c5327478',
  transaction: {
    hash: '12069247060c6f1a0f4244555a841dd76d5acb2194ead69da5a99fb4c5327478',
    successful: true,
    fee: '100000'
  }
};

const mockHorizonTransaction = {
  id: 'tx-uuid-1',
  hash: '12069247060c6f1a0f4244555a841dd76d5acb2194ead69da5a99fb4c5327478',
  ledger: 1021507,
  timestamp: new Date('2025-05-17T21:36:01Z'),
  sourceAccount: 'GDAQ...',
  fee: '100000',
  successful: true,
  operationCount: 1,
  events: [mockHorizonEvent],
  operations: []
};

const mockDb = {
  horizonEvent: {
    findMany: vi.fn(),
    count: vi.fn()
  },
  horizonTransaction: {
    findMany: vi.fn(),
    count: vi.fn()
  },
  horizonOperation: {
    findMany: vi.fn(),
    count: vi.fn()
  },
  horizonEffect: {
    findMany: vi.fn(),
    count: vi.fn()
  },
  horizonContractData: {
    findMany: vi.fn(),
    count: vi.fn()
  },
  horizonAccount: {
    findMany: vi.fn(),
    count: vi.fn()
  },
  horizonPayment: {
    findMany: vi.fn(),
    count: vi.fn()
  },
  $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
  groupBy: vi.fn(),
  aggregate: vi.fn()
};

// Mock modules
vi.mock('../src/api/indexer/ledger', () => ({
  fetchAndStoreEvents: vi.fn().mockResolvedValue({
    message: 'ok',
    eventsFetched: 5,
    processedUpToLedger: 1021510,
    lastRpcLedger: 1021520,
  }),
  fetchComprehensiveContractData: vi.fn().mockResolvedValue({
    events: [{}],
    operations: [],
    effects: [],
    accounts: [],
    payments: [],
    contractData: []
  }),
  getRpcHealth: vi.fn().mockResolvedValue('healthy'),
  getLatestRPCLedgerIndex: vi.fn().mockResolvedValue(1021520),
}));

// Create mocks using factory functions to avoid hoisting issues
vi.mock('../src/api/indexer/db', () => ({
  getLastProcessedLedgerFromDB: vi.fn().mockResolvedValue(1021500),
  connectToPostgreSQL: vi.fn().mockResolvedValue(true),
  getDbInstance: vi.fn(),
  storeOperationsInDB: vi.fn(),
  storeEffectsInDB: vi.fn(),
  storeAccountsInDB: vi.fn(),
  storePaymentsInDB: vi.fn()
}));

vi.mock('../src/api/indexer/constants', () => ({
  STELLAR_NETWORK: 'Testnet',
  CONTRACT_ID_TO_INDEX: 'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO'
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
  // Reset mock responses
  mockDb.horizonEvent.findMany.mockResolvedValue([mockHorizonEvent]);
  mockDb.horizonEvent.count.mockResolvedValue(1);
  mockDb.horizonTransaction.findMany.mockResolvedValue([mockHorizonTransaction]);
  mockDb.horizonTransaction.count.mockResolvedValue(1);
  mockDb.horizonOperation.findMany.mockResolvedValue([]);
  mockDb.horizonOperation.count.mockResolvedValue(0);
  mockDb.horizonEffect.findMany.mockResolvedValue([]);
  mockDb.horizonEffect.count.mockResolvedValue(0);
  mockDb.horizonContractData.findMany.mockResolvedValue([]);
  mockDb.horizonContractData.count.mockResolvedValue(0);
  mockDb.horizonAccount.findMany.mockResolvedValue([]);
  mockDb.horizonAccount.count.mockResolvedValue(0);
  mockDb.horizonPayment.findMany.mockResolvedValue([]);
  mockDb.horizonPayment.count.mockResolvedValue(0);
});

describe('Horizon API - New Endpoints', () => {
  describe('GET /events', () => {
    it('should return events with default pagination', async () => {
      const res = await request(app).get('/api/indexer/events');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].eventId).toBe('0004387339157639168-0000000001');
      expect(res.body.pagination).toEqual({
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false
      });
    });

    it('should filter events by contractId', async () => {
      const contractId = 'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO';
      const res = await request(app)
        .get(`/api/indexer/events?contractId=${contractId}`);

      expect(res.status).toBe(200);
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contractId }
        })
      );
    });

    it('should filter events by eventType', async () => {
      const res = await request(app)
        .get('/api/indexer/events?eventType=ATTEST');

      expect(res.status).toBe(200);
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventType: 'ATTEST' }
        })
      );
    });

    it('should handle ledger range filtering', async () => {
      const res = await request(app)
        .get('/api/indexer/events?ledgerStart=1021500&ledgerEnd=1021510');

      expect(res.status).toBe(200);
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
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

    it('should enforce maximum limit', async () => {
      const res = await request(app)
        .get('/api/indexer/events?limit=500');

      expect(res.status).toBe(200);
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200 // Should be capped at 200
        })
      );
    });
  });

  describe('GET /transactions', () => {
    it('should return transactions with relations', async () => {
      const res = await request(app).get('/api/indexer/transactions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].hash).toBe('12069247060c6f1a0f4244555a841dd76d5acb2194ead69da5a99fb4c5327478');
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            operations: true,
            events: true,
            effects: true,
            payments: true
          }
        })
      );
    });

    it('should filter by transaction hash', async () => {
      const hash = '12069247060c6f1a0f4244555a841dd76d5acb2194ead69da5a99fb4c5327478';
      const res = await request(app)
        .get(`/api/indexer/transactions?hash=${hash}`);

      expect(res.status).toBe(200);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hash }
        })
      );
    });

    it('should filter by successful status', async () => {
      const res = await request(app)
        .get('/api/indexer/transactions?successful=true');

      expect(res.status).toBe(200);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { successful: true }
        })
      );
    });
  });

  describe('GET /operations', () => {
    it('should return operations with relations', async () => {
      const res = await request(app).get('/api/indexer/operations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDb.horizonOperation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            transaction: true,
            effects: true,
            events: true
          }
        })
      );
    });

    it('should filter by contractId', async () => {
      const contractId = 'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO';
      const res = await request(app)
        .get(`/api/indexer/operations?contractId=${contractId}`);

      expect(res.status).toBe(200);
      expect(mockDb.horizonOperation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contractId }
        })
      );
    });
  });

  describe('GET /effects', () => {
    it('should return effects with relations', async () => {
      const res = await request(app).get('/api/indexer/effects');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDb.horizonEffect.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            operation: true,
            transaction: true
          }
        })
      );
    });

    it('should filter by account', async () => {
      const account = 'GDAQ...';
      const res = await request(app)
        .get(`/api/indexer/effects?account=${account}`);

      expect(res.status).toBe(200);
      expect(mockDb.horizonEffect.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { account }
        })
      );
    });
  });

  describe('GET /contract-data', () => {
    it('should return latest contract data by default', async () => {
      const res = await request(app).get('/api/indexer/contract-data');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDb.horizonContractData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isDeleted: false },
          distinct: ['contractId', 'key']
        })
      );
    });

    it('should return all historical versions when latest=false', async () => {
      const res = await request(app)
        .get('/api/indexer/contract-data?latest=false');

      expect(res.status).toBe(200);
      expect(mockDb.horizonContractData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { ledger: 'desc' }
        })
      );
    });

    it('should filter by contractId and key', async () => {
      const contractId = 'CDDRYX6CX...';
      const key = 'test_key';
      const res = await request(app)
        .get(`/api/indexer/contract-data?contractId=${contractId}&key=${key}`);

      expect(res.status).toBe(200);
      expect(mockDb.horizonContractData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { 
            contractId,
            key,
            isDeleted: false 
          }
        })
      );
    });
  });

  describe('GET /accounts', () => {
    it('should return accounts', async () => {
      const res = await request(app).get('/api/indexer/accounts');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDb.horizonAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { lastActivity: 'desc' }
        })
      );
    });

    it('should filter by isContract', async () => {
      const res = await request(app)
        .get('/api/indexer/accounts?isContract=true');

      expect(res.status).toBe(200);
      expect(mockDb.horizonAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isContract: true }
        })
      );
    });
  });

  describe('GET /payments', () => {
    it('should return payments with transaction relations', async () => {
      const res = await request(app).get('/api/indexer/payments');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDb.horizonPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { transaction: true },
          orderBy: { timestamp: 'desc' }
        })
      );
    });

    it('should filter by from and to accounts', async () => {
      const from = 'GDAQ...';
      const to = 'GBCD...';
      const res = await request(app)
        .get(`/api/indexer/payments?from=${from}&to=${to}`);

      expect(res.status).toBe(200);
      expect(mockDb.horizonPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { from, to }
        })
      );
    });
  });

  describe('GET /analytics', () => {
    beforeEach(() => {
      mockDb.horizonEvent.count.mockResolvedValue(45);
      mockDb.horizonTransaction.count
        .mockResolvedValueOnce(32) // total transactions
        .mockResolvedValueOnce(31); // successful transactions
      mockDb.horizonEvent.groupBy.mockResolvedValue([
        { eventType: 'ATTEST', _count: { eventType: 25 } },
        { eventType: 'REVOKE', _count: { eventType: 12 } }
      ]);
      mockDb.horizonTransaction.aggregate.mockResolvedValue({
        _avg: { fee: '100000' },
        _sum: { fee: '3200000' }
      });
    });

    it('should return analytics for default timeframe', async () => {
      const res = await request(app).get('/api/indexer/analytics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.timeframe).toBe('24h');
      expect(res.body.data.summary).toEqual({
        totalEvents: 45,
        totalTransactions: 32,
        successfulTransactions: 31,
        successRate: '96.88%'
      });
      expect(res.body.data.eventsByType).toHaveLength(2);
      expect(res.body.data.fees).toEqual({
        average: '100000',
        total: '3200000'
      });
    });

    it('should filter analytics by contractId', async () => {
      const contractId = 'CDDRYX6CX...';
      const res = await request(app)
        .get(`/api/indexer/analytics?contractId=${contractId}`);

      expect(res.status).toBe(200);
      expect(mockDb.horizonEvent.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ contractId })
        })
      );
    });

    it('should handle different timeframes', async () => {
      const res = await request(app)
        .get('/api/indexer/analytics?timeframe=7d');

      expect(res.status).toBe(200);
      expect(res.body.timeframe).toBe('7d');
      // Check that the time filter was applied (7 days ago)
      expect(mockDb.horizonEvent.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({ gte: expect.any(Date) })
          })
        })
      );
    });
  });

  describe('GET /activity', () => {
    it('should return unified activity feed', async () => {
      const res = await request(app).get('/api/indexer/activity');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.count).toBeDefined();
    });

    it('should filter activity by contractId', async () => {
      const contractId = 'CDDRYX6CX...';
      const res = await request(app)
        .get(`/api/indexer/activity?contractId=${contractId}`);

      expect(res.status).toBe(200);
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contractId }
        })
      );
    });

    it('should support activity type filtering', async () => {
      const res = await request(app)
        .get('/api/indexer/activity?includeEvents=true&includeTransactions=false&includePayments=false');

      expect(res.status).toBe(200);
      // Should only call horizonEvent.findMany, not the others
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalled();
    });
  });

  describe('POST /comprehensive/ingest', () => {
    it('should trigger comprehensive data ingestion', async () => {
      const res = await request(app)
        .post('/api/indexer/comprehensive/ingest')
        .send({ startLedger: 1021500 });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Comprehensive data ingestion initiated');
    });

    it('should handle invalid startLedger parameter', async () => {
      const res = await request(app)
        .post('/api/indexer/comprehensive/ingest')
        .send({ startLedger: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid startLedger parameter');
    });
  });

  describe('Error handling', () => {
    it('should handle database unavailable', async () => {
      // Mock getDbInstance to return null
      const { getDbInstance } = await import('../src/api/indexer/db');
      vi.mocked(getDbInstance).mockResolvedValueOnce(undefined);

      const res = await request(app).get('/api/indexer/events');

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Database not available');
    });

    it('should handle database errors gracefully', async () => {
      mockDb.horizonEvent.findMany.mockRejectedValue(new Error('Database connection failed'));

      const res = await request(app).get('/api/indexer/events');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Database connection failed');
    });

    it('should validate pagination parameters', async () => {
      const res = await request(app)
        .get('/api/indexer/events?limit=abc&offset=xyz');

      expect(res.status).toBe(200); // Should still work with NaN converted to defaults
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50, // Default limit
          skip: 0   // Default offset
        })
      );
    });
  });
});