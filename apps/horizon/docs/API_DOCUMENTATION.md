# Comprehensive Horizon Indexer API Documentation

## Overview

The Horizon Indexer now provides comprehensive Stellar/Soroban contract data indexing beyond just events. It captures transactions, operations, effects, contract state, accounts, and payments to provide a complete view of smart contract activity.

## Available APIs

### Core Data Endpoints

#### 1. Contract Events API
```http
GET /events?contractId={CONTRACT_ID}&eventType={TYPE}&limit=50&offset=0
```

**Query Parameters:**
- `contractId` - Filter events by contract address
- `eventType` - Filter by event type (e.g., "ATTEST", "REVOKE", "SCHEMA")
- `limit` - Number of results (max 200, default 50)
- `offset` - Pagination offset
- `ledgerStart` - Start ledger number
- `ledgerEnd` - End ledger number

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "eventId": "0004387339157639168-0000000001",
      "ledger": 1021507,
      "timestamp": "2025-05-17T21:36:01Z",
      "contractId": "CDDRYX6CX...",
      "eventType": "ATTEST",
      "eventData": { "topic": [...], "value": "..." },
      "transaction": { ... },
      "operations": [...]
    }
  ],
  "pagination": {
    "total": 1250,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

#### 2. Transactions API
```http
GET /transactions?hash={TX_HASH}&sourceAccount={ACCOUNT}&successful=true&limit=50
```

**Query Parameters:**
- `hash` - Specific transaction hash
- `sourceAccount` - Filter by transaction source
- `successful` - Filter by success status (true/false)
- `limit` - Number of results (max 200)
- `ledgerStart/End` - Ledger range filters

**Response:** Full transaction details with related operations, events, effects, and payments.

#### 3. Operations API
```http
GET /operations?transactionHash={TX_HASH}&contractId={CONTRACT_ID}&type=invoke_contract
```

**Query Parameters:**
- `transactionHash` - Operations for specific transaction
- `contractId` - Operations for specific contract
- `type` - Operation type filter
- `sourceAccount` - Filter by operation source

#### 4. Effects API
```http
GET /effects?operationId={OP_ID}&account={ACCOUNT}&type=contract_credited
```

**Query Parameters:**
- `operationId` - Effects for specific operation
- `transactionHash` - Effects for specific transaction
- `account` - Effects for specific account
- `type` - Effect type filter

#### 5. Contract Data API
```http
GET /contract-data?contractId={CONTRACT_ID}&key={DATA_KEY}&latest=true
```

**Query Parameters:**
- `contractId` - Contract address (required if no key specified)
- `key` - Specific data key
- `durability` - "persistent" or "temporary"
- `latest` - Get only latest version (true/false)

**Response:** Contract storage data with historical versions.

#### 6. Accounts API
```http
GET /accounts?accountId={ACCOUNT_ID}&isContract=true
```

**Query Parameters:**
- `accountId` - Specific account address
- `isContract` - Filter contract accounts only

**Response:** Account details including balances, signers, and contract status.

#### 7. Payments API
```http
GET /payments?from={FROM_ACCOUNT}&to={TO_ACCOUNT}
```

**Query Parameters:**
- `from` - Payment sender
- `to` - Payment recipient
- `transactionHash` - Payments in specific transaction

### Analytics & Insights

#### 8. Analytics API
```http
GET /analytics?contractId={CONTRACT_ID}&timeframe=24h
```

**Query Parameters:**
- `contractId` - Specific contract analysis
- `timeframe` - "1h", "24h", "7d", "30d"

**Response:**
```json
{
  "success": true,
  "timeframe": "24h",
  "data": {
    "summary": {
      "totalEvents": 45,
      "totalTransactions": 32,
      "successfulTransactions": 31,
      "successRate": "96.88%"
    },
    "eventsByType": [
      { "type": "ATTEST", "count": 25 },
      { "type": "REVOKE", "count": 12 },
      { "type": "SCHEMA", "count": 8 }
    ],
    "fees": {
      "average": "100000",
      "total": "3200000"
    }
  }
}
```

#### 9. Activity Feed API
```http
GET /activity?contractId={CONTRACT_ID}&accountId={ACCOUNT_ID}&limit=20
```

**Query Parameters:**
- `contractId` - Contract-specific activity
- `accountId` - Account-specific activity
- `limit` - Number of activities (default 20)
- `includeTransactions` - Include transaction activity (true/false)
- `includeEvents` - Include event activity (true/false) 
- `includePayments` - Include payment activity (true/false)

**Response:** Unified activity feed combining events, transactions, and payments chronologically.

### Enhanced Contract-Specific APIs

#### 10. Contract Operations API (NEW)
```http
GET /contract-operations?contractId={CONTRACT_ID}&operationType={TYPE}&successful=true
```

**Query Parameters:**
- `contractId` - Filter by specific contract (uses both protocol and authority contracts)
- `operationType` - Filter by operation type (e.g., "invoke_host_function")
- `successful` - Filter by success status (true/false)
- `sourceAccount` - Filter by operation source account
- `transactionHash` - Filter by specific transaction
- `limit/offset` - Standard pagination

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "operationId": "4387339157639168-1",
      "transactionHash": "abc123...",
      "contractId": "CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM",
      "operationType": "invoke_host_function",
      "successful": true,
      "sourceAccount": "GXYZ...",
      "function": "attest",
      "parameters": { ... },
      "transaction": { ... },
      "events": [ ... ]
    }
  ],
  "pagination": { ... }
}
```

#### 11. Contract Analytics Dashboard API (NEW)
```http
GET /contracts/analytics?contractIds=["CONTRACT_1","CONTRACT_2"]
```

**Query Parameters:**
- `contractIds` - Array of contract IDs (defaults to all tracked contracts)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "contractId": "CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM",
      "operations": {
        "total": 1250,
        "successful": 1201,
        "failed": 49,
        "successRate": "96.08%"
      },
      "users": {
        "unique": 89
      },
      "activity": {
        "eventsLast24h": 156
      }
    }
  ],
  "summary": {
    "totalContracts": 2,
    "totalOperations": 2456,
    "totalUsers": 145,
    "averageSuccessRate": "95.84%"
  }
}
```

### Enhanced Data Ingestion

#### 12. Contract Operations Ingestion API (NEW)
```http
POST /contracts/operations/ingest
Content-Type: application/json

{
  "startLedger": 880500,
  "contractIds": ["CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM"],
  "includeFailedTx": true
}
```

**Purpose:** Focuses specifically on operations involving your contracts (including failed ones).

**Body Parameters:**
- `startLedger` - Starting ledger number (defaults to 880500)
- `contractIds` - Array of contract IDs (defaults to all tracked contracts)
- `includeFailedTx` - Whether to include failed transactions (default: true)

#### 13. Enhanced Comprehensive Contract Ingestion API (NEW)
```http
POST /contracts/comprehensive/ingest
Content-Type: application/json

{
  "startLedger": 880500,
  "contractIds": ["CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM"]
}
```

**Purpose:** Complete contract data collection combining events, operations, transactions, and accounts.

**Strategy:** events + operations + transactions + accounts

#### 14. Event Ingestion API (Legacy)
```http
POST /events/ingest
Content-Type: application/json

{
  "startLedger": 880500
}
```

**Purpose:** Traditional event-based indexing (legacy approach).

#### 15. Queue Status API (NEW)
```http
GET /queue/status
```

**Response:**
```json
{
  "success": true,
  "queue": {
    "size": 3,
    "running": true,
    "nextJobs": [
      {
        "id": "comprehensive-1691234567890-abc123",
        "type": "fetch-comprehensive-data",
        "nextRunInMs": 0,
        "attempts": 0
      }
    ]
  }
}
```

### System Health

#### 12. Health Check API
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "database_status": "connected",
  "soroban_rpc_status": "healthy",
  "network": "Testnet",
  "latest_rpc_ledger": 1025000,
  "indexing_contract": "CDDRYX6CX...",
  "last_processed_ledger_in_db": 1024950
}
```

## Frontend Integration Examples

### React Dashboard Component
```typescript
// Fetch comprehensive contract analytics
const useContractAnalytics = (contractId: string, timeframe: string) => {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch(`/api/indexer/analytics?contractId=${contractId}&timeframe=${timeframe}`)
      .then(res => res.json())
      .then(setData);
  }, [contractId, timeframe]);
  
  return data;
};

// Real-time activity feed
const useActivityFeed = (contractId: string) => {
  const [activities, setActivities] = useState([]);
  
  useEffect(() => {
    const fetchActivities = async () => {
      const res = await fetch(`/api/indexer/activity?contractId=${contractId}&limit=50`);
      const data = await res.json();
      setActivities(data.data);
    };
    
    fetchActivities();
    const interval = setInterval(fetchActivities, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [contractId]);
  
  return activities;
};
```

### Transaction Explorer
```typescript
const TransactionExplorer = ({ txHash }: { txHash: string }) => {
  const [transaction, setTransaction] = useState(null);
  
  useEffect(() => {
    fetch(`/api/indexer/transactions?hash=${txHash}`)
      .then(res => res.json())
      .then(data => setTransaction(data.data[0]));
  }, [txHash]);
  
  if (!transaction) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Transaction {transaction.hash.slice(0, 8)}...</h2>
      <div>Status: {transaction.successful ? '✅ Success' : '❌ Failed'}</div>
      <div>Fee: {transaction.fee} stroops</div>
      <div>Operations: {transaction.operations?.length || 0}</div>
      <div>Events: {transaction.events?.length || 0}</div>
      
      {transaction.events?.map(event => (
        <div key={event.eventId}>
          <h3>{event.eventType} Event</h3>
          <pre>{JSON.stringify(event.eventData, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
};
```

### Attestation Timeline Component
```typescript
const AttestationTimeline = ({ subjectId }: { subjectId: string }) => {
  const [timeline, setTimeline] = useState([]);
  
  useEffect(() => {
    // Get all events for this subject across all contracts
    Promise.all([
      fetch(`/api/indexer/events?eventType=ATTEST&limit=200`),
      fetch(`/api/indexer/events?eventType=REVOKE&limit=200`),
      fetch(`/api/indexer/events?eventType=SCHEMA&limit=200`)
    ]).then(async ([attests, revokes, schemas]) => {
      const [attestData, revokeData, schemaData] = await Promise.all([
        attests.json(),
        revokes.json(), 
        schemas.json()
      ]);
      
      // Filter events related to this subject and combine
      const allEvents = [
        ...attestData.data.filter(e => e.eventData.value.includes(subjectId)),
        ...revokeData.data.filter(e => e.eventData.value.includes(subjectId)),
        ...schemaData.data
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      setTimeline(allEvents);
    });
  }, [subjectId]);
  
  return (
    <div className="timeline">
      {timeline.map(event => (
        <div key={event.eventId} className="timeline-item">
          <div className="timestamp">{new Date(event.timestamp).toLocaleString()}</div>
          <div className="event-type">{event.eventType}</div>
          <div className="contract">{event.contractId.slice(0, 8)}...</div>
          <div className="transaction">
            <a href={`/tx/${event.txHash}`}>View Transaction</a>
          </div>
        </div>
      ))}
    </div>
  );
};
```

## Enhanced Database Schema Summary

The indexer stores data in the following optimized Horizon-prefixed tables:

### Core Data Models:
- `horizon_events` - Contract events with transaction relations and context
- `horizon_transactions` - Complete transaction details with Soroban resource usage and gas tracking
- `horizon_operations` - General operations with contract function calls
- `horizon_contract_operations` - **NEW**: Enhanced contract-specific operations with success tracking and contract mapping
- `horizon_effects` - State changes and side effects from operations
- `horizon_contract_data` - Contract storage data with historical versioning
- `horizon_accounts` - Account details including contract accounts and activity tracking
- `horizon_payments` - Payment streams and transfers
- `horizon_metadata` - Indexer state and configuration
- `horizon_indexer_state` - Indexer performance metrics and sync status

### Key Schema Enhancements:

#### HorizonContractOperation (New Model)
```sql
- operationId (unique)
- transactionHash (foreign key)
- contractId (indexed for fast contract queries)
- operationType (e.g., "invoke_host_function")
- successful (boolean, indexed for filtering)
- sourceAccount (indexed for user queries)
- function (contract function name)
- parameters (JSON, function parameters)
- details (JSON, complete operation data)
```

#### Enhanced Relations:
- Events ↔ ContractOperations (Many-to-One)
- Transactions ↔ ContractOperations (One-to-Many)
- ContractOperations ↔ Events (One-to-Many for events emitted by operations)

This schema enables efficient queries for:
- Contract-specific operation tracking
- Success/failure rate analysis
- User interaction patterns
- Failed operation debugging
- Complete transaction lifecycle tracking

## Performance & Reliability Features

1. **Rate Limiting** - Prevents API abuse and Horizon rate limits
2. **Performance Monitoring** - Tracks slow operations and bottlenecks  
3. **Comprehensive Error Handling** - Structured error logging with context
4. **Automatic Retries** - Resilient data fetching with exponential backoff
5. **Data Validation** - Ensures data integrity before storage
6. **Incremental Sync** - Efficient partial updates and resume capability

This comprehensive indexer provides everything needed for rich frontend experiences including dashboards, explorers, analytics, and real-time activity feeds.