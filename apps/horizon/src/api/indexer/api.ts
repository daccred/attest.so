import express, { Request, Response, Router } from 'express';
import { 
  fetchAndStoreEvents, 
  getRpcHealth, 
  getLatestRPCLedgerIndex,
  fetchComprehensiveContractData,
  fetchOperationsFromHorizon,
  fetchEffectsFromHorizon,
  fetchAccountFromHorizon,
  fetchPaymentsFromHorizon
} from './ledger';
import { 
  getLastProcessedLedgerFromDB, 
  connectToPostgreSQL, 
  getDbInstance,
  storeOperationsInDB,
  storeEffectsInDB,
  storeAccountsInDB,
  storePaymentsInDB
} from './db';
import { STELLAR_NETWORK, CONTRACT_ID_TO_INDEX } from './constants';

const router = Router();

router.post('/events/ingest', async (req: Request, res: Response) => {
  try {
    const startLedgerParam = req.body.startLedger;
    let startLedgerFromRequest: number | undefined = undefined;

    if (startLedgerParam !== undefined) {
      startLedgerFromRequest = parseInt(startLedgerParam);
      if (isNaN(startLedgerFromRequest)) {
        return res.status(400).json({ error: 'Invalid startLedger parameter. Must be a number.' });
      }
    }

    // Non-blocking: Trigger ingestion, don't wait for it to complete for HTTP response.
    fetchAndStoreEvents(startLedgerFromRequest)
      .then(result => console.log("Background event ingestion triggered from API completed successfully.", result))
      .catch(err => console.error("Background event ingestion triggered from API failed with error:", err.message));

    res.status(202).json({
      success: true,
      message: `Event ingestion process initiated. Requested start ledger: ${startLedgerFromRequest === undefined ? 'latest from DB/default' : startLedgerFromRequest}. Check server logs for progress.`,
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to initiate event ingestion' });
  }
});

router.get('/health', async (req: Request, res: Response) => {
  console.log('---------------- HEALTH CHECK REQUEST (api.ts) ----------------');
  let dbStatus = 'disconnected';
  let rpcStatus = 'unknown';
  let lastLedgerDb = 0;
  let dbConnectionAttempted = false;

  try {
    let db = await getDbInstance();
    if (db) {
      try {
        await db.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
        lastLedgerDb = await getLastProcessedLedgerFromDB();
      } catch (dbPingErr: any) {
        console.warn('Health check: PostgreSQL ping failed after getDbInstance succeeded.', dbPingErr.message);
        dbStatus = 'ping_failed';
      }
    } else {
      console.warn('Health check: getDbInstance returned undefined. Attempting explicit connect.');
      dbConnectionAttempted = true;
      const connected = await connectToPostgreSQL();
      if (connected) {
        db = await getDbInstance(); // try getting it again
        if (db) {
            try {
                await db.$queryRaw`SELECT 1`;
                dbStatus = 'connected_after_retry';
                lastLedgerDb = await getLastProcessedLedgerFromDB();
            } catch (dbPingRetryErr: any) {
                console.warn('Health check: PostgreSQL ping failed after explicit reconnect attempt.', dbPingRetryErr.message);
                dbStatus = 'ping_failed_after_retry';
            }
        } else {
             console.warn('Health check: getDbInstance still undefined after explicit reconnect attempt.');
             dbStatus = 'reconnect_attempt_db_undefined';
        }
      } else {
        console.warn('Health check: Explicit connectToPostgreSQL call failed.');
        dbStatus = 'reconnect_failed';
      }
    }

    rpcStatus = await getRpcHealth();
    const latestRPCLedger = await getLatestRPCLedgerIndex();
    res.status(200).json({
      status: 'ok',
      database_status: dbStatus,
      soroban_rpc_status: rpcStatus,
      network: STELLAR_NETWORK,
      latest_rpc_ledger: latestRPCLedger || 'Not Available',
      indexing_contract: CONTRACT_ID_TO_INDEX || 'Not Set',
      last_processed_ledger_in_db: lastLedgerDb,
      db_connection_explicitly_attempted_in_health_check: dbConnectionAttempted
    });
  } catch (error: any) {
    console.error("Health check critical error:", error.message);
    res.status(500).json({
      status: 'error',
      database_status: dbStatus,
      soroban_rpc_status: rpcStatus,
      error: error.message,
      db_connection_explicitly_attempted_in_health_check: dbConnectionAttempted
    });
  }
  console.log('------------------------------------------------------');
});

// Contract Events API
router.get('/events', async (req: Request, res: Response) => {
  try {
    const db = await getDbInstance();
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
      orderBy: { timestamp: 'desc' },
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
    const db = await getDbInstance();
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
    const db = await getDbInstance();
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
    const db = await getDbInstance();
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
    const db = await getDbInstance();
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
        orderBy: { ledger: 'desc' },
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
    const db = await getDbInstance();
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
    const db = await getDbInstance();
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

// Analytics API
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const db = await getDbInstance();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const {
      contractId,
      timeframe = '24h'
    } = req.query;

    // Calculate time range
    const now = new Date();
    const timeRanges: { [key: string]: Date } = {
      '1h': new Date(now.getTime() - 60 * 60 * 1000),
      '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    };

    const startTime = timeRanges[timeframe as string] || timeRanges['24h'];
    
    const where: any = {
      timestamp: { gte: startTime }
    };
    if (contractId) where.contractId = contractId as string;

    // Get analytics data
    const [
      totalEvents,
      totalTransactions,
      successfulTxs,
      eventsByType,
      transactionVolume
    ] = await Promise.all([
      db.horizonEvent.count({ where }),
      db.horizonTransaction.count({
        where: {
          timestamp: { gte: startTime },
          ...(contractId && { events: { some: { contractId: contractId as string } } })
        }
      }),
      db.horizonTransaction.count({
        where: {
          timestamp: { gte: startTime },
          successful: true,
          ...(contractId && { events: { some: { contractId: contractId as string } } })
        }
      }),
      db.horizonEvent.groupBy({
        by: ['eventType'],
        where,
        _count: { eventType: true }
      }),
      db.horizonTransaction.aggregate({
        where: {
          timestamp: { gte: startTime },
          ...(contractId && { events: { some: { contractId: contractId as string } } })
        },
        _avg: { fee: true },
        _sum: { fee: true }
      })
    ]);

    res.json({
      success: true,
      timeframe,
      data: {
        summary: {
          totalEvents,
          totalTransactions,
          successfulTransactions: successfulTxs,
          successRate: totalTransactions > 0 ? (successfulTxs / totalTransactions * 100).toFixed(2) + '%' : '0%'
        },
        eventsByType: eventsByType.map(et => ({
          type: et.eventType,
          count: et._count.eventType
        })),
        fees: {
          average: transactionVolume._avg.fee,
          total: transactionVolume._sum.fee
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Comprehensive Data Ingest API
router.post('/comprehensive/ingest', async (req: Request, res: Response) => {
  try {
    const startLedgerParam = req.body.startLedger;
    let startLedgerFromRequest: number | undefined = undefined;

    if (startLedgerParam !== undefined) {
      startLedgerFromRequest = parseInt(startLedgerParam);
      if (isNaN(startLedgerFromRequest)) {
        return res.status(400).json({ error: 'Invalid startLedger parameter. Must be a number.' });
      }
    }

    // Non-blocking: Trigger comprehensive data ingestion
    fetchComprehensiveContractData(startLedgerFromRequest)
      .then(async (result) => {
        console.log("Comprehensive data ingestion completed:", {
          events: result.events.length,
          operations: result.operations.length,
          effects: result.effects.length,
          accounts: result.accounts.length,
          payments: result.payments.length,
          contractData: result.contractData.length
        });

        // Store additional data types
        if (result.operations.length > 0) {
          await storeOperationsInDB(result.operations);
        }
        if (result.effects.length > 0) {
          await storeEffectsInDB(result.effects);
        }
        if (result.accounts.length > 0) {
          await storeAccountsInDB(result.accounts);
        }
        if (result.payments.length > 0) {
          await storePaymentsInDB(result.payments);
        }
      })
      .catch(err => console.error("Comprehensive data ingestion failed:", err.message));

    res.status(202).json({
      success: true,
      message: `Comprehensive data ingestion initiated. Requested start ledger: ${startLedgerFromRequest === undefined ? 'latest from DB/default' : startLedgerFromRequest}. Check server logs for progress.`,
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to initiate comprehensive data ingestion' });
  }
});

// Real-time Activity Feed API
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const db = await getDbInstance();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const {
      contractId,
      accountId,
      limit = '20',
      includeTransactions = 'true',
      includeEvents = 'true',
      includePayments = 'true'
    } = req.query;

    const activities: any[] = [];

    // Fetch recent events
    if (includeEvents === 'true') {
      const where: any = {};
      if (contractId) where.contractId = contractId as string;
      
      const events = await db.horizonEvent.findMany({
        where,
        include: { transaction: true },
        orderBy: { timestamp: 'desc' },
        take: Math.min(parseInt(limit as string), 50)
      });

      activities.push(...events.map(e => ({
        type: 'event',
        id: e.eventId,
        timestamp: e.timestamp,
        contractId: e.contractId,
        eventType: e.eventType,
        data: e.eventData,
        transaction: e.transaction
      })));
    }

    // Fetch recent transactions
    if (includeTransactions === 'true') {
      const where: any = {};
      if (contractId) where.events = { some: { contractId: contractId as string } };
      if (accountId) where.sourceAccount = accountId as string;

      const transactions = await db.horizonTransaction.findMany({
        where,
        include: { events: true, operations: true },
        orderBy: { timestamp: 'desc' },
        take: Math.min(parseInt(limit as string), 50)
      });

      activities.push(...transactions.map(t => ({
        type: 'transaction',
        id: t.hash,
        timestamp: t.timestamp,
        sourceAccount: t.sourceAccount,
        successful: t.successful,
        fee: t.fee,
        operationCount: t.operationCount,
        events: t.events,
        operations: t.operations
      })));
    }

    // Fetch recent payments
    if (includePayments === 'true' && accountId) {
      const payments = await db.horizonPayment.findMany({
        where: {
          OR: [
            { from: accountId as string },
            { to: accountId as string }
          ]
        },
        include: { transaction: true },
        orderBy: { timestamp: 'desc' },
        take: Math.min(parseInt(limit as string), 50)
      });

      activities.push(...payments.map(p => ({
        type: 'payment',
        id: p.paymentId,
        timestamp: p.timestamp,
        from: p.from,
        to: p.to,
        asset: p.asset,
        amount: p.amount,
        transaction: p.transaction
      })));
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      data: activities.slice(0, parseInt(limit as string)),
      count: activities.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;