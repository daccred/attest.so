![GITHUB](https://github.com/user-attachments/assets/520b21ee-c8d7-4bda-9809-999c489551b9)

# attest.so
A Unified Trust Framework for blockchain-based attestation infrastructure

## Overview
attest.so provides infrastructure for builders to create "Reputation Authorities" onchain with verifiable and comprehensive identity proofs. The project supports multiple blockchain platforms, enabling a unified approach to attestations.

## Key Components

### 1. Smart Contracts
The repository contains smart contract implementations for multiple blockchain platforms:
- **Solana**: Using Anchor framework for attestation services, schema registry, and resolver functionality
- **Starknet**: Using Cairo language implementation
- **Stellar**: Using Soroban smart contract platform
- **Aptos**: Using Move language

Core attestation functionality includes:
- Creating and registering schemas
- Issuing attestations
- Revoking attestations
- Managing attestation authorities
- Optional fee collection through a levy system

### 2. SDK (Software Development Kit)
A TypeScript SDK that provides methods for:
- Connecting to blockchain platforms
- Creating and registering schemas
- Attestation creation, verification and management
- Attestation querying and status verification

### 3. CLI (Command Line Interface)
A command-line tool to interact with the protocol, allowing users to:
- Create and publish schemas
- Fetch attestation data
- Manage attestations without direct SDK usage

### 4. Documentation Website
A Next.js-based documentation site with guides and references.

## Project Structure
The repository follows a monorepo structure using pnpm workspaces:
- **/apps**: Front-end applications, including the documentation website
- **/contracts**: Smart contract implementations for different blockchains
- **/packages**: SDK, CLI, and shared utilities
- **/examples**: Example applications showing usage patterns

See [NAMING.md](./NAMING.md) for details about the naming conventions and directory structure standards used in this project.

## Technical Stack
- **Frontend**: Next.js, React, Tailwind CSS
- **SDK/CLI**: TypeScript, Node.js
- **Smart Contracts**: Rust/Anchor (Solana), Cairo (Starknet), Soroban (Stellar), Move (Aptos)
- **Package Management**: pnpm workspaces
- **Build Tools**: TypeScript, ESLint, Prettier, Jest for testing

## Installation
```bash
git clone https://github.com/daccred/attest.so.git
cd attest.so
pnpm install
```

## Usage
```bash
pnpm dev  # Start the development server
```

## Deployments
WIP

## Resources & Links
- Product log and [research room](https://daccred.notion.site/We-re-building-https-on-the-blockchain-df20b05cb5a04e379a165714aab024fb?pvs=4)
- Solana Radar [Public Goods Award](https://x.com/solana/status/1856362113561964676)

## License
MIT