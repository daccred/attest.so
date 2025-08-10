import { Router, Request, Response } from 'express';
import { getDB } from '../common/db';

const router = Router();

// Contract Events API
router.get('/events', async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const {
      contractId,
      eventType,
      limit = '50',
      offset = '0',
      ledgerStart,
      ledgerEnd,
      cursor
    } = req.query;

    const where: any = {};
    if (contractId) where.contractId = contractId as string;
    if (eventType) where.eventType = eventType as string;
    if (ledgerStart) where.ledger = { gte: parseInt(ledgerStart as string) };
    if (ledgerEnd) where.ledger = { ...where.ledger, lte: parseInt(ledgerEnd as string) };

    const events = await db.horizonEvent.findMany({
      where,
      include: {
        transaction: true,
        operations: true
      },
      orderBy: { timestamp: 'asc' as const },
      take: Math.min(parseInt(limit as string), 200),
      skip: parseInt(offset as string)
    });

    const total = await db.horizonEvent.count({ where });

    res.json({
      success: true,
      data: events,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + events.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Transactions API
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const {
      hash,
      sourceAccount,
      successful,
      limit = '50',
      offset = '0',
      ledgerStart,
      ledgerEnd
    } = req.query;

    const where: any = {};
    if (hash) where.hash = hash as string;
    if (sourceAccount) where.sourceAccount = sourceAccount as string;
    if (successful !== undefined) where.successful = successful === 'true';
    if (ledgerStart) where.ledger = { gte: parseInt(ledgerStart as string) };
    if (ledgerEnd) where.ledger = { ...where.ledger, lte: parseInt(ledgerEnd as string) };

    const transactions = await db.horizonTransaction.findMany({
      where,
      include: {
        operations: true,
        events: true,
        effects: true,
        payments: true
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(parseInt(limit as string), 200),
      skip: parseInt(offset as string)
    });

    const total = await db.horizonTransaction.count({ where });

    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + transactions.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Operations API
router.get('/operations', async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const {
      transactionHash,
      contractId,
      type,
      sourceAccount,
      limit = '50',
      offset = '0'
    } = req.query;

    const where: any = {};
    if (transactionHash) where.transactionHash = transactionHash as string;
    if (contractId) where.contractId = contractId as string;
    if (type) where.type = type as string;
    if (sourceAccount) where.sourceAccount = sourceAccount as string;

    const operations = await db.horizonOperation.findMany({
      where,
      include: {
        transaction: true,
        effects: true,
        events: true
      },
      orderBy: { ingestedAt: 'desc' },
      take: Math.min(parseInt(limit as string), 200),
      skip: parseInt(offset as string)
    });

    const total = await db.horizonOperation.count({ where });

    res.json({
      success: true,
      data: operations,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + operations.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Effects API
router.get('/effects', async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const {
      operationId,
      transactionHash,
      account,
      type,
      limit = '50',
      offset = '0'
    } = req.query;

    const where: any = {};
    if (operationId) where.operationId = operationId as string;
    if (transactionHash) where.transactionHash = transactionHash as string;
    if (account) where.account = account as string;
    if (type) where.type = type as string;

    const effects = await db.horizonEffect.findMany({
      where,
      include: {
        operation: true,
        transaction: true
      },
      orderBy: { ingestedAt: 'desc' },
      take: Math.min(parseInt(limit as string), 200),
      skip: parseInt(offset as string)
    });

    const total = await db.horizonEffect.count({ where });

    res.json({
      success: true,
      data: effects,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + effects.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Contract Data API
router.get('/contract-data', async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const {
      contractId,
      key,
      durability,
      latest = 'true',
      limit = '50',
      offset = '0'
    } = req.query;

    const where: any = {};
    if (contractId) where.contractId = contractId as string;
    if (key) where.key = key as string;
    if (durability) where.durability = durability as string;
    if (latest === 'true') where.isDeleted = false;

    let contractData;
    if (latest === 'true') {
      // Get latest version of each key
      contractData = await db.horizonContractData.findMany({
        where,
        orderBy: { ledger: 'asc' as const },
        take: Math.min(parseInt(limit as string), 200),
        skip: parseInt(offset as string),
        distinct: ['contractId', 'key']
      });
    } else {
      // Get all historical versions
      contractData = await db.horizonContractData.findMany({
        where,
        orderBy: { ledger: 'desc' },
        take: Math.min(parseInt(limit as string), 200),
        skip: parseInt(offset as string)
      });
    }

    const total = await db.horizonContractData.count({ where });

    res.json({
      success: true,
      data: contractData,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + contractData.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Accounts API
router.get('/accounts', async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const {
      accountId,
      isContract,
      limit = '50',
      offset = '0'
    } = req.query;

    const where: any = {};
    if (accountId) where.accountId = accountId as string;
    if (isContract !== undefined) where.isContract = isContract === 'true';

    const accounts = await db.horizonAccount.findMany({
      where,
      orderBy: { lastActivity: 'desc' },
      take: Math.min(parseInt(limit as string), 200),
      skip: parseInt(offset as string)
    });

    const total = await db.horizonAccount.count({ where });

    res.json({
      success: true,
      data: accounts,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + accounts.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Payments API  
router.get('/payments', async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const {
      from,
      to,
      transactionHash,
      limit = '50',
      offset = '0'
    } = req.query;

    const where: any = {};
    if (from) where.from = from as string;
    if (to) where.to = to as string;
    if (transactionHash) where.transactionHash = transactionHash as string;

    const payments = await db.horizonPayment.findMany({
      where,
      include: {
        transaction: true
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(parseInt(limit as string), 200),
      skip: parseInt(offset as string)
    });

    const total = await db.horizonPayment.count({ where });

    res.json({
      success: true,
      data: payments,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + payments.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 