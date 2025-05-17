import { beforeAll, afterAll, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dotenv from 'dotenv';
dotenv.config();

let mongod: MongoMemoryServer;

// Mock the Stellar SDK's rpc.Server for all tests in this suite
// This ensures that any import of horizon.ts gets the mocked version
vi.mock('@stellar/stellar-sdk', async () => {
  const originalModule = await vi.importActual('@stellar/stellar-sdk') as any; // Cast to any if type is complex
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


beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri; // Override MONGODB_URI for tests
  process.env.STELLAR_NETWORK = 'testnet'; // Consistent test network
  process.env.CONTRACT_ID_TO_INDEX = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM'; // Valid example contract ID
  console.log(`Test MongoDB URI: ${uri}`);
});

afterAll(async () => {
  if (mongod) {
    await mongod.stop();
    console.log('Test MongoDB stopped.');
  }
});