import express, { Request, Response, Router } from 'express';
import { fetchAndStoreEvents, getRpcHealth } from './ledger';
import { getLastProcessedLedgerFromDB, connectToPostgreSQL, getDbInstance } from './db';
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

    res.status(200).json({
      status: 'ok',
      database_status: dbStatus,
      soroban_rpc_status: rpcStatus,
      network: STELLAR_NETWORK,
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