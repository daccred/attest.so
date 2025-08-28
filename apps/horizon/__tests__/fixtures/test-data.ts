// Test data fixtures and mocks for all tests
import { vi } from 'vitest';

export const mockHorizonEvent = {
  id: 'event-uuid-1',
  eventId: '0004387339157639168-0000000001',
  ledger: 1021507,
  timestamp: new Date('2025-05-17T21:36:01Z'),
  contractId: 'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO',
  eventType: 'ATTEST',
  eventData: { 
    topic: ['AAAADwAAAAZBVFRFU1QAAA==', 'AAAADwAAAAZDUkVBVEUAAA=='],
    value: 'AAAAEAAAAAEAAAAFAAAADQAAACC6ZV5Eo53DF66/KHMTuHZb0MHz4TcPIkYEcVl95pL+9g==',
    pagingToken: '0004387339157639168-0000000001',
    inSuccessfulContractCall: true
  },
  txHash: '12069247060c6f1a0f4244555a841dd76d5acb2194ead69da5a99fb4c5327478',
  txEnvelope: 'AAAAAgAAAAC6ZV5Eo53DF66...',
  txResult: 'AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAA=',
  txMeta: 'AAAAAwAAAAAAAAACAAAAAwAA...',
  txFeeBump: false,
  txStatus: 'SUCCESS',
  txCreatedAt: new Date('2025-05-17T21:36:01Z'),
  ingestedAt: new Date('2025-05-17T21:36:05Z')
};

export const mockHorizonTransaction = {
  id: 'tx-uuid-1',
  hash: '12069247060c6f1a0f4244555a841dd76d5acb2194ead69da5a99fb4c5327478',
  ledger: 1021507,
  timestamp: new Date('2025-05-17T21:36:01Z'),
  sourceAccount: 'GDAQ7GDVA4KJYYK6S7QKQFLMHQFNMJ3M4Q7I3J3FZHXLNXGP4IXMRJMC',
  fee: '100000',
  operationCount: 1,
  envelope: {
    type: 'ENVELOPE_TYPE_TX',
    v1: { /* transaction envelope data */ }
  },
  result: {
    feeCharged: '100000',
    result: { code: 'txSUCCESS' }
  },
  meta: {
    operations: [/* operation metas */]
  },
  feeBump: false,
  successful: true,
  memo: null,
  memoType: null,
  inclusionFee: '100',
  resourceFee: '99900',
  sorobanResourceUsage: {
    cpuInsns: '1234567',
    memBytes: '8192',
    readBytes: '4096',
    writeBytes: '2048',
    readEntries: 5,
    writeEntries: 2
  },
  ingestedAt: new Date('2025-05-17T21:36:05Z')
};


export const mockHorizonContractOperation = {
  id: 'contract-op-uuid-1',
  transactionHash: '12069247060c6f1a0f4244555a841dd76d5acb2194ead69da5a99fb4c5327478',
  contractId: 'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO',
  sourceAccount: 'GDAQ7GDVA4KJYYK6S7QKQFLMHQFNMJ3M4Q7I3J3FZHXLNXGP4IXMRJMC',
  type: 'invoke_host_function',
  successful: true,
  ingestedAt: new Date('2025-05-17T21:36:05Z')
};

export const mockHorizonEffect = {
  id: 'effect-uuid-1',
  effectId: '0004387339157639168-0000000001',
  operationId: '0004387339157639168-0000000001',
  transactionHash: '12069247060c6f1a0f4244555a841dd76d5acb2194ead69da5a99fb4c5327478',
  type: 'contract_credited',
  typeI: 51,
  details: {
    account: 'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO',
    asset_type: 'native',
    amount: '100.0000000'
  },
  account: 'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO',
  ingestedAt: new Date('2025-05-17T21:36:05Z')
};

export const mockHorizonContractData = {
  id: 'data-uuid-1',
  contractId: 'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO',
  key: 'attestation_count',
  value: {
    type: 'ScValType',
    value: '42'
  },
  durability: 'persistent',
  ledger: 1021507,
  timestamp: new Date('2025-05-17T21:36:01Z'),
  ingestedAt: new Date('2025-05-17T21:36:05Z')
};

export const mockHorizonAccount = {
  id: 'account-uuid-1',
  accountId: 'GDAQ7GDVA4KJYYK6S7QKQFLMHQFNMJ3M4Q7I3J3FZHXLNXGP4IXMRJMC',
  isContract: true,
  lastActivity: new Date('2025-05-17T21:36:01Z'),
  balance: '1000.0000000',
  asset: {
    type: 'native',
    code: null,
    issuer: null
  },
  amount: '100.0000000',
  timestamp: new Date('2025-05-17T21:36:01Z'),
  ingestedAt: new Date('2025-05-17T21:36:05Z')
};

export const mockHorizonPayment = {
  id: 'payment-uuid-1',
  from: 'GDAQ7GDVA4KJYYK6S7QKQFLMHQFNMJ3M4Q7I3J3FZHXLNXGP4IXMRJMC',
  to: 'GDBQB2KBQG7S6Z4B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B7B',
  amount: '100.0000000',
  transactionHash: '12069247060c6f1a0f4244555a841dd76d5acb2194ead69da5a99fb4c5327478',
  asset: {
    type: 'native',
    code: null,
    issuer: null
  },
  amount: '100.0000000',
  timestamp: new Date('2025-05-17T21:36:01Z'),
  ingestedAt: new Date('2025-05-17T21:36:05Z')
};

export const mockAttestation = {
  id: 'attestation-uuid-1',
  attestationUid: 'attest-event-id-1',
  ledger: 1021507,
  schemaUid: 'schema-event-id-1',
  attesterAddress: 'GDAQ7GDVA4KJYYK6S7QKQFLMHQFNMJ3M4Q7I3J3FZHXLNXGP4IXMRJMC',
  subjectAddress: 'GBXGQJWVLWOYHFLVTKWV5VDK3TGRHHAOXJMHRHKR24GLG3UDAXFGL2YK',
  transactionHash: '12069247060c6f1a0f4244555a841dd76d5acb2194ead69da5a99fb4c5327478',
  schemaEncoding: 'XDR',
  message: 'Test attestation message',
  value: { 
    test_field: 'test_value',
    score: 85
  },
  revoked: false,
  createdAt: new Date('2025-05-17T21:36:01Z'),
  revokedAt: null,
  ingestedAt: new Date('2025-05-17T21:36:05Z'),
  lastUpdated: new Date('2025-05-17T21:36:05Z')
};

export const mockSchema = {
  id: 'schema-uuid-1',
  uid: 'schema-event-id-1',
  ledger: 1021507,
  schemaDefinition: 'test_field:string,score:uint256',
  parsedSchemaDefinition: {
    fields: [
      { name: 'test_field', type: 'string' },
      { name: 'score', type: 'uint256' }
    ]
  },
  resolverAddress: null,
  revocable: true,
  deployerAddress: 'GDAQ7GDVA4KJYYK6S7QKQFLMHQFNMJ3M4Q7I3J3FZHXLNXGP4IXMRJMC',
  type: 'default',
  transactionHash: '12069247060c6f1a0f4244555a841dd76d5acb2194ead69da5a99fb4c5327478',
  createdAt: new Date('2025-05-17T21:36:01Z'),
  ingestedAt: new Date('2025-05-17T21:36:05Z'),
  lastUpdated: new Date('2025-05-17T21:36:05Z')
};

// Mock database instance with all required methods
export const createMockDb = () => ({
  horizonEvent: {
    findMany: vi.fn().mockResolvedValue([mockHorizonEvent]),
    findFirst: vi.fn().mockResolvedValue(mockHorizonEvent),
    findUnique: vi.fn().mockResolvedValue(mockHorizonEvent),
    count: vi.fn().mockResolvedValue(1),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    groupBy: vi.fn().mockResolvedValue([
      { eventType: 'ATTEST', _count: { eventType: 25 } },
      { eventType: 'REVOKE', _count: { eventType: 12 } }
    ])
  },
  horizonTransaction: {
    findMany: vi.fn().mockResolvedValue([mockHorizonTransaction]),
    findFirst: vi.fn().mockResolvedValue(mockHorizonTransaction),
    findUnique: vi.fn().mockResolvedValue(mockHorizonTransaction),
    count: vi.fn().mockResolvedValue(1),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    aggregate: vi.fn().mockResolvedValue({
      _avg: { fee: '100000' },
      _sum: { fee: '3200000' }
    })
  },
  horizonContractOperation: {
    findMany: vi.fn().mockResolvedValue([mockHorizonContractOperation]),
    findFirst: vi.fn().mockResolvedValue(mockHorizonContractOperation),
    findUnique: vi.fn().mockResolvedValue(mockHorizonContractOperation),
    count: vi.fn().mockResolvedValue(1),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn()
  },
  horizonEffect: {
    findMany: vi.fn().mockResolvedValue([mockHorizonEffect]),
    findFirst: vi.fn().mockResolvedValue(mockHorizonEffect),
    findUnique: vi.fn().mockResolvedValue(mockHorizonEffect),
    count: vi.fn().mockResolvedValue(1),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn()
  },
  horizonContractData: {
    findMany: vi.fn().mockResolvedValue([mockHorizonContractData]),
    findFirst: vi.fn().mockResolvedValue(mockHorizonContractData),
    findUnique: vi.fn().mockResolvedValue(mockHorizonContractData),
    count: vi.fn().mockResolvedValue(1),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn()
  },
  horizonAccount: {
    findMany: vi.fn().mockResolvedValue([mockHorizonAccount]),
    findFirst: vi.fn().mockResolvedValue(mockHorizonAccount),
    findUnique: vi.fn().mockResolvedValue(mockHorizonAccount),
    count: vi.fn().mockResolvedValue(1),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn()
  },
  horizonPayment: {
    findMany: vi.fn().mockResolvedValue([mockHorizonPayment]),
    findFirst: vi.fn().mockResolvedValue(mockHorizonPayment),
    findUnique: vi.fn().mockResolvedValue(mockHorizonPayment),
    count: vi.fn().mockResolvedValue(1),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn()
  },
  horizonIndexerState: {
    findFirst: vi.fn().mockResolvedValue({ 
      id: 'indexer-state-1',
      lastProcessedLedger: 1021500,
      lastProcessedAt: new Date(),
      syncStatus: 'synced'
    }),
    findUnique: vi.fn().mockResolvedValue({ 
      id: 'indexer-state-1',
      lastProcessedLedger: 1021500,
      lastProcessedAt: new Date(),
      syncStatus: 'synced'
    }),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn()
  },
  attestation: {
    findMany: vi.fn().mockResolvedValue([mockAttestation]),
    findFirst: vi.fn().mockResolvedValue(mockAttestation),
    findUnique: vi.fn().mockResolvedValue(mockAttestation),
    count: vi.fn().mockResolvedValue(1),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn()
  },
  schema: {
    findMany: vi.fn().mockResolvedValue([mockSchema]),
    findFirst: vi.fn().mockResolvedValue(mockSchema),
    findUnique: vi.fn().mockResolvedValue(mockSchema),
    count: vi.fn().mockResolvedValue(1),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn()
  },
  $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
  $transaction: vi.fn().mockImplementation(async (callback) => {
    const transactionDb = createMockDb();
    return await callback(transactionDb);
  }),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $on: vi.fn(),
  deleteMany: vi.fn()
});

// Common test constants
export const TEST_CONTRACT_ID = 'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO';
export const TEST_TX_HASH = '12069247060c6f1a0f4244555a841dd76d5acb2194ead69da5a99fb4c5327478';
export const TEST_ACCOUNT_ID = 'GDAQ7GDVA4KJYYK6S7QKQFLMHQFNMJ3M4Q7I3J3FZHXLNXGP4IXMRJMC';
export const TEST_LEDGER = 1021507;
