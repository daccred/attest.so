# Telegram Webhook Notification System Plan

## Current State Assessment
- **Horizon indexer is production-ready** and functional for Stellar events
- **MongoDB integration** already captures structured attestation data
- **Missing deployment infrastructure** (Docker, env templates, CI/CD)
- **Only Stellar coverage** - Solana/Starknet need indexers

## Infrastructure Requirements
The Telegram bot **will need a host server** with these options:

### Option A: Extend Existing Horizon Indexer
- Add Telegram bot endpoints to current Express.js server
- Leverage existing MongoDB connection and event data
- Single deployment for indexing + notifications

### Option B: Separate Bot Service  
- Dedicated Telegram bot service
- Consumes events from horizon indexer's MongoDB
- Independent scaling and deployment

## Implementation Plan

### Phase 1: Foundation Setup
1. **Deploy horizon indexer** to cloud platform (Railway/Render)
2. **Set up MongoDB Atlas** for managed database
3. **Add Docker configuration** for containerization
4. **Create deployment scripts** and environment templates

### Phase 2: Multi-Chain Coverage
1. **Build Solana indexer** similar to horizon structure
2. **Build Starknet indexer** for Cairo events
3. **Unify event data format** across all chains
4. **Centralize event storage** in single MongoDB instance

### Phase 3: Telegram Integration
1. **Create Telegram bot** with BotFather
2. **Add webhook endpoints** to process attestation events
3. **Implement user subscription system** with filtering
4. **Add message queuing** (Redis/Bull) for reliable delivery
5. **Build retry logic** with exponential backoff

### Phase 4: Production Features
1. **Rate limiting** for Telegram API compliance  
2. **Monitoring and alerting** for system health
3. **User management** (subscribe/unsubscribe/filters)
4. **Message formatting** with attestation details

## Technical Architecture
```
[Smart Contracts] → [Chain Indexers] → [MongoDB] → [Telegram Bot] → [Users]
     ↓                    ↓               ↓            ↓
  Emit Events      Store Events    Query Events   Send Messages
```

## Key Technical Details

### Horizon Indexer Current Capabilities
- Production-ready Express.js server with MongoDB
- Real-time Stellar/Soroban event ingestion
- Health check endpoints (`/api/indexer/health`)
- Event ingestion API (`POST /api/indexer/events/ingest`)
- Robust error handling and logging

### Required Environment Variables
- `MONGODB_URI` - Database connection
- `STELLAR_NETWORK` - testnet/mainnet
- `CONTRACT_ID_TO_INDEX` - Contract to monitor
- `TELEGRAM_BOT_TOKEN` - Bot authentication
- `TELEGRAM_WEBHOOK_URL` - Webhook endpoint

### Event Data Structure
Each blockchain emits attestation events with:
- **Stellar**: `("ATTEST", "CREATE")` with schema UID, subject, value
- **Solana**: `Attested` events with schema, recipient, attester, UID
- **Starknet**: `Attested` events with recipient, attester, UID, schema UID

### Deployment Requirements
- Node.js runtime environment
- MongoDB database (Atlas recommended)
- Outbound HTTPS access for RPC calls
- Telegram API access for bot messaging

**Estimated Timeline**: 2-3 weeks for full implementation across all chains