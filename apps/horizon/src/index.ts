import app from './app'
import { CONTRACT_IDS_TO_INDEX } from './common/constants';
import { getLastProcessedLedgerFromDB } from './common/db';
import { ingestQueue } from './common/queue';

const port = process.env.PORT || 3001
app.listen(port, () => {
  /* eslint-disable no-console */
  console.log(`Listening: http://localhost:${port}`)
  /* eslint-enable no-console */
})
ingestQueue.start();
/**
 * Enqueue a recurring ingestion job for the latest ledger.
 * This is used to ensure that the horizon is always up to date after a restart.
 */
getLastProcessedLedgerFromDB().then((lastProcessedLedger) => {
  ingestQueue.enqueueRecurringIngestion(CONTRACT_IDS_TO_INDEX, lastProcessedLedger)
})
