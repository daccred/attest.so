import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';

const mockDb: any = {
  horizonEvent: { findMany: vi.fn(), count: vi.fn() },
  horizonTransaction: { findMany: vi.fn(), count: vi.fn() },
  horizonContractOperation: { findMany: vi.fn(), count: vi.fn() },
  horizonEffect: { findMany: vi.fn(), count: vi.fn() },
  horizonContractData: { findMany: vi.fn(), count: vi.fn() },
  horizonAccount: { findMany: vi.fn(), count: vi.fn() },
  horizonPayment: { findMany: vi.fn(), count: vi.fn() },
  $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
  groupBy: vi.fn(),
  aggregate: vi.fn()
};

vi.mock('../src/common/constants', () => ({
  STELLAR_NETWORK: 'testnet',
  CONTRACT_ID_TO_INDEX: 'CAAAAA',
  CONTRACT_IDS: ['CAAAAA', 'CBBBBB'],
  sorobanRpcUrl: 'http://localhost:1337'
}));

vi.mock('../src/common/db', () => ({
  getDB: vi.fn(),
}));

vi.mock('../src/repository/rpc.repository', () => ({
  getRpcHealth: vi.fn().mockResolvedValue('healthy'),
  getLatestRPCLedgerIndex: vi.fn().mockResolvedValue(1021520),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  const dbModule = await import('../src/common/db');
  (dbModule.getDB as any).mockResolvedValue(mockDb);

  mockDb.horizonEvent.findMany.mockResolvedValue([
    {
      eventId: '0004387339157639168-0000000001',
      timestamp: new Date('2025-05-17T21:36:01Z'),
      contractId: 'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO',
      eventType: 'ATTEST',
      eventData: {},
      transaction: { hash: 'h', successful: true, fee: '100000' },
    },
  ]);
  mockDb.horizonEvent.count.mockResolvedValue(1);
  mockDb.horizonTransaction.findMany.mockResolvedValue([
    {
      hash: 'h',
      timestamp: new Date('2025-05-17T21:36:01Z'),
      successful: true,
      events: [],
      effects: [],
      payments: [],
    },
  ]);
  mockDb.horizonTransaction.count.mockResolvedValue(1);
  mockDb.horizonContractOperation.findMany.mockResolvedValue([
    { id: 'op1', type: 'invoke_host_function', contractId: 'C', transaction: {}, events: [] },
  ]);
  mockDb.horizonContractOperation.count.mockResolvedValue(1);
  mockDb.horizonEffect.findMany.mockResolvedValue([
    { id: 'eff1', type: 'contract_credited', transaction: {} },
  ]);
  mockDb.horizonEffect.count.mockResolvedValue(1);
  mockDb.horizonContractData.findMany.mockResolvedValue([
    { id: 'data1', contractId: 'C', key: 'k', value: { type: 'ScValType', value: '42' } },
  ]);
  mockDb.horizonContractData.count.mockResolvedValue(1);
  mockDb.horizonAccount.findMany.mockResolvedValue([
    { id: 'acct1', accountId: 'G...', isContract: true, lastActivity: new Date() },
  ]);
  mockDb.horizonAccount.count.mockResolvedValue(1);
  mockDb.horizonPayment.findMany.mockResolvedValue([
    { id: 'pay1', from: 'G...', to: 'G..2', amount: '10.0000000', transaction: {} },
  ]);
  mockDb.horizonPayment.count.mockResolvedValue(1);
});

describe('Horizon API - Endpoints (refactored)', () => {
  describe('GET /api/data/events', () => {
    it('returns events with default pagination', async () => {
      const res = await request(app).get('/api/data/events');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination).toEqual({ total: 1, limit: 50, offset: 0, hasMore: false });
    });

    it('applies contractId filter', async () => {
      const contractId = 'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO';
      await request(app).get(`/api/data/events?contractId=${contractId}`);
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contractId } })
      );
    });

    it('applies ledger range filter', async () => {
      await request(app).get('/api/data/events?ledgerStart=1021500&ledgerEnd=1021510');
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ledger: { gte: 1021500, lte: 1021510 } } })
      );
    });

    it('caps limit at 200', async () => {
      await request(app).get('/api/data/events?limit=500');
      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 })
      );
    });
  });

  describe('GET /api/data/transactions', () => {
    it('returns transactions with relations', async () => {
      const res = await request(app).get('/api/data/transactions');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDb.horizonTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { events: true, effects: true, payments: true } })
      );
    });
  });

  describe('GET /api/data/operations', () => {
    it('returns operations with transaction and events', async () => {
      const res = await request(app).get('/api/data/operations');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDb.horizonContractOperation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { transaction: true, events: true } })
      );
    });

    it('applies filters', async () => {
      await request(app).get('/api/data/operations?contractId=C&type=invoke_host_function&sourceAccount=G..');
      expect(mockDb.horizonContractOperation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contractId: 'C', type: 'invoke_host_function', sourceAccount: 'G..' } })
      );
    });
  });

  describe('GET /api/data/effects', () => {
    it('returns effects with transaction relation', async () => {
      const res = await request(app).get('/api/data/effects');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDb.horizonEffect.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { transaction: true } })
      );
    });
  });

  describe('GET /api/data/contract-data', () => {
    it('returns latest contract data by default', async () => {
      const res = await request(app).get('/api/data/contract-data');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDb.horizonContractData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ distinct: ['contractId', 'key'] })
      );
    });

    it('returns all versions when latest=false', async () => {
      const res = await request(app).get('/api/data/contract-data?latest=false');
      expect(res.status).toBe(200);
      expect(mockDb.horizonContractData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { ledger: 'desc' } })
      );
    });
  });

  describe('GET /api/data/accounts', () => {
    it('returns accounts ordered by lastActivity', async () => {
      const res = await request(app).get('/api/data/accounts');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDb.horizonAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { lastActivity: 'desc' } })
      );
    });
  });

  describe('GET /api/data/payments', () => {
    it('returns payments with transaction relation', async () => {
      const res = await request(app).get('/api/data/payments');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDb.horizonPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { transaction: true }, orderBy: { timestamp: 'desc' } })
      );
    });
  });
});