import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createMockDb, mockHorizonEvent, TEST_CONTRACT_ID } from './fixtures/test-data';

vi.mock('../../src/api/indexer/ledger', () => ({
  fetchAndStoreEvents: vi.fn().mockResolvedValue({
    message: 'Event ingestion completed',
    eventsFetched: 5,
    processedUpToLedger: 1021510,
    lastRpcLedger: 1021520,
  }),
  getRpcHealth: vi.fn().mockResolvedValue('healthy'),
  getLatestRPCLedgerIndex: vi.fn().mockResolvedValue(1021520),
}));

// Create mocks using factory functions to avoid hoisting issues
vi.mock('../../src/api/indexer/db', () => ({
  getLastProcessedLedgerFromDB: vi.fn().mockResolvedValue(1021500),
  connectToPostgreSQL: vi.fn().mockResolvedValue(true),
  getDbInstance: vi.fn(),
}));

vi.mock('../../src/api/indexer/constants', () => ({
  STELLAR_NETWORK: 'Testnet',
  CONTRACT_ID_TO_INDEX: TEST_CONTRACT_ID
}));

import horizonRouter from '../src/api/indexer/api';

const app = express();
app.use(express.json());
app.use('/api/indexer', horizonRouter);

// Get a reference to the mock database
const mockDb = createMockDb();

beforeEach(async () => {
  vi.clearAllMocks();
  
  // Get and set up the database mock - cast to mock function
  const dbModule = await import('../src/api/indexer/db');
  (dbModule.getDbInstance as any).mockResolvedValue(mockDb);
  
  // Reset mock implementations
  mockDb.horizonEvent.findMany.mockResolvedValue([mockHorizonEvent]);
  mockDb.horizonEvent.count.mockResolvedValue(1);
});

describe('Events API', () => {
  describe('GET /events', () => {
    it('should return events with default pagination', async () => {
      const res = await request(app).get('/api/indexer/events');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].eventId).toBe(mockHorizonEvent.eventId);
      expect(res.body.data[0].eventType).toBe('ATTEST');
      expect(res.body.pagination).toEqual({
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false
      });
      
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          transaction: true,
          operations: true
        },
        orderBy: { timestamp: 'desc' },
        take: 50,
        skip: 0
      });
    });

    it('should filter events by contractId', async () => {
      const res = await request(app)
        .get(`/api/indexer/events?contractId=${TEST_CONTRACT_ID}`);

      expect(res.status).toBe(200);
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contractId: TEST_CONTRACT_ID }
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

    it('should filter events by ledger range', async () => {
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

    it('should enforce maximum limit of 200', async () => {
      const res = await request(app)
        .get('/api/indexer/events?limit=500');

      expect(res.status).toBe(200);
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200 // Should be capped at 200
        })
      );
    });

    it('should handle custom limit and offset', async () => {
      const res = await request(app)
        .get('/api/indexer/events?limit=25&offset=10');

      expect(res.status).toBe(200);
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
          skip: 10
        })
      );
    });

    it('should handle multiple filters combined', async () => {
      const res = await request(app)
        .get(`/api/indexer/events?contractId=${TEST_CONTRACT_ID}&eventType=ATTEST&ledgerStart=1021500`);

      expect(res.status).toBe(200);
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { 
            contractId: TEST_CONTRACT_ID,
            eventType: 'ATTEST',
            ledger: { gte: 1021500 }
          }
        })
      );
    });

    it('should include transaction and operations relations', async () => {
      const eventWithRelations = {
        ...mockHorizonEvent,
        transaction: {
          hash: mockHorizonEvent.txHash,
          successful: true,
          fee: '100000'
        },
        operations: [
          {
            operationId: '0004387339157639168-0000000001',
            type: 'invoke_host_function'
          }
        ]
      };
      
      mockDb.horizonEvent.findMany.mockResolvedValue([eventWithRelations]);

      const res = await request(app).get('/api/indexer/events');

      expect(res.status).toBe(200);
      expect(res.body.data[0].transaction).toBeDefined();
      expect(res.body.data[0].operations).toBeDefined();
    });

    it('should return empty array when no events found', async () => {
      mockDb.horizonEvent.findMany.mockResolvedValue([]);
      mockDb.horizonEvent.count.mockResolvedValue(0);

      const res = await request(app).get('/api/indexer/events');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it('should calculate hasMore correctly', async () => {
      mockDb.horizonEvent.count.mockResolvedValue(100);

      // Test with offset 0, should have more
      let res = await request(app)
        .get('/api/indexer/events?limit=25&offset=0');

      expect(res.status).toBe(200);
      expect(res.body.pagination.hasMore).toBe(true);

      // Test with offset 75, should not have more (75 + 25 = 100)
      res = await request(app)
        .get('/api/indexer/events?limit=25&offset=75');

      expect(res.status).toBe(200);
      expect(res.body.pagination.hasMore).toBe(false);
    });
  });

  describe('POST /events/ingest', () => {
    it('should trigger event ingestion with startLedger', async () => {
      const { fetchAndStoreEvents } = await import('../src/api/indexer/ledger');
      
      const res = await request(app)
        .post('/api/indexer/events/ingest')
        .send({ startLedger: 1021500 });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Event ingestion process initiated');
      expect(fetchAndStoreEvents).toHaveBeenCalledWith(1021500);
    });

    it('should trigger event ingestion without startLedger', async () => {
      const { fetchAndStoreEvents } = await import('../src/api/indexer/ledger');
      
      const res = await request(app)
        .post('/api/indexer/events/ingest')
        .send({});

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(fetchAndStoreEvents).toHaveBeenCalledWith(undefined);
    });

    it('should reject invalid startLedger parameter', async () => {
      const res = await request(app)
        .post('/api/indexer/events/ingest')
        .send({ startLedger: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid startLedger parameter. Must be a number.');
    });

    it('should handle string numbers in startLedger', async () => {
      const { fetchAndStoreEvents } = await import('../src/api/indexer/ledger');
      
      const res = await request(app)
        .post('/api/indexer/events/ingest')
        .send({ startLedger: '1021500' });

      expect(res.status).toBe(202);
      expect(fetchAndStoreEvents).toHaveBeenCalledWith(1021500);
    });
  });

  describe('Error handling', () => {
    it('should handle database unavailable', async () => {
      const { getDbInstance } = await import('../src/api/indexer/db');
      vi.mocked(getDbInstance).mockResolvedValueOnce(undefined);

      const res = await request(app).get('/api/indexer/events');

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Database not available');
    });

    it('should handle database query errors', async () => {
      mockDb.horizonEvent.findMany.mockRejectedValue(new Error('Connection timeout'));

      const res = await request(app).get('/api/indexer/events');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Connection timeout');
    });

    it('should handle invalid query parameters gracefully', async () => {
      // NaN values should be handled gracefully
      const res = await request(app)
        .get('/api/indexer/events?limit=abc&offset=xyz&ledgerStart=invalid');

      expect(res.status).toBe(200);
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50, // Default limit
          skip: 0   // Default offset
          // ledgerStart should be ignored if invalid
        })
      );
    });

    it('should handle null/undefined query parameters', async () => {
      const res = await request(app)
        .get('/api/indexer/events?contractId=&eventType=null');

      expect(res.status).toBe(200);
      // Empty contractId should not be included in where clause
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventType: 'null' } // 'null' as string should be included
        })
      );
    });
  });
});