import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createMockDb, TEST_CONTRACT_ID } from './fixtures/test-data';

// Create mocks using factory functions to avoid hoisting issues
vi.mock('../src/api/indexer/db', () => ({
  getDbInstance: vi.fn(),
}));

vi.mock('../src/api/indexer/ledger', () => ({}));
vi.mock('../src/api/indexer/constants', () => ({}));

import horizonRouter from '../src/api/indexer/api';

const app = express();
app.use(express.json());
app.use('/api/indexer', horizonRouter);

const mockDb = createMockDb();

beforeEach(async () => {
  vi.clearAllMocks();
  
  // Get and set up the database mock - cast to mock function
  const dbModule = await import('../src/api/indexer/db');
  (dbModule.getDbInstance as any).mockResolvedValue(mockDb);
  
  // Set up default mock analytics data
  mockDb.horizonEvent.count.mockResolvedValue(45);
  mockDb.horizonTransaction.count
    .mockResolvedValueOnce(32) // total transactions
    .mockResolvedValueOnce(31); // successful transactions
  mockDb.horizonEvent.groupBy.mockResolvedValue([
    { eventType: 'ATTEST', _count: { eventType: 25 } },
    { eventType: 'REVOKE', _count: { eventType: 12 } },
    { eventType: 'SCHEMA', _count: { eventType: 8 } }
  ]);
  mockDb.horizonTransaction.aggregate.mockResolvedValue({
    _avg: { fee: '125000' },
    _sum: { fee: '4000000' }
  });
});

describe('Analytics API', () => {
  describe('GET /analytics', () => {
    it('should return analytics for default 24h timeframe', async () => {
      const res = await request(app).get('/api/indexer/analytics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.timeframe).toBe('24h');
      expect(res.body.data).toEqual({
        summary: {
          totalEvents: 45,
          totalTransactions: 32,
          successfulTransactions: 31,
          successRate: '96.88%'
        },
        eventsByType: [
          { type: 'ATTEST', count: 25 },
          { type: 'REVOKE', count: 12 },
          { type: 'SCHEMA', count: 8 }
        ],
        fees: {
          average: '125000',
          total: '4000000'
        }
      });
    });

    it('should calculate success rate correctly', async () => {
      // Test 100% success rate
      mockDb.horizonTransaction.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(10);

      let res = await request(app).get('/api/indexer/analytics');
      expect(res.body.data.summary.successRate).toBe('100.00%');

      // Test 0% success rate
      mockDb.horizonTransaction.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(0);

      res = await request(app).get('/api/indexer/analytics');
      expect(res.body.data.summary.successRate).toBe('0.00%');

      // Test with no transactions
      mockDb.horizonTransaction.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      res = await request(app).get('/api/indexer/analytics');
      expect(res.body.data.summary.successRate).toBe('0%');
    });

    it('should filter analytics by contractId', async () => {
      const res = await request(app)
        .get(`/api/indexer/analytics?contractId=${TEST_CONTRACT_ID}`);

      expect(res.status).toBe(200);
      
      // Check that events query includes contractId filter
      expect(mockDb.horizonEvent.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contractId: TEST_CONTRACT_ID
          })
        })
      );

      // Check that transaction queries include events filter for the contract
      expect(mockDb.horizonTransaction.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            events: { some: { contractId: TEST_CONTRACT_ID } }
          })
        })
      );

      expect(mockDb.horizonEvent.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contractId: TEST_CONTRACT_ID
          })
        })
      );
    });

    it('should support different timeframes', async () => {
      const timeframes = ['1h', '24h', '7d', '30d'];
      
      for (const timeframe of timeframes) {
        const res = await request(app)
          .get(`/api/indexer/analytics?timeframe=${timeframe}`);

        expect(res.status).toBe(200);
        expect(res.body.timeframe).toBe(timeframe);
        
        // Check that time filter is applied based on timeframe
        expect(mockDb.horizonEvent.count).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              timestamp: expect.objectContaining({
                gte: expect.any(Date)
              })
            })
          })
        );
        
        vi.clearAllMocks();
        // Reset mocks for next iteration
        mockDb.horizonEvent.count.mockResolvedValue(45);
        mockDb.horizonTransaction.count
          .mockResolvedValueOnce(32)
          .mockResolvedValueOnce(31);
        mockDb.horizonEvent.groupBy.mockResolvedValue([]);
        mockDb.horizonTransaction.aggregate.mockResolvedValue({
          _avg: { fee: '125000' },
          _sum: { fee: '4000000' }
        });
      }
    });

    it('should default to 24h for invalid timeframe', async () => {
      const res = await request(app)
        .get('/api/indexer/analytics?timeframe=invalid');

      expect(res.status).toBe(200);
      expect(res.body.timeframe).toBe('invalid'); // Returns the requested timeframe in response
      
      // But should use 24h internally for time calculation
      const call = mockDb.horizonEvent.count.mock.calls[0][0];
      const timeFilter = call.where.timestamp.gte;
      const now = new Date();
      const expectedTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Should be within 1 second of 24h ago (accounting for test execution time)
      expect(Math.abs(timeFilter.getTime() - expectedTime.getTime())).toBeLessThan(1000);
    });

    it('should handle time range calculations correctly', async () => {
      const res = await request(app)
        .get('/api/indexer/analytics?timeframe=7d');

      expect(res.status).toBe(200);
      
      const call = mockDb.horizonEvent.count.mock.calls[0][0];
      const timeFilter = call.where.timestamp.gte;
      const now = new Date();
      const expected7dAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Should be within 1 second of 7 days ago
      expect(Math.abs(timeFilter.getTime() - expected7dAgo.getTime())).toBeLessThan(1000);
    });

    it('should handle empty analytics data', async () => {
      mockDb.horizonEvent.count.mockResolvedValue(0);
      mockDb.horizonTransaction.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockDb.horizonEvent.groupBy.mockResolvedValue([]);
      mockDb.horizonTransaction.aggregate.mockResolvedValue({
        _avg: { fee: null },
        _sum: { fee: null }
      });

      const res = await request(app).get('/api/indexer/analytics');

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toEqual({
        totalEvents: 0,
        totalTransactions: 0,
        successfulTransactions: 0,
        successRate: '0%'
      });
      expect(res.body.data.eventsByType).toHaveLength(0);
      expect(res.body.data.fees).toEqual({
        average: null,
        total: null
      });
    });

    it('should group events by type correctly', async () => {
      const customEventTypes = [
        { eventType: 'CREATE_SCHEMA', _count: { eventType: 15 } },
        { eventType: 'UPDATE_SCHEMA', _count: { eventType: 5 } },
        { eventType: 'DELETE_SCHEMA', _count: { eventType: 2 } }
      ];
      
      mockDb.horizonEvent.groupBy.mockResolvedValue(customEventTypes);

      const res = await request(app).get('/api/indexer/analytics');

      expect(res.status).toBe(200);
      expect(res.body.data.eventsByType).toEqual([
        { type: 'CREATE_SCHEMA', count: 15 },
        { type: 'UPDATE_SCHEMA', count: 5 },
        { type: 'DELETE_SCHEMA', count: 2 }
      ]);
    });

    it('should handle fee aggregation edge cases', async () => {
      // Test with very large numbers
      mockDb.horizonTransaction.aggregate.mockResolvedValue({
        _avg: { fee: '99999999999' },
        _sum: { fee: '999999999999999' }
      });

      const res = await request(app).get('/api/indexer/analytics');

      expect(res.status).toBe(200);
      expect(res.body.data.fees.average).toBe('99999999999');
      expect(res.body.data.fees.total).toBe('999999999999999');
    });

    it('should combine contractId and timeframe filters', async () => {
      const res = await request(app)
        .get(`/api/indexer/analytics?contractId=${TEST_CONTRACT_ID}&timeframe=7d`);

      expect(res.status).toBe(200);
      
      expect(mockDb.horizonEvent.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contractId: TEST_CONTRACT_ID,
            timestamp: expect.objectContaining({
              gte: expect.any(Date)
            })
          })
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle database unavailable', async () => {
      const { getDbInstance } = await import('../src/api/indexer/db');
      vi.mocked(getDbInstance).mockResolvedValueOnce(undefined);

      const res = await request(app).get('/api/indexer/analytics');

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Database not available');
    });

    it('should handle database query errors', async () => {
      mockDb.horizonEvent.count.mockRejectedValue(new Error('Connection failed'));

      const res = await request(app).get('/api/indexer/analytics');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Connection failed');
    });

    it('should handle partial query failures gracefully', async () => {
      mockDb.horizonEvent.count.mockResolvedValue(10);
      mockDb.horizonTransaction.count
        .mockResolvedValueOnce(5)
        .mockRejectedValueOnce(new Error('Transaction count failed'));

      const res = await request(app).get('/api/indexer/analytics');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Transaction count failed');
    });

    it('should handle null/undefined contractId parameter', async () => {
      const res = await request(app)
        .get('/api/indexer/analytics?contractId=');

      expect(res.status).toBe(200);
      
      // Empty contractId should not add filter
      expect(mockDb.horizonEvent.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            contractId: expect.anything()
          })
        })
      );
    });
  });
});