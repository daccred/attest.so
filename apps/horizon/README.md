# Stellar Horizon Indexer

## Setup

```bash
pnpm install
```

# Overview

The Stellar Horizon Indexer is a specialized Express.js server designed to ingest and process data from the Stellar Horizon RPC (Remote Procedure Call) endpoints. It serves as a critical infrastructure component that bridges the gap between the Stellar blockchain (both testnet and public mainnet) and our internal applications by maintaining a synchronized PostgreSQL database of contract-specific data.

## Purpose

This indexer was developed to address the need for a unified and decentralized source of truth across our various client applications that interact with our attestation service on the Stellar/Soroban network. Our ecosystem includes:

- SDK implementations
- Command-line interface (CLI) tools  
- No-code deployer applications

By maintaining a centralized database of on-chain events and state, the indexer ensures consistent data access and synchronization across all client applications.

## Key Features

- Real-time data ingestion from Stellar Horizon RPC
- Support for both testnet and mainnet environments
- PostgreSQL database integration for reliable data persistence
- Contract-specific data indexing and filtering
- RESTful API endpoints for client applications
- Event monitoring and synchronization

## Architecture

The indexer follows a modular architecture:

1. **RPC Listener**: Connects to Stellar Horizon endpoints and monitors for new events
2. **Data Processor**: Parses and validates incoming blockchain data
3. **Database Layer**: Manages PostgreSQL interactions and data modeling
4. **API Server**: Exposes indexed data through RESTful endpoints
5. **Sync Manager**: Ensures data consistency and handles reorgs

## Development

Start the Ingester :

```bash
  curl -X POST http://localhost:3001/api/indexer/events/ingest \
    -H 'Content-Type: application/json' \
    -d '{}'
```

Ingest from a specific ledger:

```bash
  curl -X POST http://localhost:3001/api/indexer/events/ingest \
    -H 'Content-Type: application/json' \
    -d '{"ledger": 880111}'
```

Ingest everything including effects, accounts and payments:

```bash
  curl -X POST http://localhost:3001/api/indexer/comprehensive/ingest \
    -H 'Content-Type: application/json' \
    -d '{"startLedger": 1021000}'
```

### Prerequisites
Start the API Server:

- Node.js 16+
- PostgreSQL 13+
- Stellar Horizon RPC access

### Environment Setup

1. Copy `.env.sample` to `.env`
2. Configure database and RPC endpoint settings
3. Run database migrations

### Running the Indexer

For development:

```bash
pnpm dev
```

For production:




================================================================================
curl -X POST \
-H 'Content-Type: application/json' \
-d '{
    "jsonrpc": "2.0",
    "id": 8675309,
    "method": "getEvents",
    "params": {
      "xdrFormat": "json",
      "startLedger": 1021467,
      "pagination": {
        "limit": 100
      },
      "filters": [
        {
          "type": "contract",
          "contractIds": [
            "CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO"
          ],
          "topics": []
        }
      ]
    }
}' \
https://soroban-testnet.stellar.org | jq
================================================================================
