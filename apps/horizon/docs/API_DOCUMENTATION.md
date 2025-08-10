# Comprehensive Horizon Indexer API Documentation

## Overview

The Horizon Indexer provides comprehensive Stellar/Soroban contract data indexing beyond just events. It captures transactions, operations, effects, contract state, accounts, and payments to provide a complete view of smart contract activity.

## API Base Routes

All API endpoints are prefixed with `/api` and organized into the following modules:

- **System APIs**: `/api/` - Health checks and system status
- **Data APIs**: `/api/data/` - Direct database queries with pagination
- **Analytics APIs**: `/api/analytics/` - Aggregated metrics and insights
- **Ingestion APIs**: `/api/ingest/` - Data ingestion control and monitoring

## System APIs

### Health Check
```http
GET /api/health
```

Performs comprehensive health assessment including database connectivity, RPC endpoint status, and configuration validation.

**Response:**
```json
{
  "status": "ok",
  "database_status": "connected",
  "soroban_rpc_status": "healthy",
  "network": "Testnet",
  "latest_rpc_ledger": 1025000,
  "indexing_contract": "CDDRYX6CX...",
  "last_processed_ledger_in_db": 1024950,
  "db_connection_explicitly_attempted_in_health_check": false
}
```

**Status Codes:**
- `200` - System healthy (may include warnings)
- `500` - System unhealthy with errors

### Queue Status
```http
GET /api/queue/status
```

Provides current ingestion queue state including pending job count, processing status, and details of upcoming jobs.

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

## Data APIs

### Contract Events
```http
GET /api/data/events?contractId={CONTRACT_ID}&eventType={TYPE}&limit=50&offset=0
```

Retrieves stored contract events with support for filtering by contract, event type, and ledger range.

**Query Parameters:**
- `contractId` - Filter events by contract ID
- `eventType` - Filter by specific event type
- `limit` - Results per page (max: 200, default: 50)
- `offset` - Pagination offset (default: 0)
- `ledgerStart` - Minimum ledger sequence number
- `ledgerEnd` - Maximum ledger sequence number
- `cursor` - Pagination cursor (future use)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "eventId": "0004387339157639168-0000000001",
      "ledger": 1021507,
      "timestamp": "2025-05-17T21:36:01Z",
      "contractId": "CDDRYX6CX...",
      "eventType": "ATTEST",
      "eventData": { "topic": [...], "value": "..." },
      "transaction": { ... }
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

### Transactions
```http
GET /api/data/transactions?hash={TX_HASH}&sourceAccount={ACCOUNT}&successful=true&limit=50
```

Provides access to transaction records with comprehensive filtering options including hash lookup, account filtering, and success status.

**Query Parameters:**
- `hash` - Filter by transaction hash
- `sourceAccount` - Filter by source account
- `successful` - Filter by success status ('true'/'false')
- `limit` - Results per page (max: 200, default: 50)
- `offset` - Pagination offset (default: 0)
- `ledgerStart` - Minimum ledger sequence
- `ledgerEnd` - Maximum ledger sequence

**Response:** Full transaction details including associated events, effects, and payments.

### Operations
```http
GET /api/data/operations?transactionHash={TX_HASH}&contractId={CONTRACT_ID}&type=invoke_host_function
```

Retrieves contract operation records with filtering by transaction, contract, operation type, and source account.

**Query Parameters:**
- `transactionHash` - Filter by parent transaction
- `contractId` - Filter by contract ID
- `type` - Filter by operation type
- `sourceAccount` - Filter by source account
- `limit` - Results per page (max: 200, default: 50)
- `offset` - Pagination offset (default: 0)

### Effects
```http
GET /api/data/effects?operationId={OP_ID}&account={ACCOUNT}&type=contract_credited
```

Retrieves operation effects representing state changes from blockchain operations.

**Query Parameters:**
- `operationId` - Filter by parent operation
- `transactionHash` - Filter by transaction
- `account` - Filter by affected account
- `type` - Filter by effect type
- `limit` - Results per page (max: 200, default: 50)
- `offset` - Pagination offset (default: 0)

### Contract Data
```http
GET /api/data/contract-data?contractId={CONTRACT_ID}&key={DATA_KEY}&latest=true
```

Accesses contract storage entries with support for key-based queries, durability filtering, and historical data retrieval.

**Query Parameters:**
- `contractId` - Filter by contract ID
- `key` - Filter by storage key
- `durability` - Filter by durability type
- `latest` - Return only latest values (default: 'true')
- `limit` - Results per page (max: 200, default: 50)
- `offset` - Pagination offset (default: 0)

### Accounts
```http
GET /api/data/accounts?accountId={ACCOUNT_ID}&isContract=true
```

Retrieves account records including regular accounts and contract accounts.

**Query Parameters:**
- `accountId` - Filter by account ID
- `isContract` - Filter by contract status ('true'/'false')
- `limit` - Results per page (max: 200, default: 50)
- `offset` - Pagination offset (default: 0)

### Payments
```http
GET /api/data/payments?from={FROM_ACCOUNT}&to={TO_ACCOUNT}
```

Retrieves payment records including transfers between accounts with asset details and amounts.

**Query Parameters:**
- `from` - Filter by sender account
- `to` - Filter by receiver account
- `transactionHash` - Filter by transaction
- `limit` - Results per page (max: 200, default: 50)
- `offset` - Pagination offset (default: 0)

## Analytics APIs

### General Analytics
```http
GET /api/analytics/?contractId={CONTRACT_ID}&timeframe=24h
```

Retrieves aggregated metrics for blockchain activity within specified timeframes.

**Query Parameters:**
- `contractId` - Filter metrics to specific contract (optional)
- `timeframe` - Time window: '1h', '24h', '7d', or '30d' (default: '24h')

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
      "average": null,
      "total": null
    }
  }
}
```

### Contract Analytics
```http
GET /api/analytics/contracts?contractIds=["CONTRACT_1","CONTRACT_2"]
```

Provides detailed analytics for specified contracts including operation counts, success rates, and user metrics.

**Query Parameters:**
- `contractIds` - Contract IDs to analyze (defaults to all tracked contracts)

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

### Activity Feed
```http
GET /api/analytics/activity?contractId={CONTRACT_ID}&accountId={ACCOUNT_ID}&limit=20
```

Retrieves and consolidates recent blockchain activity including events, transactions, and payments.

**Query Parameters:**
- `contractId` - Filter to specific contract (optional)
- `accountId` - Filter to specific account (optional)
- `limit` - Maximum results to return (max: 50, default: 20)
- `includeTransactions` - Include transaction records (default: 'true')
- `includeEvents` - Include event records (default: 'true')
- `includePayments` - Include payment records (default: 'true')

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "event",
      "id": "0004387339157639168-0000000001",
      "timestamp": "2025-05-17T21:36:01Z",
      "contractId": "CDDRYX6CX...",
      "eventType": "ATTEST",
      "data": { ... },
      "transaction": { ... }
    },
    {
      "type": "transaction",
      "id": "abc123...",
      "timestamp": "2025-05-17T21:35:45Z",
      "sourceAccount": "GXYZ...",
      "successful": true,
      "fee": "100000",
      "operationCount": 1,
      "events": [ ... ]
    }
  ],
  "count": 20
}
```

## Ingestion APIs

### Event Ingestion
```http
POST /api/ingest/events
Content-Type: application/json

{
  "startLedger": 880500
}
```

Adds an event fetching job to the processing queue for asynchronous execution.

**Body Parameters:**
- `startLedger` - Starting ledger sequence (optional)

**Response:**
```json
{
  "success": true,
  "jobId": "fetch-events-1691234567890-abc123",
  "message": "Event ingestion job enqueued. Requested start ledger: 880500."
}
```

**Status Codes:**
- `202` - Job enqueued successfully
- `400` - Invalid parameters
- `500` - Failed to enqueue job

### Comprehensive Data Collection
```http
POST /api/ingest/comprehensive
Content-Type: application/json

{
  "startLedger": 880500
}
```

Initiates a complete data synchronization process that fetches events, operations, and transactions for specified contracts.

**Body Parameters:**
- `startLedger` - Starting ledger sequence (optional)

**Response:**
```json
{
  "success": true,
  "message": "Comprehensive data ingestion initiated. Requested start ledger: 880500. Check server logs for progress."
}
```

### Contract Operations Ingestion
```http
POST /api/ingest/contracts/operations
Content-Type: application/json

{
  "startLedger": 880500,
  "contractIds": ["CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM"],
  "includeFailedTx": true
}
```

Queues a job to fetch operations for specified contracts with support for failed transaction inclusion.

**Body Parameters:**
- `startLedger` - Starting ledger sequence (optional)
- `contractIds` - Target contract IDs (optional, defaults to config)
- `includeFailedTx` - Include failed transactions (default: true)

**Response:**
```json
{
  "success": true,
  "jobId": "contract-ops-1691234567890-def456",
  "message": "Contract operations ingestion job enqueued for 1 contracts. Start ledger: 880500.",
  "contractIds": ["CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM"]
}
```

### Comprehensive Contract Data Ingestion
```http
POST /api/ingest/contracts/comprehensive
Content-Type: application/json

{
  "startLedger": 880500,
  "contractIds": ["CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM"]
}
```

Queues a comprehensive data collection job that fetches events, operations, transactions, and account data for specified contracts.

**Body Parameters:**
- `startLedger` - Starting ledger sequence (optional)
- `contractIds` - Target contract IDs (optional, defaults to config)

**Response:**
```json
{
  "success": true,
  "jobId": "comprehensive-1691234567890-ghi789",
  "message": "Comprehensive contract data ingestion job enqueued for 1 contracts. Start ledger: 880500.",
  "contractIds": ["CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM"],
  "strategy": "events + operations + transactions + accounts"
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `200` - Success
- `202` - Accepted (for async operations)
- `400` - Bad Request (invalid parameters)
- `500` - Internal Server Error
- `503` - Service Unavailable (database not available)

## Frontend Integration Examples

### React Dashboard Component
```typescript
// Fetch comprehensive contract analytics
const useContractAnalytics = (contractId: string, timeframe: string) => {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch(`/api/analytics?contractId=${contractId}&timeframe=${timeframe}`)
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
      const res = await fetch(`/api/analytics/activity?contractId=${contractId}&limit=50`);
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
    fetch(`/api/data/transactions?hash=${txHash}`)
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
      fetch(`/api/data/events?eventType=ATTEST&limit=200`),
      fetch(`/api/data/events?eventType=REVOKE&limit=200`),
      fetch(`/api/data/events?eventType=SCHEMA&limit=200`)
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
- `horizon_contract_operations` - Enhanced contract-specific operations with success tracking and contract mapping
- `horizon_effects` - State changes and side effects from operations
- `horizon_contract_data` - Contract storage data with historical versioning
- `horizon_accounts` - Account details including contract accounts and activity tracking
- `horizon_payments` - Payment streams and transfers
- `horizon_metadata` - Indexer state and configuration
- `horizon_indexer_state` - Indexer performance metrics and sync status

### Key Schema Enhancements:

#### HorizonContractOperation Model
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
7. **Asynchronous Job Queue** - Fault-tolerant processing with retry logic
8. **Event-driven Architecture** - Real-time monitoring and alerting support

This comprehensive indexer provides everything needed for rich frontend experiences including dashboards, explorers, analytics, and real-time activity feeds.