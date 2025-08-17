import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { createMockDb, mockHorizonEvent, TEST_CONTRACT_ID } from './fixtures/test-data';

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
  mockDb.horizonEvent.findMany.mockResolvedValue([mockHorizonEvent]);
  mockDb.horizonEvent.count.mockResolvedValue(1);
});

describe('Events API (refactored)', () => {
  describe('GET /api/data/events', () => {
    it('returns events with default pagination', async () => {
      const res = await request(app).get('/api/data/events');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].eventId).toBe(mockHorizonEvent.eventId);
      expect(res.body.pagination).toEqual({ total: 1, limit: 50, offset: 0, hasMore: false });
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith({
        where: {},
        include: { transaction: true },
        orderBy: { timestamp: 'asc' },
        take: 50,
        skip: 0,
      });
    });

    it('filters by contractId', async () => {
      await request(app).get(`/api/data/events?contractId=${TEST_CONTRACT_ID}`);
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contractId: TEST_CONTRACT_ID } })
      );
    });

    it('filters by eventType', async () => {
      await request(app).get('/api/data/events?eventType=ATTEST');
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventType: 'ATTEST' } })
      );
    });

    it('filters by ledger range', async () => {
      await request(app).get('/api/data/events?ledgerStart=1021500&ledgerEnd=1021510');
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ledger: { gte: 1021500, lte: 1021510 } } })
      );
    });

    it('enforces maximum limit of 200', async () => {
      await request(app).get('/api/data/events?limit=500');
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 })
      );
    });
  });
});