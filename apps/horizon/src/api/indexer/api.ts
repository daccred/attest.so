import { Request, Response, Router } from 'express';
import { fetchAndStoreEvents, getLatestRPCLedgerIndex, getRpcHealth } from './ledger';
import { getLastProcessedLedgerFromDB } from './db';
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
  let lastLedgerDb = 0;
  let rpcStatus = 'unknown';
  try {
    lastLedgerDb = await getLastProcessedLedgerFromDB();
    rpcStatus = await getRpcHealth();
    const latestRPCLedger = await getLatestRPCLedgerIndex();
    res.status(200).json({
      status: 'ok',
      soroban_rpc_status: rpcStatus,
      network: STELLAR_NETWORK,
      latest_rpc_ledger: latestRPCLedger || 'Not Available',
      indexing_contract: CONTRACT_ID_TO_INDEX || 'Not Set',
      last_processed_ledger_in_db: lastLedgerDb
    });
  } catch (error: any) {
    console.error("Health check critical error:", error.message);
    res.status(500).json({
      status: 'error',
      soroban_rpc_status: rpcStatus,
      error: error.message
    });
  }
  console.log('------------------------------------------------------');
});


export default router; 