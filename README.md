# attest.so

<div align="center">

![attest.so Logo](https://github.com/user-attachments/assets/520b21ee-c8d7-4bda-9809-999c489551b9)

**A Unified Trust Framework for Blockchain-Based Attestation Infrastructure**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Solana Radar Award](https://img.shields.io/badge/Solana%20Radar-Public%20Goods%20Award-yellow)](https://x.com/solana/status/1856362113561964676)
[![GitHub Issues](https://img.shields.io/github/issues/daccred/attest.so)](https://github.com/daccred/attest.so/issues)

</div>

## 🌐 Overview

**attest.so** provides enterprise-grade infrastructure for builders to create "Reputation Authorities" on-chain with verifiable and comprehensive identity proofs. The project supports multiple blockchain platforms, enabling a unified approach to attestations and identity verification.

Our framework addresses critical challenges in Web3:

- **Identity Verification**: Robust mechanisms for verifying identities across blockchain ecosystems
- **Interoperable Trust**: Consistent attestation standards across multiple blockchains
- **Reputation Management**: Infrastructure for building and maintaining on-chain reputation
- **Scalable Solutions**: Enterprise-ready attestation infrastructure for builders

## 🏗️ Architecture

### Core Concepts

- **Attestations**: Verifiable claims made by authorities about subjects
- **Schemas**: Structured templates defining attestation data formats
- **Authorities**: Entities with permission to issue and manage attestations
- **Subjects**: Entities about which attestations are made
- **Resolvers**: Contract interfaces that locate and verify attestation data

### Multi-Chain Support

attest.so is designed with cross-chain compatibility as a primary goal:

| Blockchain | Contract Language | Status      | Key Features                                            |
| ---------- | ----------------- | ----------- | ------------------------------------------------------- |
| Stellar    | Soroban (Rust)    | Active      | Fee management, levy collection, verifiable authorities |
| Solana     | Anchor (Rust)     | Development | High throughput, scalable attestation storage           |
| Starknet   | Cairo             | Planned     | ZK-friendly proofs, privacy-preserving attestations     |
| Aptos      | Move              | Research    | Resource-oriented attestation model                     |

## 🧩 Key Components

### 1. Smart Contracts

The repository contains modular smart contract implementations for multiple blockchain platforms:

#### Stellar/Soroban Implementation

```
contracts/stellar/
├── authority/        # Authority resolver contract
│   ├── src/          # Contract implementation
│   └── Cargo.toml    # Dependencies and configuration
└── protocol/         # Core attestation protocol
    ├── src/          # Contract implementation
    └── Cargo.toml    # Dependencies and configuration
```

**Key Features:**

- Authority registration and verification
- Schema definition and validation
- Attestation issuance and verification
- Optional fee collection through levy system
- Comprehensive event logging

#### Additional Blockchain Implementations

Implementation details for Solana (Anchor), Starknet (Cairo), and Aptos (Move) with blockchain-specific optimizations.

### 2. SDK (Software Development Kit)

A TypeScript SDK that provides a unified interface for interacting with attestation infrastructure:

```typescript
// Example SDK usage
import { AttestClient } from '@attest.so/sdk'

// Initialize client
const client = new AttestClient({
  chain: 'stellar',
  network: 'testnet',
})

// Create attestation
const attestation = await client.createAttestation({
  schema: 'did:attest:identity',
  subject: 'G...', // Subject address
  claims: { verified: true, level: 2 },
})
```

**Core Functionality:**

- Blockchain connection management
- Schema creation and registration
- Attestation lifecycle management
- Cross-chain verification utilities
- Typescript-first development experience

### 3. CLI (Command Line Interface)

A powerful command-line tool for interacting with the protocol:

```bash
# Install CLI
npm install -g @attest.so/cli

# Create a new attestation
attest create \
  --schema did:attest:identity \
  --subject G... \
  --chain stellar \
  --network testnet \
  --claims '{"verified": true}'
```

### 4. Documentation and Examples

Comprehensive documentation and example implementations to facilitate integration:

- Interactive API reference
- Integration guides
- Example applications
- Best practices

## 📦 Project Structure

The repository follows a monorepo structure using pnpm workspaces:

```
attest.so/
├── apps/               # Front-end applications
│   ├── docs/           # Documentation website (Next.js)
│   └── explorer/       # Attestation explorer
├── contracts/          # Smart contract implementations
│   ├── stellar/        # Soroban contracts
│   ├── solana/         # Anchor contracts
│   └── starknet/       # Cairo contracts
├── packages/           # SDK, CLI, and utilities
│   ├── sdk/            # TypeScript SDK
│   ├── cli/            # Command-line interface
│   └── common/         # Shared utilities and types
└── examples/           # Example applications
    ├── identity-verification/
    └── reputation-system/
```

See [NAMING.md](./NAMING.md) for detailed information about naming conventions and directory structure standards.

## 🛠️ Technical Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **SDK/CLI**: TypeScript, Node.js
- **Smart Contracts**:
  - Rust/Soroban (Stellar)
  - Rust/Anchor (Solana)
  - Cairo (Starknet)
  - Move (Aptos)
- **Developer Experience**:
  - pnpm workspaces
  - TypeScript
  - ESLint/Prettier
  - Jest for testing

## 🚀 Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/daccred/attest.so.git
cd attest.so

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Running the Development Environment

```bash
# Start the documentation site
pnpm run dev:docs

# Run the SDK tests
pnpm run test:sdk

# Deploy contracts to local development network
pnpm run deploy:local
```

### Working with Contracts

```bash
# Build Soroban contracts
cd contracts/stellar
stellar contract build

# Deploy to Stellar testnet
stellar contract deploy --wasm target/wasm32-unknown-unknown/release/authority.wasm --network testnet --source <source>
```

## 🤝 Contributing

Contributions are welcome! Please see our [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Setting up Rust Analyzer

Rust Analyzer is an official language server for Rust that provides features like code completion, inline type hints, and much more.

### Installation

1. Install Rust Analyzer in one of the following ways:

   - **Cursor**: Install the “Rust Analyzer” extension through Cursor’s Extensions panel (or equivalent).
   - **VS Code**: Install it from the [vsmarketplace](https://marketplace.visualstudio.com/items?itemName=matklad.rust-analyzer) or the built-in VS Code Extensions marketplace.

2. Ensure you have a working Rust toolchain installed via [rustup](https://rustup.rs/). This includes the `cargo`, `rustc`, and `rustfmt` tools.

### Configuring Linked Projects

With Rust Analyzer installed, add the following configuration to your settings so that it recognizes the additional contract projects (for example, `contracts/stellar` and `contracts/solana`). Adjust these paths if your project structure differs.

#### VS Code or Cursor

1. Open the **Preference & Settings** (`Cmd + ,` on macOS or `Ctrl + ,` on Windows/Linux).
2. Type "rust-analyzer" and press Enter.
3. Add or update the `rust-analyzer.linkedProjects` setting in the JSON file with the following snippet:

```json
{
  "rust-analyzer.linkedProjects": [
    "contracts/stellar/Cargo.toml",
    "contracts/solana/Cargo.toml",
    "contracts/starknet/Cargo.toml",
    "contracts/sui/Cargo.toml"
  ]
}
```

Optionally you can create a `.vscode/settings.json` file in the root of the project to automatically configure Rust Analyzer for VS Code with the above configuration.

---

## 📚 Resources & Links

- [Product Development Log](https://daccred.notion.site/We-re-building-https-on-the-blockchain-df20b05cb5a04e379a165714aab024fb?pvs=4)
- [Solana Radar Public Goods Award](https://x.com/solana/status/1856362113561964676)
- [Technical Documentation](https://docs.attest.so) (Coming Soon)
- [API Reference](https://docs.attest.so/api) (Coming Soon)

## 📝 License

This project is licensed under the [MIT License](./LICENSE).
