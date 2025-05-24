import { MongoClient, ObjectId, Db } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({}); 

interface EventWithTransaction {
  event: any; // Define more specific types based on actual event structure
  transactionDetails: any; // Define more specific types for transaction details
}

export class DatabaseClient {
  private mongoUri: string;
  private dbName: string;
  private client: MongoClient;

  constructor() {
    const mongoUriFromEnv = process.env.MONGODB_URI;
    if (!mongoUriFromEnv) {
      console.error('[ERROR] MONGODB_URI is not defined in environment variables.');
      throw new Error('MONGODB_URI is not defined');
    }
    this.mongoUri = mongoUriFromEnv;
    this.dbName = process.env.MONGO_DB_NAME || new URL(this.mongoUri).pathname.substring(1) || 'horizon_dev';
    this.client = new MongoClient(this.mongoUri);
    console.log(`[INFO] DatabaseClient initialized. Target DB: ${this.dbName}`);
  }

  public async getDb(): Promise<Db> {
    // MongoClient.connect() is idempotent if already connected or connecting
    await this.client.connect(); 
    return this.client.db(this.dbName);
  }

  public async disconnect(): Promise<void> {
    // MongoClient.close() will no-op if not connected.
    await this.client.close();
    console.debug('[DEBUG] MongoDB client disconnected or was already disconnected.');
  }

  public async getLastProcessedLedger(): Promise<number> {
    console.debug('[DEBUG] Attempting to fetch last processed ledger from DB (MongoDB).');
    try {
      const db = await this.getDb();
      const metadataCollection = db.collection('Metadata');
      const metadata = await metadataCollection.findOne({ key: 'lastProcessedLedgerMeta' });
      const ledger = metadata ? Number(metadata.value) : 0;
      console.log(`[INFO] Fetched last processed ledger: ${ledger} (MongoDB).`);
      return ledger;
    } catch (error) {
      console.error('[ERROR] Error fetching last processed ledger from DB (MongoDB):', error);
      return 0; // Fallback to 0 in case of error
    }
  }

  public async updateLastProcessedLedger(ledgerSequence: number): Promise<void> {
    console.debug(`[DEBUG] Attempting to upsert lastProcessedLedgerMeta to ${ledgerSequence} in DB (MongoDB).`);
    try {
      const db = await this.getDb();
      const metadataCollection = db.collection('Metadata');
      await metadataCollection.updateOne(
        { key: 'lastProcessedLedgerMeta' },
        { $set: { value: ledgerSequence } },
        { upsert: true }
      );
      console.log(`[INFO] Successfully upserted lastProcessedLedger in DB to: ${ledgerSequence} (MongoDB).`);
    } catch (error) {
      console.error('[ERROR] Error updating last processed ledger in DB (MongoDB):', error);
    }
  }

  public async storeEventsAndTransactions(eventsWithTransactions: EventWithTransaction[]): Promise<void> {
    console.debug(
      `[DEBUG] storeEventsAndTransactions (MongoDB) called with ${eventsWithTransactions.length} items at ${new Date().toISOString()}`
    );
    if (eventsWithTransactions.length === 0) {
      console.debug('[DEBUG] No events to store (MongoDB), exiting function.');
      return;
    }

    console.info(`[INFO] Attempting to process and store ${eventsWithTransactions.length} event-transaction groups (MongoDB).`);
    const db = await this.getDb(); // Ensure client is connected before starting a session
    const transactionsCollection = db.collection('ContractTransaction');
    const eventsCollection = db.collection('ContractEvent');

    let successfulGroups = 0;
    let failedGroups = 0;

    for (const item of eventsWithTransactions) {
      const event = item.event;
      const transactionDetails = item.transactionDetails;
      const txHash = event?.txHash;

      if (!txHash) {
        console.warn('[WARN] Event item found without a txHash (MongoDB), skipping:', event?.id);
        failedGroups++;
        continue;
      }
      if (!transactionDetails) {
        console.warn(`[WARN] No transactionDetails for txHash ${txHash} (MongoDB), skipping event: ${event?.id}.`);
        failedGroups++;
        continue;
      }
      
      const session = this.client.startSession();
      try {
        console.debug(`[DEBUG] Starting MongoDB session for txHash: ${txHash}`);
        await session.withTransaction(async () => {
          const transactionDoc = {
            txHash: txHash,
            status: transactionDetails.status || 'UNKNOWN',
            ledger: parseInt(transactionDetails.ledger, 10),
            createdAt: new Date(parseInt(transactionDetails.createdAt, 10) * 1000),
            applicationOrder: transactionDetails.applicationOrder,
            feeBump: transactionDetails.feeBump || false,
            envelopeXdr: transactionDetails.envelopeXdr,
            resultXdr: transactionDetails.resultXdr,
            resultMetaXdr: transactionDetails.resultMetaXdr,
            diagnosticEventsXdr: transactionDetails.diagnosticEventsXdr || [],
            latestLedgerRpc: parseInt(transactionDetails.latestLedger, 10),
            latestLedgerCloseTimeRpc: new Date(parseInt(transactionDetails.latestLedgerCloseTime, 10) * 1000),
            oldestLedgerRpc: parseInt(transactionDetails.oldestLedger, 10),
            oldestLedgerCloseTimeRpc: new Date(parseInt(transactionDetails.oldestLedgerCloseTime, 10) * 1000),
            ingestedAt: new Date(),
          };

          console.debug(`[DEBUG] Upserting ContractTransaction for txHash: ${txHash} (MongoDB)`);
          await transactionsCollection.updateOne(
            { txHash: txHash }, 
            { $set: transactionDoc }, 
            { upsert: true, session }
          );
          console.debug(`[DEBUG] Upserted ContractTransaction for txHash: ${txHash} (MongoDB)`);

          const eventDoc = {
            eventId: event.id,
            type: event.type,
            ledger: parseInt(event.ledger, 10),
            ledgerClosedAt: new Date(event.ledgerClosedAt),
            contractId: event.contractId,
            pagingToken: event.pagingToken,
            inSuccessfulContractCall: event.inSuccessfulContractCall,
            topics: event.topic || [],
            value: event.value,
            transactionTxHash: txHash, 
            ingestedAt: new Date(),
          };
          console.debug(`[DEBUG] Inserting ContractEvent for eventId: ${event.id} (MongoDB)`);
          await eventsCollection.insertOne(eventDoc, { session });
          console.debug(`[DEBUG] Inserted ContractEvent for eventId: ${event.id} (MongoDB)`);
        });
        console.log(`[INFO] Successfully processed and stored transaction ${txHash} and its event ${event.id} (MongoDB).`);
        successfulGroups++;
      } catch (error) {
        console.error(`[ERROR] Failed to store transaction ${txHash} and event ${event.id} via MongoDB session:`, error);
        failedGroups++;
      } finally {
        await session.endSession();
        console.debug(`[DEBUG] Ended MongoDB session for txHash: ${txHash}`);
      }
    }
    console.log(`[INFO] Finished storing events (MongoDB). Successful groups: ${successfulGroups}, Failed groups: ${failedGroups}.`);
  }
}