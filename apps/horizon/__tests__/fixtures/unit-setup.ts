import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

// For tests, we'll use a test PostgreSQL database
// Make sure to set TEST_DATABASE_URL in your test environment
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/horizon_test';

// Mock the Stellar SDK's rpc.Server only for unit tests, not integration tests
// This ensures that unit tests get mocked versions while integration tests use real RPC calls
if (process.env.VITEST_MODE !== 'integration') {
  vi.mock('@stellar/stellar-sdk', async () => {
    const originalModule = await vi.importActual('@stellar/stellar-sdk') as any;
    return {
      ...originalModule,
      rpc: {
        ...originalModule.rpc,
        // This mock will be a factory for the Server instances
        // Individual methods (getLatestLedger, getEvents, getHealth) will be mocked per test
        Server: vi.fn().mockImplementation(() => ({
          getLatestLedger: vi.fn(),
          getEvents: vi.fn(),
          getHealth: vi.fn(),
        })),
      },
    };
  });
}


beforeAll(async () => {
  // Set test database URL
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.STELLAR_NETWORK = 'testnet'; // Consistent test network
  // Legacy environment variable for backward compatibility - tests should use CONTRACT_IDS_TO_INDEX directly
  
  console.log(`Test Database URL: ${TEST_DATABASE_URL}`);
});

beforeEach(async () => {
  // Only clean test database for integration tests, not unit tests with mocks
  if (process.env.VITEST_MODE === 'integration') {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: TEST_DATABASE_URL
        }
      }
    });
    
    try {
      // Clean up all Horizon data tables
      await prisma.horizonPayment.deleteMany();
      await prisma.horizonAccount.deleteMany();
      await prisma.horizonEvent.deleteMany();
      await prisma.horizonTransaction.deleteMany();
    } catch (error) {
      console.warn('Database cleanup failed:', error);
    } finally {
      await prisma.$disconnect();
    }
  }
});

afterAll(async () => {
  // Clean up test database
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: TEST_DATABASE_URL
      }
    }
  });
  
  await prisma.$disconnect();
  console.log('Test database connection closed.');
});
