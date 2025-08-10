import { Router, Request, Response } from 'express';
import { ingestQueue } from '../common/queue';
import { getRpcHealth, getLatestRPCLedgerIndex } from '../repository/rpc.repository';
import { getLastProcessedLedgerFromDB, getDB } from '../common/db';
import { connectToPostgreSQL } from '../common/prisma';
import { STELLAR_NETWORK, CONTRACT_ID_TO_INDEX } from '../common/constants';

const router = Router();

router.get('/queue/status', async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, queue: ingestQueue.getStatus() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/health', async (req: Request, res: Response) => {
  console.log('---------------- HEALTH CHECK REQUEST (system.router.ts) ----------------');
  let dbStatus = 'disconnected';
  let rpcStatus = 'unknown';
  let lastLedgerDb = 0;
  let dbConnectionAttempted = false;

  try {
    let db = await getDB();
    if (db) {
      try {
        await db.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
        lastLedgerDb = await getLastProcessedLedgerFromDB();
      } catch (dbPingErr: any) {
        console.warn('Health check: PostgreSQL ping failed after DB instance succeeded.', dbPingErr.message);
        dbStatus = 'ping_failed';
      }
    } else {
      console.warn('Health check: DB instance undefined. Attempting explicit connect.');
      dbConnectionAttempted = true;
      const connected = await connectToPostgreSQL();
      if (connected) {
        db = await getDB(); // try getting it again
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
             console.warn('Health check: DB still undefined after explicit reconnect attempt.');
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

export default router; 