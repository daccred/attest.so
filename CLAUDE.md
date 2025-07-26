# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

attest.so is a unified trust framework for blockchain-based attestation infrastructure. It provides enterprise-grade infrastructure for builders to create "Reputation Authorities" on-chain, enabling verifiable claims about subjects across multiple blockchains.

## Supported Blockchains

- **Stellar** (Active) - Soroban smart contracts in Rust
- **Solana** (Development) - Anchor framework contracts in Rust
- **Starknet** (Planned) - Cairo smart contracts
- **Aptos** (Research) - Move smart contracts
- **Sui** (Research) - Move smart contracts

## Architecture

### Core Concepts
- **Attestations**: Verifiable claims made by authorities about subjects
- **Schemas**: Structured templates defining attestation data formats
- **Authorities**: Entities with permission to issue and manage attestations
- **Subjects**: Entities about which attestations are made
- **Resolvers**: Contract interfaces that locate and verify attestation data

### Monorepo Structure
```
apps/
  horizon/         # Stellar blockchain indexer (Express.js + MongoDB)
  horizon-indexer/ # Additional indexer component
  www/            # Documentation site (Next.js + Fumadocs)
contracts/
  solana/         # Anchor-based Solana contracts
  stellar/        # Soroban contracts (authority & protocol)
  starknet/       # Cairo contracts
  aptos/          # Move contracts
  sui/            # Move contracts
packages/
  sdk/            # TypeScript SDK for all chains
  solana-cli/     # Solana-specific CLI
  stellar-cli/    # Stellar-specific CLI
  starknet-cli/   # Starknet-specific CLI
examples/         # Example implementations
```

## Common Development Commands

### Essential Commands
```bash
# Install dependencies (must use pnpm)
pnpm install

# Build all packages
pnpm build

# Run development servers
pnpm dev

# Run all tests
pnpm test

# Lint and format
pnpm lint
pnpm format
```

### Working with Specific Packages
```bash
# Run commands on specific workspace
pnpm --filter @attestprotocol/sdk build
pnpm --filter @attestprotocol/www dev

# Start documentation site (Fumadocs on port 3001)
pnpm run dev:docs

# Start Mintlify documentation (port 3001)
pnpm dev:docs
```

### Contract Development

#### Stellar/Soroban
```bash
cd contracts/stellar/protocol
make all          # fmt, lint, test, and build
make test         # Run tests only
make build        # Build contract only

cd contracts/stellar/authority
make all          # fmt, lint, and build
```

#### Solana/Anchor
```bash
cd contracts/solana
anchor build      # Build programs
anchor test       # Run tests
pnpm deploy:attestso  # Deploy to Solana
```

#### Starknet/Cairo
```bash
cd contracts/starknet
scarb build       # Build contracts
scarb test        # Run tests
```

### SDK Development
```bash
cd packages/sdk
pnpm build        # Build all formats (CJS, ESM, UMD)
pnpm test-stellar # Test Stellar implementation
pnpm test-solana  # Test Solana implementation
```

### Testing
```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @attestprotocol/sdk test
pnpm --filter @attestprotocol/horizon test

# Watch mode for development
pnpm test:watch
```

### Release Process
```bash
# Create changeset for version bump
pnpm changeset

# Version packages
pnpm release:version

# Release Stellar contracts with specific version
pnpm release:stellar 1.0.0

# Full release (version + publish)
pnpm release
```

## Important Conventions

### Naming Convention (from NAMING.md)
- Avoid redundant prefixes in platform-specific directories
- ✅ `contracts/solana/attestation-service/`
- ❌ `contracts/solana/solana-attestation-service/`

### Code Style
- TypeScript with strict mode
- ESLint + Prettier for formatting
- Conventional commits (enforced by commitlint)
- Follow existing patterns in neighboring files

### Development Requirements
- Node.js and pnpm (required)
- Rust + Cargo (for Stellar/Solana contracts)
- Scarb (for Starknet contracts)
- Anchor CLI (for Solana development)

## Testing Strategy

- Unit tests for all SDK functions
- Integration tests for contract interactions
- Use Vitest for TypeScript/JavaScript tests
- Use `cargo test` for Rust contracts
- Use `scarb test` (snforge) for Cairo contracts

## Key Implementation Details

### SDK Architecture
- Unified interface across all blockchains
- Platform-specific implementations in `src/chains/`
- Built for both Node.js and browser environments
- Published to npm and JSR

### Contract Features
- Schema management for structured attestations
- Authority verification and permission management
- Attestation lifecycle (create, revoke, expire)
- Resolver interfaces for attestation discovery

### Documentation Site
- Built with Next.js 14 and Fumadocs
- API documentation using Scalar
- Served on port 3001 in development
- Custom fonts: SNPro, Mona Sans, PP Supply Mono

## Security Notes
- Never commit secrets or API keys
- Follow existing security patterns in the codebase
- Basic SECURITY.md exists but needs version support updates

## Useful Resources
- Main documentation: Run `pnpm run dev:docs` and visit http://localhost:3001
- Contract deployment scripts in `contracts/*/deploy.sh`
- Integration examples in `examples/` directory