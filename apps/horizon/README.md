# Stellar Horizon Indexer

## Setup

```bash
pnpm install
```

# Overview

The Stellar Horizon Indexer is a specialized Express.js server designed to comprehensively ingest and process data from the Stellar blockchain for contract-specific operations. It serves as a critical infrastructure component that bridges the gap between the Stellar blockchain (both testnet and mainnet) and our internal applications by maintaining a synchronized PostgreSQL database of **complete contract interaction data**.

## Purpose

This indexer was developed to address the need for a unified and comprehensive source of truth across our various client applications that interact with our attestation service on the Stellar/Soroban network. Our ecosystem includes:

- SDK implementations  
- Command-line interface (CLI) tools
- No-code deployer applications

By maintaining a centralized database of **all contract interactions** (not just events), the indexer ensures consistent data access and synchronization across all client applications, providing the complete picture needed for optimal user experience.

## Enhanced Strategy

Unlike traditional event-only indexers, our enhanced approach provides comprehensive contract visibility through multiple data collection pathways:

### 🎯 **Contract-Specific Focus**
- Indexes data for specific smart contracts only (not global blockchain data)
- Tracks both **protocol** and **authority** contracts from deployments.json
- Optimized for attestation protocol interactions

### 📊 **Multi-Source Data Collection**
1. **Events** - Contract events with transaction context
2. **Operations** - ALL operations involving contracts (including those without events)  
3. **Transactions** - Complete transaction details and metadata
4. **Account States** - Account information for contract participants
5. **Failed Operations** - Tracking of unsuccessful operations for debugging

### ⚡ **Queue-Based Processing**
- Background job processing with retry logic
- Multiple job types: events, operations, comprehensive data collection
- Configurable backoff and rate limiting

## Key Features

- **Comprehensive Contract Indexing** - Goes beyond events to capture all contract interactions
- **Multi-Contract Support** - Simultaneous indexing of protocol and authority contracts
- **Enhanced Database Schema** - Optimized models for contract-specific operations tracking
- **Queue-Based Job Processing** - Reliable background processing with retry logic
- **Failed Operation Tracking** - Complete visibility including unsuccessful operations
- **RESTful API Endpoints** - Rich APIs for querying contract data and analytics
- **Real-time Analytics** - Contract performance dashboards and metrics

## Architecture

The indexer follows an enhanced modular architecture:

1. **Multi-Source Data Collector**: Fetches events, operations, and transactions
2. **Contract-Specific Processor**: Filters and processes only relevant contract data
3. **Enhanced Database Layer**: PostgreSQL with optimized contract operation models
4. **Queue Management System**: Background job processing with retry logic
5. **Comprehensive API Server**: Rich endpoints for contract data and analytics
6. **Analytics Engine**: Real-time contract performance metrics

## Development

### Start the Development Server

```bash
pnpm dev
```

Server runs on `http://localhost:3001` (development) or `https://horizon.attest.so` (production)

### Enhanced Indexing Commands

#### 1. Comprehensive Contract Indexing (Recommended)
Indexes ALL contract data: events + operations + transactions + accounts
```bash
curl -X POST https://horizon.attest.so/api/contracts/comprehensive/ingest \
  -H 'Content-Type: application/json' \
  -d '{"startLedger": 880500}'
```

#### 2. Contract Operations Only
Focuses on operations involving your contracts (including failed ones)
```bash
curl -X POST https://horizon.attest.so/api/contracts/operations/ingest \
  -H 'Content-Type: application/json' \
  -d '{"startLedger": 880500, "includeFailedTx": true}'
```

#### 3. Events Only (Legacy)
Traditional event-based indexing
```bash
curl -X POST https://horizon.attest.so/api/events/ingest \
  -H 'Content-Type: application/json' \
  -d '{"startLedger": 880500}'
```

### Query Contract Data

#### Get Contract Operations
```bash
curl "https://horizon.attest.so/api/contract-operations?limit=10&successful=true"
```

#### View Contract Analytics
```bash
curl "https://horizon.attest.so/api/contracts/analytics"
```

#### Check Queue Status
```bash
curl "https://horizon.attest.so/api/queue/status"
```

### Monitor Health
```bash
curl "https://horizon.attest.so/api/health"
```

## Prerequisites

- Node.js 16+
- PostgreSQL 13+
- Stellar/Soroban RPC access

## Environment Setup

1. Copy `.env.sample` to `.env`
2. Configure database and RPC endpoint settings:
   ```bash
   DATABASE_URL=postgresql://username:password@host:port/database
   STELLAR_NETWORK=testnet  # or 'mainnet'
   CONTRACT_ID_TO_INDEX=CADB73DZ7QP5BG5ZG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM
   ```
3. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

## Tracked Contracts

The indexer is configured to track specific contracts from `deployments.json`:

### Testnet Contracts:
- **Protocol Contract**: `CADB73DZ7QP5BG5ZG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM`
- **Authority Contract**: `CAD6YMZCO4Q3L5XZT2FD3MDHP3ZHFMYL24RZYG4YQAL4XQKVGVXYPSQQ`

## Running the Indexer

### Development:
```bash
pnpm dev
```

### Production:
```bash
pnpm start
```

## Database Schema

The enhanced schema includes optimized models for contract-specific tracking:

- `HorizonContractOperation` - Enhanced contract operations with success tracking
- `HorizonEvent` - Contract events with transaction relations
- `HorizonTransaction` - Complete transaction metadata
- `HorizonAccount` - Account states for contract participants
- `HorizonEffect` - Operation effects and outcomes

## API Documentation

See [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md) for complete endpoint documentation.

## Testing

See [TESTING.md](./docs/TESTING.md) for testing procedures and examples.
