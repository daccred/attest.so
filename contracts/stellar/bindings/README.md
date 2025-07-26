# TypeScript Contract Bindings

This directory contains TypeScript bindings for our Stellar smart contracts.

## Structure

- `src/` - Generated TypeScript binding files
  - `authority.ts` - Authority contract bindings
  - `authority.md` - Authority contract documentation
  - `protocol.ts` - Protocol contract bindings  
  - `protocol.md` - Protocol contract documentation

## Generation

Bindings are automatically generated when you run the deploy script with the `--bindings` flag:

```bash
# Deploy and generate bindings for both contracts
./deploy.sh --authority --protocol --bindings --source <your-identity> --network testnet

# Deploy only authority contract with bindings
./deploy.sh --authority --bindings --source <your-identity> --network testnet
```

The bindings are generated from the deployed contract specs and organized automatically in the `src/` directory.

## Usage

Import the generated bindings in your TypeScript projects:

```typescript
// Import authority contract bindings
import { Client as AuthorityClient } from './bindings/src/authority';

// Import protocol contract bindings  
import { Client as ProtocolClient } from './bindings/src/protocol';
```

## Notes

- Bindings are generated using the `stellar contract bindings typescript` command
- The original npm package structure is cleaned up and only the essential TypeScript files are kept
- Documentation files are converted from README.md to .md format for each contract