import { beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

// For integration tests, we'll use a test PostgreSQL database
// Make sure to set TEST_DATABASE_URL in your test environment
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/horizon_test';

// NO MOCKING for integration tests - use real RPC calls

beforeAll(async () => {
  // Set test database URL
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.STELLAR_NETWORK = 'testnet'; // Consistent test network
  
  console.log(`Test Database URL: ${TEST_DATABASE_URL}`);
});

beforeEach(async () => {
  // Clean test database for integration tests using direct Prisma client
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: TEST_DATABASE_URL
      }
    }
  });
  
  try {
    await prisma.horizonPayment.deleteMany();
    await prisma.horizonAccount.deleteMany();
    // await prisma.horizonIndexerState.deleteMany();
  } catch (error) {
    console.warn('Database cleanup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
});

afterAll(async () => {
  // Final cleanup
  console.log('Test database connection closed.');
});