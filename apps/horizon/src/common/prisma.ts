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

export function getPrismaInstance(): PrismaClient | undefined {
  return prisma;
}

// Clean up on process exit
process.on('beforeExit', async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});