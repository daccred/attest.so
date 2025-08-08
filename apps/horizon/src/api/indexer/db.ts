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
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
    });
    
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
    const results = await db.$transaction(async (tx) => {
      const operations = eventsWithTransactions.map(async (item) => {
        const eventData = {
          eventId: item.event.id,
          ledger: item.event.ledger,
          timestamp: new Date(item.event.timestamp),
          contractId: item.event.contractId,
          eventType: item.event.type || 'unknown',
          eventData: item.event.data || {},
          
          // Transaction details
          txHash: item.transaction?.hash || '',
          txEnvelope: item.transaction?.envelope || '',
          txResult: item.transaction?.result || '',
          txMeta: item.transaction?.meta || '',
          txFeeBump: item.transaction?.feeBump || false,
          txStatus: item.transaction?.status || 'unknown',
          txCreatedAt: item.transaction?.createdAt ? new Date(item.transaction.createdAt) : new Date(),
        };

        return tx.contractEvent.upsert({
          where: { eventId: item.event.id },
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