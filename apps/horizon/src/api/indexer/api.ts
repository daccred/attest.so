import express, { Request, Response, Router } from 'express';
import { fetchAndStoreEvents, getLatestRPCLedgerIndex, getRpcHealth } from './ledger';
import { getLastProcessedLedgerFromDB, connectToMongoDB, getDbInstance } from './db';
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
  let mongoStatus = 'disconnected';
  let rpcStatus = 'unknown';
  let lastLedgerDb = 0;
  let dbConnectionAttempted = false;

  try {
    let db = await getDbInstance();
    if (db) {
      try {
        await db.command({ ping: 1 });
        mongoStatus = 'connected';
        lastLedgerDb = await getLastProcessedLedgerFromDB();
      } catch (mongoPingErr: any) {
        console.warn('Health check: MongoDB ping failed after getDbInstance succeeded.', mongoPingErr.message);
        mongoStatus = 'ping_failed';
      }
    } else {
      console.warn('Health check: getDbInstance returned undefined. Attempting explicit connect.');
      dbConnectionAttempted = true;
      const connected = await connectToMongoDB();
      if (connected) {
        db = await getDbInstance(); // try getting it again
        if (db) {
            try {
                await db.command({ ping: 1 });
                mongoStatus = 'connected_after_retry';
                lastLedgerDb = await getLastProcessedLedgerFromDB();
            } catch (mongoPingRetryErr: any) {
                console.warn('Health check: MongoDB ping failed after explicit reconnect attempt.', mongoPingRetryErr.message);
                mongoStatus = 'ping_failed_after_retry';
            }
        } else {
             console.warn('Health check: getDbInstance still undefined after explicit reconnect attempt.');
             mongoStatus = 'reconnect_attempt_db_undefined';
        }
      } else {
        console.warn('Health check: Explicit connectToMongoDB call failed.');
        mongoStatus = 'reconnect_failed';
      }
    }

    rpcStatus = await getRpcHealth();
    const latestRPCLedger = await getLatestRPCLedgerIndex();

    res.status(200).json({
      status: 'ok',
      mongodb_status: mongoStatus,
      soroban_rpc_status: rpcStatus,
      latest_rpc_ledger: latestRPCLedger || 'Not Available',
      indexing_contract: CONTRACT_ID_TO_INDEX || 'Not Set',
      last_processed_ledger_in_db: lastLedgerDb,
      db_connection_explicitly_attempted_in_health_check: dbConnectionAttempted
    });
  } catch (error: any) {
    console.error("Health check critical error:", error.message);
    res.status(500).json({
      status: 'error',
      mongodb_status: mongoStatus,
      soroban_rpc_status: rpcStatus,
      error: error.message,
      db_connection_explicitly_attempted_in_health_check: dbConnectionAttempted
    });
  }
  console.log('------------------------------------------------------');
});


export default router; 