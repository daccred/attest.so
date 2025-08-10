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

### Data Ingestion

#### 10. Event Ingestion API
```http
POST /events/ingest
Content-Type: application/json

{
  "startLedger": 1021500
}
```

**Purpose:** Triggers background event ingestion from specified ledger.

#### 11. Comprehensive Data Ingestion API
```http
POST /comprehensive/ingest
Content-Type: application/json

{
  "startLedger": 1021500
}
```

**Purpose:** Triggers comprehensive data ingestion including events, transactions, operations, effects, accounts, and payments.

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

## Database Schema Summary

The indexer now stores data in the following Horizon-prefixed tables:

- `horizon_events` - Contract events with full context
- `horizon_transactions` - Transaction details with Soroban resource usage
- `horizon_operations` - Individual operations with contract function calls
- `horizon_effects` - State changes and side effects
- `horizon_contract_data` - Contract storage data with history
- `horizon_accounts` - Account details including contract accounts
- `horizon_payments` - Payment streams and transfers
- `horizon_metadata` - Indexer state and configuration

## Performance & Reliability Features

1. **Rate Limiting** - Prevents API abuse and Horizon rate limits
2. **Performance Monitoring** - Tracks slow operations and bottlenecks  
3. **Comprehensive Error Handling** - Structured error logging with context
4. **Automatic Retries** - Resilient data fetching with exponential backoff
5. **Data Validation** - Ensures data integrity before storage
6. **Incremental Sync** - Efficient partial updates and resume capability

This comprehensive indexer provides everything needed for rich frontend experiences including dashboards, explorers, analytics, and real-time activity feeds.