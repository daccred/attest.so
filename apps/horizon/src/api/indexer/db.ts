import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | undefined;

export async function connectToPostgreSQL(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL is not defined. Please set DATABASE_URL environment variable.');
    if (process.env.NODE_ENV !== 'test') {
      console.error("CRITICAL: DATABASE_URL not set, indexer will not function.")
    }
    prisma = undefined;
    return false;
  }
  
  try {
    const enablePrismaDebug =
      process.env.PRISMA_DEBUG === '1' ||
      process.env.PRISMA_DEBUG === 'true' ||
      process.env.NODE_ENV === 'development';

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      },
      log: enablePrismaDebug
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['error']
    });

    if (enablePrismaDebug) {
      (prisma as any).$on('query', (e: any) => {
        console.debug(`[prisma] ${e.duration}ms ${e.query}`, e.params);
      });
    }
    
    // Test the connection
    await prisma.$connect();
    console.log('Successfully connected to PostgreSQL.');
    
    return true;
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
    prisma = undefined;
    return false;
  }
}

// Connect to DB when module is loaded
connectToPostgreSQL();

export async function getDbInstance(): Promise<PrismaClient | undefined> {
  if (!prisma) {
    console.warn("getDbInstance called before DB connection was established or connection failed. Attempting to reconnect...");
    await connectToPostgreSQL();
  }
  return prisma;
}

export async function getLastProcessedLedgerFromDB(): Promise<number> {
  const db = await getDbInstance();
  if (!db) {
    console.error('Failed to get database instance.');
    return 0;
  }
  
  try {
    const metadata = await db.metadata.findUnique({
      where: { key: 'lastProcessedLedgerMeta' }
    });
    return metadata ? parseInt(metadata.value) : 0;
  } catch (error) {
    console.error('Error fetching last processed ledger from DB:', error);
    return 0;
  }
}

export async function updateLastProcessedLedgerInDB(ledgerSequence: number) {
  const db = await getDbInstance();
  if (!db) {
    console.error('Cannot update last processed ledger, database not initialized.');
    return;
  }
  
  try {
    await db.metadata.upsert({
      where: { key: 'lastProcessedLedgerMeta' },
      update: { value: ledgerSequence.toString() },
      create: { 
        key: 'lastProcessedLedgerMeta',
        value: ledgerSequence.toString()
      }
    });
    console.log(`Updated lastProcessedLedger in DB to: ${ledgerSequence}`);
  } catch (error) {
    console.error('Error updating last processed ledger in DB:', error);
  }
}

export async function storeEventsAndTransactionsInDB(eventsWithTransactions: any[]) {
  const db = await getDbInstance();
  if (!db) {
    console.error('Cannot store events, database not initialized.');
    return;
  }
  
  if (eventsWithTransactions.length === 0) return;

  try {
    // Process events in a transaction for consistency
    const results = await db.$transaction(async (prismaTx) => {
      const operations = eventsWithTransactions.map(async (item) => {
        const ev: any = item.event || {};
        const txDetails: any = item.transactionDetails || item.transaction || {};

        const ledgerNumber = typeof ev.ledger === 'string' ? parseInt(ev.ledger, 10) : ev.ledger;
        const eventTimestamp = ev.timestamp || ev.ledgerClosedAt;

        const eventData = {
          eventId: ev.id,
          ledger: Number.isFinite(ledgerNumber) ? ledgerNumber : 0,
          timestamp: eventTimestamp ? new Date(eventTimestamp) : new Date(),
          contractId: ev.contractId || '',
          eventType: ev.type || 'unknown',
          eventData: ev.data ?? {
            topic: ev.topic ?? null,
            value: ev.value ?? null,
            pagingToken: ev.pagingToken ?? null,
            inSuccessfulContractCall: ev.inSuccessfulContractCall ?? null,
          },

          // Transaction details
          txHash: ev.txHash || txDetails.txHash || txDetails.hash || '',
          txEnvelope: txDetails.envelopeXdr || txDetails.envelope || '',
          txResult: txDetails.resultXdr || txDetails.result || '',
          txMeta: txDetails.resultMetaXdr || txDetails.meta || '',
          txFeeBump: Boolean(txDetails.feeBump),
          txStatus: txDetails.status || 'unknown',
          txCreatedAt: eventTimestamp ? new Date(eventTimestamp) : new Date(),
        };

        return prismaTx.contractEvent.upsert({
          where: { eventId: ev.id },
          update: eventData,
          create: eventData
        });
      });
      
      return Promise.all(operations);
    });
    
    console.log(`Stored ${results.length} event-transaction pairs.`);
  } catch (error) {
    console.error('Error storing event-transaction pairs in PostgreSQL:', error);
  }
}

// Clean up on process exit
process.on('beforeExit', async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});