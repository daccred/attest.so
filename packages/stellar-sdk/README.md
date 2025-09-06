# Stellar Attestation Service SDK

[![NPM Version](https://img.shields.io/npm/v/@attestprotocol/stellar-sdk.svg)](https://www.npmjs.com/package/@attestprotocol/stellar-sdk)
[![License](https://img.shields.io/npm/l/@attestprotocol/stellar-sdk.svg)](https://github.com/attestprotocol/attest.so/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)

A powerful TypeScript SDK for building attestation services on the Stellar blockchain using Soroban smart contracts. Inspired by the [Ethereum Attestation Service (EAS)](https://attest.sh/) but adapted specifically for the Stellar ecosystem.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [StellarAttestationClient](#stellarattestationclient)
  - [Schema Management](#schema-management)
  - [Attestations](#attestations)
  - [Revocation](#revocation)
  - [Delegated Attestations](#delegated-attestations)
  - [Delegated Revocation](#delegated-revocation)
  - [UID Generation](#uid-generation)
  - [BLS Signatures](#bls-signatures)
  - [Data Fetching](#data-fetching)
  - [Schema Encoding](#schema-encoding)
  - [Utility Functions](#utility-functions)
- [Contributing](#contributing)
- [License](#license)

## Overview

The Stellar Attestation Service SDK provides a comprehensive framework for creating, managing, and verifying on-chain attestations. Built on top of Stellar's Soroban smart contracts, it enables enterprises and developers to issue verifiable claims about subjects with full blockchain security and transparency.

**What are Attestations?**
Attestations are signed statements about a subject (person, organization, or entity) made by an authority. They can represent identity verification, academic credentials, professional certifications, compliance checks, or any verifiable claim.

## Key Features

- 🎯 **Schema-Based Attestations**: Define structured data templates with type safety and validation.
- 🔏 **Delegated Attestations**: Support for BLS signature-based delegated attestations.
- 🔐 **On-Chain Management**: Create, revoke, and manage attestations directly on the Stellar network.
- 📚 **Standardized & Flexible**: EAS-inspired schema encoding adapted for Stellar/Soroban.
- ⚡ **Soroban Integration**: Direct integration with deployed Attestation Protocol smart contracts.
- 💪 **Full TypeScript Support**: Complete type definitions for a better developer experience.

## Installation

```bash
# Using npm
npm install @attestprotocol/stellar-sdk

# Using yarn
yarn add @attestprotocol/stellar-sdk

# Using pnpm
pnpm add @attestprotocol/stellar-sdk
```

### Peer Dependencies

The SDK requires `@stellar/stellar-sdk` as a peer dependency.

```bash
npm install @stellar/stellar-sdk
```

### Contract Deployment

Before using the SDK, ensure you have deployed the Stellar Attestation Protocol contracts to your target network. See our [deployment guide](../../contracts/stellar/README.md) for instructions.

## Quick Start

### Basic Setup

```typescript
import { StellarAttestationClient } from '@attestprotocol/stellar-sdk';
import { Keypair } from '@stellar/stellar-sdk';

// Initialize the main client
const client = new StellarAttestationClient({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  network: 'testnet',
  publicKey: 'GABC123...', // Your public key
  contractId: 'CBQHN...' // Optional: Your deployed protocol contract ID
});

// Example: Creating a new schema
const signer = Keypair.fromSecret('YOUR_SECRET_KEY');

await client.createSchema({
  definition: 'name:string,verified:bool',
  revocable: true,
  options: { signer }
});
```

## API Reference

### StellarAttestationClient

The main client class for interacting with the Attest Protocol on Stellar.

#### Constructor

```typescript
new StellarAttestationClient(options: ClientOptions)
```

**ClientOptions:**
```typescript
interface ClientOptions {
  rpcUrl: string;
  network: 'testnet' | 'mainnet';
  publicKey: string;
  contractId?: string;
  networkPassphrase?: string;
  allowHttp?: boolean;
}
```

### Schema Management

#### createSchema
Register a new schema on-chain.

**Signature:**
```typescript
async createSchema(params: CreateSchemaParams): Promise<any>
```

**Parameters:**
- `definition`: `string` - Schema definition (e.g., "name:string,age:u32").
- `resolver?`: `string` - Optional resolver address.
- `revocable?`: `boolean` - Whether attestations using this schema can be revoked (default: true).
- `options?`: `TxOptions` - Transaction options including the signer.

**Example:**
```typescript
await client.createSchema({
  definition: 'name:string,verified:bool',
  revocable: true,
  options: { signer: myKeypair }
})
```

#### getSchema
Retrieve a schema by its UID from the blockchain.

**Signature:**
```typescript
async getSchema(uid: Buffer): Promise<any>
```

**Parameters:**
- `uid`: `Buffer` - 32-byte schema UID.

**Example:**
```typescript
const schema = await client.getSchema(Buffer.from('abc123...', 'hex'));
```

### Attestations

#### attest
Create a new attestation on-chain.

**Signature:**
```typescript
async attest(params: AttestParams): Promise<any>
```

**Parameters:**
- `schemaUid`: `Buffer` - 32-byte schema identifier.
- `value`: `string` - Attestation data, typically a JSON string.
- `subject?`: `string` - Who the attestation is about (defaults to the caller's public key).
- `expirationTime?`: `number` - Unix timestamp when the attestation expires.
- `options?`: `TxOptions` - Transaction options including the signer.

**Example:**
```typescript
await client.attest({
  schemaUid: Buffer.from('abc123...', 'hex'),
  value: JSON.stringify({ name: 'John Doe', verified: true }),
  subject: 'GSUBJECT123...',
  options: { signer: myKeypair }
})
```

#### getAttestation
Retrieve an attestation by its UID from the blockchain.

**Signature:**
```typescript
async getAttestation(uid: Buffer): Promise<any>
```

**Parameters:**
- `uid`: `Buffer` - 32-byte attestation UID.

**Example:**
```typescript
const attestation = await client.getAttestation(Buffer.from('def456...', 'hex'));
```

### Revocation

#### revoke
Revoke an existing attestation on-chain.

**Signature:**
```typescript
async revoke(params: RevokeParams): Promise<any>
```

**Parameters:**
- `attestationUid`: `Buffer` - 32-byte UID of the attestation to revoke.
- `options?`: `TxOptions` - Transaction options including the signer.

**Example:**
```typescript
await client.revoke({
  attestationUid: Buffer.from('abc123...', 'hex'),
  options: { signer: myKeypair }
})
```

### Delegated Attestations

#### attestByDelegation
Create an attestation using a delegated BLS signature. This allows an authority to sign an attestation message off-chain, and a third party can submit it on-chain.

**Signature:**
```typescript
async attestByDelegation(request: DelegatedAttestationRequest, options?: TxOptions): Promise<any>
```

**Parameters:**
- `request`: `DelegatedAttestationRequest` - Contains attestation data and a BLS signature.
- `options?`: `TxOptions` - Transaction options.

**Example:**
```typescript
const request = await createDelegatedAttestationRequest({...});
await client.attestByDelegation(request, { signer: myKeypair });
```

#### createAttestMessage
Create a message point for BLS signing, required for delegated attestations.

**Signature:**
```typescript
createAttestMessage(request: DelegatedAttestationRequest, dst: Buffer): WeierstrassPoint<bigint>
```

#### getAttestDST
Get the domain separation tag (DST) for attestation signatures.

**Signature:**
```typescript
async getAttestDST(): Promise<Buffer>
```

### Delegated Revocation

#### revokeByDelegation
Revoke an attestation using a delegated BLS signature.

**Signature:**
```typescript
async revokeByDelegation(request: DelegatedRevocationRequest, options?: TxOptions): Promise<any>
```

**Parameters:**
- `request`: `DelegatedRevocationRequest` - Contains revocation data and a BLS signature.
- `options?`: `TxOptions` - Transaction options.

**Example:**
```typescript
const request = await createDelegatedRevocationRequest({...});
await client.revokeByDelegation(request, { signer: myKeypair });
```

#### createRevokeMessage
Create a message point for BLS signing, required for delegated revocations.

**Signature:**
```typescript
createRevokeMessage(request: DelegatedRevocationRequest, dst: Buffer): WeierstrassPoint<bigint>
```

#### getRevokeDST
Get the domain separation tag (DST) for revocation signatures.

**Signature:**
```typescript
async getRevokeDST(): Promise<Buffer>
```

### UID Generation

#### generateAttestationUid
Generate a deterministic 32-byte UID for an attestation.

**Signature:**
```typescript
generateAttestationUid(schemaUid: Buffer, subject: string, nonce: bigint): Buffer
```

#### generateSchemaUid
Generate a deterministic 32-byte UID for a schema.

**Signature:**
```typescript
generateSchemaUid(definition: string, authority: string, resolver?: string): Buffer
```

### BLS Signatures

#### generateBlsKeys
Generate a new BLS key pair for delegated signatures.

**Signature:**
```typescript
generateBlsKeys(): BlsKeyPair
```

**Returns:** `BlsKeyPair` with `privateKey` (32 bytes) and `publicKey` (192 bytes uncompressed).

#### signHashedMessage
Sign a hashed message point using a BLS private key.

**Signature:**
```typescript
signHashedMessage(message: WeierstrassPoint<bigint>, privateKey: Uint8Array): Buffer
```

#### verifySignature
Verify a BLS signature against the expected message and public key.

**Signature:**
```typescript
verifySignature({ signature, expectedMessage, publicKey }): VerificationResult
```

### Data Fetching

The SDK provides several methods to fetch data from the Attestation Protocol's indexer API.

- `fetchAttestations(limit?: number)`: Fetch the latest attestations.
- `fetchAttestationsByWallet(walletAddress: string, limit?: number)`: Fetch attestations created by a specific wallet.
- `getAttestationsByLedger(ledger: number, limit?: number)`: Fetch attestations from a specific ledger.
- `getAttestationByUid(uid: string)`: Fetch a single attestation by its UID.
- `fetchSchemas(limit?: number)`: Fetch the latest schemas.
- `fetchSchemasByWallet(walletAddress: string, limit?: number)`: Fetch schemas created by a specific wallet.
- `getSchemasByLedger(ledger: number, limit?: number)`: Fetch schemas from a specific ledger.
- `getSchemaByUid(uid: string)`: Fetch a single schema by its UID.
- `fetchRegistryDump()`: Fetch a complete dump of all schemas and attestations.

### Schema Encoding

#### SorobanSchemaEncoder
A class for encoding and decoding structured data based on a schema definition.

**Constructor:**
```typescript
new SorobanSchemaEncoder(definition: StellarSchemaDefinition)
```

#### encodeSchema / decodeSchema
Functions for encoding and decoding schema data to/from an XDR string format.

**Signatures:**
```typescript
encodeSchema(schema: any): string
decodeSchema(encoded: string): any
```

### Utility Functions

#### submitTransaction
Submit a signed transaction XDR to the Stellar network.

**Signature:**
```typescript
async submitTransaction(signedXdr: string, options?: SubmitOptions): Promise<any>
```

#### Helper Functions
The SDK includes helper functions to simplify the creation of delegated requests:

- `createDelegatedAttestationRequest(...)`
- `createDelegatedRevocationRequest(...)`

## Contributing

We welcome contributions to the Stellar Attestation Service SDK! Please see our [Contributing Guide](../../CONTRIBUTING.md) for detailed information on how to get started, our development process, and coding standards.

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.