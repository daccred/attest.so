import { MongoClient, Db, Collection } from 'mongodb';
import { MONGODB_URI } from './constants';

let db: Db | undefined;
let metadataCollection: Collection | undefined;
let eventsCollection: Collection | undefined;

export async function connectToMongoDB(): Promise<boolean> {
  if (!MONGODB_URI) {
    console.error('MongoDB URI is not defined. Please set MONGODB_URI environment variable.');
    if (process.env.NODE_ENV !== 'test') {
        console.error("CRITICAL: MongoDB URI not set, indexer will not function.")
    }
    db = undefined;
    metadataCollection = undefined;
    eventsCollection = undefined;
    return false;
  }
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();

    db = client.db('horizon_indexer');
    metadataCollection = db.collection('metadata');
    eventsCollection = db.collection('contract_events');
    console.log('Successfully connected to MongoDB.');

    return true;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    db = undefined;
    metadataCollection = undefined;
    eventsCollection = undefined;
    return false;
  }
}

// Connect to DB when module is loaded
connectToMongoDB();

export async function getDbInstance(): Promise<Db | undefined> {
    if (!db) {
        console.warn("getDbInstance called before DB connection was established or connection failed. Attempting to reconnect...");
        await connectToMongoDB();
    }
    return db;
}

export async function getLastProcessedLedgerFromDB(): Promise<number> {
  if (!metadataCollection) {
    console.warn('getLastProcessedLedgerFromDB: MongoDB metadataCollection not initialized. Attempting to connect to DB.');
    await connectToMongoDB();
    if (!metadataCollection) {
        console.error('Failed to initialize metadataCollection after reconnect attempt.');
        return 0;
    }
  }
  try {
    const metadata = await metadataCollection.findOne({ key: 'lastProcessedLedgerMeta' });
    return metadata ? (metadata.value as number) : 0;
  } catch (error) {
    console.error('Error fetching last processed ledger from DB:', error);
    return 0;
  }
}

export async function updateLastProcessedLedgerInDB(ledgerSequence: number) {
  if (!metadataCollection) {
    console.warn('updateLastProcessedLedgerInDB: MongoDB metadataCollection not initialized. Attempting to connect to DB.');
    await connectToMongoDB();
    if (!metadataCollection) {
        console.error('Cannot update last processed ledger, metadataCollection still not initialized.');
        return;
    }
  }
  try {
    await metadataCollection.updateOne(
      { key: 'lastProcessedLedgerMeta' },
      { $set: { value: ledgerSequence, key: 'lastProcessedLedgerMeta' } },
      { upsert: true }
    );
    console.log(`Updated lastProcessedLedger in DB to: ${ledgerSequence}`);
  } catch (error) {
    console.error('Error updating last processed ledger in DB:', error);
  }
}

export async function storeEventsAndTransactionsInDB(eventsWithTransactions: any[]) {
  console.debug(
    `[DEBUG] storeEventsAndTransactionsInDB called with ${eventsWithTransactions.length} items at ${new Date().toISOString()}`
  );

  if (!eventsCollection) {
    console.warn('storeEventsAndTransactionsInDB: MongoDB eventsCollection not initialized. Attempting to connect to DB.');
    await connectToMongoDB();
    if (!eventsCollection) {
        console.error('Cannot store events, eventsCollection still not initialized.');
        return;
    }
  }
  if (eventsWithTransactions.length === 0) {
    console.debug('[DEBUG] No events to store, exiting function.');
    return;
  }

  const operations = eventsWithTransactions.map((item) => ({
    updateOne: {
      filter: { eventId: item.event.id }, // Assuming event.id is unique and suitable as eventId
      update: { $set: { ...item, ingestedAt: new Date() } },
      upsert: true,
    },
  }));

  console.debug(
    `[DEBUG] Prepared ${operations.length} bulk operations for MongoDB at ${new Date().toISOString()}`
  );

  try {
    const result = await eventsCollection.bulkWrite(operations);
    console.log(
      `[DEBUG] MongoDB bulkWrite response: ${JSON.stringify(result, null, 2)}`
    );
    console.log(
      `Stored ${result.upsertedCount + result.modifiedCount} event-transaction pairs. New: ${result.upsertedCount}, Updated: ${result.modifiedCount}`
    );
  } catch (error) {
    console.error('[DEBUG] Error storing event-transaction pairs in MongoDB:', error);
  }
}