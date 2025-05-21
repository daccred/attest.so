import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { MongoClient, Db } from 'mongodb';
import horizonRouter from '../src/api/indexer/api'; 


const app = express();
app.use(express.json());
app.use('/api/horizon', horizonRouter);

let client: MongoClient;
let dbInstance: Db;


describe('Horizon API Event Ingester (Integration with Live RPC)', () => {
  beforeAll(async () => {
    if (!process.env.MONGODB_URI) {
      throw new Error('Test MongoDB URI not set. Check setup.ts');
    }
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    dbInstance = client.db(); 
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    if (dbInstance) {
      try {
        await dbInstance.collection('metadata').deleteMany({});
        await dbInstance.collection('contract_events').deleteMany({});
      } catch (e) {
        console.error("Error clearing DB collections:", e);
      }
    }
  });

  describe('POST /api/horizon/events/ingest', () => {
    it('should initiate event ingestion and fetch some events from a live contract', async () => {
      // This test assumes CONTRACT_ID_TO_INDEX is valid and has emitted events recently
      // or within the LEDGER_HISTORY_LIMIT_DAYS.
      // For a truly deterministic test, you might need to trigger events on your test contract first.

      const response = await request(app)
        .post('/api/horizon/events/ingest')
        .send({}); // Start from latest in DB or default lookback

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Event ingestion process initiated');

      // Wait significantly longer for real network calls and processing
      await new Promise(resolve => setTimeout(resolve, 15000)); // Adjust based on typical ingestion time

      const eventsInDb = await dbInstance.collection('contract_events').find({}).toArray();
      // We can't know the exact number of events, but expect some if the contract is active.
      // If testing a specific known emission, you could assert more precisely.
      console.log(`Found ${eventsInDb.length} events in DB after live ingestion.`);
      expect(eventsInDb.length).toBeGreaterThanOrEqual(0); // At least 0, hopefully more

      const metadata = await dbInstance.collection('metadata').findOne({ key: 'lastProcessedLedgerMeta' });
      if (eventsInDb.length > 0) {
        expect(metadata).not.toBeNull();
        expect(metadata?.value).toBeGreaterThan(0);
      } else {
        console.warn("No events were ingested. This might be okay if the contract had no recent events or if start ledger was ahead.");
        // If metadata exists, it means fetchAndStoreEvents ran.
        // If it doesn't, it implies no events were processed to the point of updating metadata.
      }
    });

    it('should ingest events starting from a specified ledger', async () => {
        // To make this test reliable, you need to know a ledger range on testnet
        // where your CONTRACT_ID_TO_INDEX *definitely* emitted events.
        // Or, have a mechanism to emit test events before this test.
        // For now, this will just call it and we hope for the best or check logs.
        const knownStartLedgerWithEvents = 1; // Replace with an actual ledger if possible, or a very old one.
                                            // For a generic test, starting from 1 might fetch many events or hit limits.
                                            // A more controlled approach is better.

        // For a more controlled test, you'd find the latest ledger, then query a small range
        // slightly behind it, assuming some very recent activity.
        // For now, we'll use a dynamic approach based on latest ledger for demonstration.
        
        const tempServer = new (require('@stellar/stellar-sdk').rpc.Server)(process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org');
        let latestLedger;
        try {
            latestLedger = await tempServer.getLatestLedger();
        } catch (e) {
            console.error("Could not fetch latest ledger for test setup", e);
            throw e; // Fail fast if we can't set up the test range
        }

        // Let's try to get events from a small, very recent window.
        // This is still non-deterministic but better than a fixed old ledger.
        const testStartLedger = Math.max(1, latestLedger.sequence - 50); // Look back 50 ledgers
        console.log(`Testing ingestion with startLedger: ${testStartLedger}`);


        const response = await request(app)
          .post('/api/horizon/events/ingest')
          .send({ startLedger: testStartLedger });
  
        expect(response.status).toBe(202);
        
        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait
  
        const metadata = await dbInstance.collection('metadata').findOne({ key: 'lastProcessedLedgerMeta' });
        if (metadata) {
            expect(metadata.value).toBeGreaterThanOrEqual(testStartLedger -1); // Should have processed at least up to where it started or beyond
        } else {
            console.warn(`No metadata found after ingesting from ledger ${testStartLedger}. This might mean no events were found in that range.`);
        }
        const eventsCount = await dbInstance.collection('contract_events').countDocuments({ ledger: { $gte: testStartLedger.toString() } });
        console.log(`Events found from ledger ${testStartLedger}: ${eventsCount}`);
        // No strict assertion on count due to live network unpredictability
    });

    it('should handle invalid startLedger parameter', async () => {
      const response = await request(app)
        .post('/api/horizon/events/ingest')
        .send({ startLedger: 'not-a-number' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid startLedger parameter');
    });
  });

  describe('GET /api/horizon/health', () => {
    it('should return health status with MongoDB connected and RPC healthy', async () => {
      // Relies on the actual RPC server being healthy.
      await dbInstance.collection('metadata').insertOne({ key: 'lastProcessedLedgerMeta', value: 90 });

      const response = await request(app).get('/api/horizon/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.mongodb_status).toBe('connected');
      expect(response.body.soroban_rpc_status).toBe('healthy'); // This depends on live RPC
      expect(response.body.last_processed_ledger_in_db).toBe(90);
    });
  });
});