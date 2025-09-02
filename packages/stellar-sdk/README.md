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
- [Core API Reference](#core-api-reference)
- [Schema Management](#schema-management)
- [Attestation Operations](#attestation-operations)
- [Delegated Attestations](#delegated-attestations)
- [Utility Functions](#utility-functions)
- [Common Use Cases](#common-use-cases)
- [Advanced Features](#advanced-features)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Resources](#resources)

## Overview

The Stellar Attestation Service SDK provides a comprehensive framework for creating, managing, and verifying on-chain attestations. Built on top of Stellar's Soroban smart contracts, it enables enterprises and developers to issue verifiable claims about subjects with full blockchain security and transparency.

**What are Attestations?**
Attestations are signed statements about a subject (person, organization, or entity) made by an authority. They can represent identity verification, academic credentials, professional certifications, compliance checks, or any verifiable claim.

## Key Features

- 🎯 **Schema-Based Attestations**: Define structured data templates with type safety and validation
- 🔐 **Authority Management**: Control who can issue and revoke attestations
- 📋 **Standardized Encoding**: EAS-inspired schema encoding adapted for Stellar/Soroban
- 📚 **Pre-Built Schemas**: Ready-to-use schemas for common attestation types
- 💪 **Full TypeScript Support**: Complete type definitions and IntelliSense support
- ⚡ **Contract Integration**: Direct integration with deployed Soroban contracts
- 🔄 **Batch Operations**: Efficient bulk attestation creation and management
- 🔍 **Advanced Querying**: Find attestations by subject, schema, or custom criteria
- 🛠 **Internal Utilities**: Comprehensive utility functions for testing and development
- 🔏 **Delegated Attestations**: Support for BLS signature-based delegated attestations

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

The SDK requires these peer dependencies:

```bash
npm install @stellar/stellar-sdk
```

### Contract Deployment

Before using the SDK, ensure you have deployed the Stellar Attestation Protocol contracts to your target network. See our [deployment guide](../../contracts/stellar/README.md) for instructions.

## Quick Start

### Basic Setup

```typescript
import StellarAttestProtocol from '@attestprotocol/stellar-sdk'
import { Networks } from '@stellar/stellar-sdk'

// Initialize the main client
const client = new StellarAttestationClient({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  network: 'testnet',
  publicKey: 'GABC123...',
  contractId: 'CBQHN...' // Optional: Protocol contract ID
})

// Or use the legacy SDK interface
const sdk = new StellarAttestProtocol({
  secretKeyOrCustomSigner: 'YOUR_SECRET_KEY',
  publicKey: 'YOUR_PUBLIC_KEY',
  url: 'https://soroban-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET,
  contractAddresses: {
    protocol: 'YOUR_PROTOCOL_CONTRACT_ID',
    authority: 'YOUR_AUTHORITY_CONTRACT_ID'
  }
})

// Initialize the protocol
await sdk.initialize()
```

## Core API Reference

### StellarAttestationClient

The main client class for interacting with the Attest Protocol on Stellar.

#### Constructor
```typescript
new StellarAttestationClient(options: ClientOptions)
```

**ClientOptions:**
```typescript
interface ClientOptions {
  rpcUrl: string
  network: 'testnet' | 'mainnet'
  publicKey: string
  contractId?: string
  networkPassphrase?: string
  allowHttp?: boolean
}
```

**Example:**
```typescript
const client = new StellarAttestationClient({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  network: 'testnet',
  publicKey: 'GABC123...'
})
```

## Schema Management

### Creating Schemas

#### createSchema
```typescript
async createSchema(params: CreateSchemaParams): Promise<any>
```

Register a new schema on-chain.

**Parameters:**
- `definition`: string - Schema definition like "name:string,age:u32"
- `resolver?`: string - Optional resolver address
- `revocable?`: boolean - Whether attestations can be revoked (default: true)
- `options?`: TxOptions - Transaction options including signer

**Example:**
```typescript
await client.createSchema({
  definition: 'name:string,verified:bool',
  revocable: true,
  options: { signer: myKeypair }
})
```

#### getSchema
```typescript
async getSchema(uid: Buffer): Promise<any>
```

Retrieve a schema by its UID from the blockchain.

**Example:**
```typescript
const schema = await client.getSchema(Buffer.from('abc123...', 'hex'))
```

### Schema Encoding

#### SorobanSchemaEncoder
```typescript
new SorobanSchemaEncoder(definition: StellarSchemaDefinition)
```

Create a schema encoder for non-XDR structured data.

**Example:**
```typescript
const encoder = new SorobanSchemaEncoder({
  name: 'UserProfile',
  fields: [
    { name: 'username', type: StellarDataType.STRING },
    { name: 'age', type: StellarDataType.U32, optional: true }
  ]
})
```

#### XDR Schema Encoding

##### encodeSchema
```typescript
encodeSchema(schema: any): string
```

Encode schema data to XDR format for blockchain storage.

**Example:**
```typescript
const xdrString = client.encodeSchema({ name: 'TestSchema', fields: [...] })
// Returns: "XDR:AAAAB..."
```

##### decodeSchema
```typescript
decodeSchema(encoded: string): any
```

Decode XDR-encoded schema data back to JavaScript object.

**Example:**
```typescript
const schema = client.decodeSchema('XDR:AAAAB...')
```

## Attestation Operations

### Basic Attestation

#### attest
```typescript
async attest(params: AttestParams): Promise<any>
```

Create a new attestation on-chain.

**Parameters:**
- `schemaUid`: Buffer - 32-byte schema identifier
- `value`: string - Attestation data (usually JSON)
- `subject?`: string - Who the attestation is about (defaults to caller)
- `expirationTime?`: number - Unix timestamp when attestation expires
- `options?`: TxOptions - Transaction options including signer

**Example:**
```typescript
await client.attest({
  schemaUid: Buffer.from('abc123...', 'hex'),
  value: JSON.stringify({ name: 'John', verified: true }),
  subject: 'GSUBJECT123...',
  options: { signer: myKeypair }
})
```

#### getAttestation
```typescript
async getAttestation(uid: Buffer): Promise<any>
```

Retrieve an attestation by its UID from the blockchain.

**Example:**
```typescript
const attestation = await client.getAttestation(Buffer.from('def456...', 'hex'))
```

### Revocation

#### revoke
```typescript
async revoke(params: RevokeParams): Promise<any>
```

Revoke an existing attestation.

**Parameters:**
- `attestationUid`: Buffer - 32-byte attestation UID to revoke
- `options?`: TxOptions - Transaction options including signer

**Example:**
```typescript
await client.revoke({
  attestationUid: Buffer.from('abc123...', 'hex'),
  options: { signer: myKeypair }
})
```

## Delegated Attestations

### Delegated Attestation Creation

#### attestByDelegation
```typescript
async attestByDelegation(request: DelegatedAttestationRequest, options?: TxOptions): Promise<any>
```

Create an attestation using a delegated signature.

**Example:**
```typescript
const request = await createDelegatedAttestationRequest({...})
await client.attestByDelegation(request, { signer: myKeypair })
```

#### createAttestMessage
```typescript
createAttestMessage(request: DelegatedAttestationRequest, dst: Buffer): WeierstrassPoint<bigint>
```

Create a message point for BLS signing in delegated attestation.

**Example:**
```typescript
const dst = await getAttestDST(client.getClientInstance())
const messagePoint = createAttestMessage(attestRequest, dst)
```

#### getAttestDST
```typescript
async getAttestDST(): Promise<Buffer>
```

Get the domain separation tag for attestation signatures.

**Example:**
```typescript
const dst = await client.getAttestDST()
```

### Delegated Revocation

#### revokeByDelegation
```typescript
async revokeByDelegation(request: DelegatedRevocationRequest, options?: TxOptions): Promise<any>
```

Revoke an attestation using a delegated signature.

**Example:**
```typescript
const request = await createDelegatedRevocationRequest({...})
await client.revokeByDelegation(request, { signer: myKeypair })
```

#### createRevokeMessage
```typescript
createRevokeMessage(request: DelegatedRevocationRequest, dst: Buffer): WeierstrassPoint<bigint>
```

Create a message point for BLS signing in delegated revocation.

**Example:**
```typescript
const dst = await getRevokeDST(client.getClientInstance())
const messagePoint = createRevokeMessage(revokeRequest, dst)
```

#### getRevokeDST
```typescript
async getRevokeDST(): Promise<Buffer>
```

Get the domain separation tag for revocation signatures.

**Example:**
```typescript
const dst = await client.getRevokeDST()
```

## Utility Functions

### UID Generation

#### generateAttestationUid
```typescript
generateAttestationUid(schemaUid: Buffer, subject: string, nonce: bigint): Buffer
```

Generate a deterministic 32-byte UID for an attestation.

**Example:**
```typescript
const uid = client.generateAttestationUid(
  Buffer.from('abc123...', 'hex'),
  'GSUBJECT123...',
  BigInt(12345)
)
```

#### generateSchemaUid
```typescript
generateSchemaUid(definition: string, authority: string, resolver?: string): Buffer
```

Generate a deterministic 32-byte UID for a schema.

**Example:**
```typescript
const uid = client.generateSchemaUid(
  'name:string,verified:bool',
  'GAUTHORITY123...',
  'GRESOLVER456...'
)
```

### BLS Signature Operations

#### generateBlsKeys
```typescript
generateBlsKeys(): BlsKeyPair
```

Generate a new BLS key pair for delegated signatures.

**Returns:** BlsKeyPair with privateKey (32 bytes) and publicKey (192 bytes uncompressed)

**Example:**
```typescript
const { privateKey, publicKey } = client.generateBlsKeys()
```

#### signHashedMessage
```typescript
signHashedMessage(message: WeierstrassPoint<bigint>, privateKey: Uint8Array): Buffer
```

Sign a hashed message point using BLS private key.

**Example:**
```typescript
const messagePoint = createAttestMessage(request, dst)
const signature = signHashedMessage(messagePoint, privateKey)
```

#### verifySignature
```typescript
verifySignature({ signature, expectedMessage, publicKey }): VerificationResult
```

Verify a BLS signature against expected message and public key.

**Example:**
```typescript
const result = client.verifySignature({
  signature: signatureBuffer,
  expectedMessage: messagePoint,
  publicKey: publicKeyBuffer
})
console.log('Valid:', result.isValid)
```

### Data Fetching

#### fetchAttestations
```typescript
async fetchAttestations(limit: number = 100): Promise<ContractAttestation[]>
```

Fetch the latest attestations from the registry (max 100).

**Example:**
```typescript
const attestations = await client.fetchAttestations(50)
```

#### fetchAttestationsByWallet
```typescript
async fetchAttestationsByWallet(walletAddress: string, limit?: number): Promise<{ 
  attestations: ContractAttestation[], 
  total: number, 
  hasMore: boolean 
}>
```

Fetch attestations created by a specific wallet (max 100).

**Example:**
```typescript
const result = await client.fetchAttestationsByWallet('GATTESTER123...', 25)
console.log(`Found ${result.attestations.length} attestations`)
```

#### fetchSchemas
```typescript
async fetchSchemas(limit: number = 100): Promise<ContractSchema[]>
```

Fetch the latest schemas from the registry (max 100).

**Example:**
```typescript
const schemas = await client.fetchSchemas(30)
```

#### fetchSchemasByWallet
```typescript
async fetchSchemasByWallet(walletAddress: string, limit?: number): Promise<{ 
  schemas: ContractSchema[], 
  total: number, 
  hasMore: boolean 
}>
```

Fetch schemas created by a specific wallet (max 100).

**Example:**
```typescript
const result = await client.fetchSchemasByWallet('GCREATOR123...', 20)
console.log(`Found ${result.schemas.length} schemas`)
```

### Transaction Submission

#### submitTransaction
```typescript
async submitTransaction(signedXdr: string, options?: SubmitOptions): Promise<any>
```

Submit a signed transaction to the Stellar network.

**Example:**
```typescript
const result = await client.submitTransaction(signedTxXdr)
```

### Helper Functions

#### createDelegatedAttestationRequest
```typescript
async createDelegatedAttestationRequest(
  params: {...}, 
  privateKey: Uint8Array, 
  client: ProtocolClient
): Promise<DelegatedAttestationRequest>
```

Create a complete delegated attestation request with BLS signature.

**Parameters:**
- `schemaUid`: Buffer
- `subject`: string
- `data`: string
- `expirationTime?`: number
- `nonce?`: bigint
- `privateKey`: Uint8Array - BLS private key for signing
- `client`: ProtocolClient - For fetching DST and nonce

**Example:**
```typescript
const request = await createDelegatedAttestationRequest({
  schemaUid: Buffer.from('abc...', 'hex'),
  subject: 'GSUBJECT...',
  data: JSON.stringify({verified: true})
}, blsPrivateKey, client.getClientInstance())
```

#### createDelegatedRevocationRequest
```typescript
async createDelegatedRevocationRequest(
  params: {...}, 
  privateKey: Uint8Array, 
  client: ProtocolClient
): Promise<DelegatedRevocationRequest>
```

Create a complete delegated revocation request with BLS signature.

**Example:**
```typescript
const request = await createDelegatedRevocationRequest({
  attestationUid: Buffer.from('def...', 'hex')
}, blsPrivateKey, client.getClientInstance())
```

## Common Use Cases

### Identity Verification Service

```typescript
// Complete identity verification flow
class IdentityVerificationService {
  constructor(private client: StellarAttestationClient) {}

  async verifyIdentity(userData: {
    fullName: string
    documentType: 'passport' | 'drivers_license' | 'national_id'
    documentNumber: string
    userAddress: string
  }) {
    // Create attestation
    const attestationData = {
      fullName: userData.fullName,
      documentType: userData.documentType,
      documentHash: this.hashDocument(userData.documentNumber),
      verificationLevel: 'enhanced',
      verificationDate: Date.now(),
      verifiedBy: this.client.publicKey
    }

    const result = await this.client.attest({
      schemaUid: await this.getIdentitySchemaUid(),
      value: JSON.stringify(attestationData),
      subject: userData.userAddress,
      expirationTime: Date.now() + (2 * 365 * 24 * 60 * 60 * 1000), // 2 years
      options: { signer: this.signer }
    })

    return {
      attestationUid: result,
      verificationLevel: 'enhanced',
      validUntil: new Date(Date.now() + (2 * 365 * 24 * 60 * 60 * 1000))
    }
  }

  private hashDocument(documentNumber: string): string {
    // In production, use proper hashing
    return `sha256:${documentNumber.slice(0, 3)}...${documentNumber.slice(-3)}`
  }

  private async getIdentitySchemaUid(): Promise<Buffer> {
    // Implementation to get or create identity schema
    return Buffer.from('your-identity-schema-uid', 'hex')
  }
}
```

### Academic Credential Issuer

```typescript
// University degree attestation system
class UniversityCredentialIssuer {
  constructor(private client: StellarAttestationClient) {}

  async issueDegree(graduateData: {
    studentName: string
    studentAddress: string
    degree: string
    fieldOfStudy: string
    graduationDate: string
    gpa?: number
    honors?: string
  }) {
    const credentialData = {
      studentName: graduateData.studentName,
      institution: 'Stanford University',
      degree: graduateData.degree,
      fieldOfStudy: graduateData.fieldOfStudy,
      graduationDate: new Date(graduateData.graduationDate).getTime(),
      gpa: graduateData.gpa ? Math.round(graduateData.gpa * 100) : undefined,
      honors: graduateData.honors || 'none'
    }

    // Issue permanent credential (no expiration)
    const result = await this.client.attest({
      schemaUid: await this.getDegreeSchemaUid(),
      value: JSON.stringify(credentialData),
      subject: graduateData.studentAddress,
      expirationTime: undefined, // Degrees don't expire
      options: { signer: this.signer }
    })

    return {
      attestationUid: result,
      credentialType: 'degree',
      institution: 'Stanford University',
      verifiable: true
    }
  }

  private async getDegreeSchemaUid(): Promise<Buffer> {
    return Buffer.from('your-degree-schema-uid', 'hex')
  }
}
```

### KYC/AML Compliance

```typescript
// KYC/AML compliance attestation system
class ComplianceService {
  constructor(private client: StellarAttestationClient) {}

  async performKYC(customerData: {
    customerAddress: string
    fullName: string
    dateOfBirth: string
    nationality: string
    documentType: string
    documentNumber: string
  }) {
    // Perform background checks
    const riskAssessment = await this.performRiskAssessment(customerData)
    
    // Create compliance attestation
    const kycData = {
      subjectAddress: customerData.customerAddress,
      verificationTier: riskAssessment.tier,
      riskScore: riskAssessment.score,
      documentsVerified: ['identity', 'address'],
      verificationDate: Date.now(),
      complianceStatus: riskAssessment.approved ? 'approved' : 'rejected',
      reviewedBy: this.client.publicKey
    }

    const result = await this.client.attest({
      schemaUid: await this.getKYCSchemaUid(),
      value: JSON.stringify(kycData),
      subject: customerData.customerAddress,
      expirationTime: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
      options: { signer: this.signer }
    })

    return {
      attestationUid: result,
      status: riskAssessment.approved ? 'approved' : 'rejected',
      riskLevel: riskAssessment.tier,
      validUntil: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))
    }
  }

  private async performRiskAssessment(customerData: any) {
    // Mock risk assessment - replace with real implementation
    const score = Math.floor(Math.random() * 100)
    return {
      score,
      tier: score < 30 ? 'low' : score < 70 ? 'medium' : 'high',
      approved: score < 80
    }
  }

  private async getKYCSchemaUid(): Promise<Buffer> {
    return Buffer.from('your-kyc-schema-uid', 'hex')
  }
}
```

## Advanced Features

### Batch Operations

```typescript
// Efficient batch attestation creation
async function createBatchAttestations(client: StellarAttestationClient) {
  const attestations = [
    {
      schemaUid: Buffer.from('identity-schema-uid', 'hex'),
      value: JSON.stringify({ name: 'User 1', verified: true }),
      subject: 'GUSER1...ADDRESS'
    },
    {
      schemaUid: Buffer.from('identity-schema-uid', 'hex'),
      value: JSON.stringify({ name: 'User 2', verified: true }),
      subject: 'GUSER2...ADDRESS'
    }
  ]

  // Process attestations in batch
  for (const attestation of attestations) {
    await client.attest({
      ...attestation,
      options: { signer: myKeypair }
    })
  }
}
```

### Delegated Attestations with BLS

```typescript
// Complete delegated attestation flow
async function createDelegatedAttestation(client: StellarAttestationClient) {
  // 1. Generate BLS keys
  const { privateKey, publicKey } = generateBlsKeys()
  
  // 2. Get domain separation tag
  const dst = await client.getAttestDST()
  
  // 3. Create attestation request
  const request: DelegatedAttestationRequest = {
    schemaUid: Buffer.from('schema-uid', 'hex'),
    subject: 'GSUBJECT...',
    data: JSON.stringify({ verified: true }),
    expirationTime: Date.now() + 86400000,
    nonce: BigInt(1)
  }
  
  // 4. Create message point for signing
  const messagePoint = createAttestMessage(request, dst)
  
  // 5. Sign the message
  const signature = signHashedMessage(messagePoint, privateKey)
  
  // 6. Add signature to request
  const signedRequest = {
    ...request,
    signature,
    publicKey
  }
  
  // 7. Submit delegated attestation
  await client.attestByDelegation(signedRequest, { signer: myKeypair })
}
```

### Advanced Querying

```typescript
// Complex attestation queries
class AttestationQueryService {
  constructor(private client: StellarAttestationClient) {}

  async findVerifiedUsers(schemaUid: string, verificationLevel: string = 'enhanced') {
    // Fetch attestations by schema
    const attestations = await this.client.fetchSchemas(100)
    
    // Filter and parse attestations
    const verifiedUsers = []
    for (const attestation of attestations) {
      try {
        const data = JSON.parse(attestation.data)
        if (data.verificationLevel === verificationLevel) {
          verifiedUsers.push({
            subject: attestation.subject,
            data,
            timestamp: attestation.timestamp
          })
        }
      } catch {
        // Skip invalid data
      }
    }
    
    return verifiedUsers
  }

  async getUserAttestationSummary(userAddress: string) {
    const result = await this.client.fetchAttestationsByWallet(userAddress)
    
    const summary = {
      total: result.total,
      active: 0,
      expired: 0,
      revoked: 0,
      bySchema: {} as Record<string, number>
    }

    for (const attestation of result.attestations) {
      // Check status
      if (attestation.revoked) {
        summary.revoked++
      } else if (attestation.expirationTime && attestation.expirationTime < Date.now()) {
        summary.expired++
      } else {
        summary.active++
      }
      
      // Group by schema
      const schemaId = attestation.schemaUid.toString('hex')
      summary.bySchema[schemaId] = (summary.bySchema[schemaId] || 0) + 1
    }

    return summary
  }
}
```

## Error Handling

### Comprehensive Error Handling

```typescript
import { AttestProtocolErrorType } from '@attestprotocol/stellar-sdk'

async function robustAttestationCreation(
  client: StellarAttestationClient,
  attestationData: any
) {
  try {
    const result = await client.attest(attestationData)
    return result
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR') {
      console.error('Data validation failed:', error.message)
      // Show user-friendly validation errors
    } else if (error.code === 'NETWORK_ERROR') {
      console.error('Network connection failed:', error.message)
      // Retry logic or show connectivity issues
    } else if (error.code === 'UNAUTHORIZED') {
      console.error('Not authorized:', error.message)
      // Redirect to authorization flow
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      console.error('Insufficient funds for transaction:', error.message)
      // Show funding instructions
    } else {
      console.error('Unknown error:', error.message)
    }
    return null
  }
}

// Error recovery with retry
async function createAttestationWithRetry(
  client: StellarAttestationClient,
  attestationData: any,
  maxRetries: number = 3
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await robustAttestationCreation(client, attestationData)
      if (result) return result
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error.message)
      
      if (attempt === maxRetries) {
        console.error('All retry attempts failed')
        return null
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }
  
  return null
}
```

## Best Practices

### 1. Schema Design

```typescript
// ✅ Good schema design
const goodSchema = new SorobanSchemaEncoder({
  name: 'Professional License',
  version: '1.0.0',
  description: 'Professional license verification with clear validation rules',
  fields: [
    {
      name: 'licenseNumber',
      type: StellarDataType.STRING,
      description: 'Unique license identifier',
      validation: { pattern: '^[A-Z]{2}[0-9]{6}$' }
    },
    {
      name: 'profession',
      type: StellarDataType.STRING,
      description: 'Licensed profession',
      validation: { enum: ['doctor', 'lawyer', 'engineer', 'architect'] }
    },
    {
      name: 'issueDate',
      type: StellarDataType.TIMESTAMP,
      description: 'When the license was issued'
    },
    {
      name: 'expiryDate',
      type: StellarDataType.TIMESTAMP,
      optional: true,
      description: 'When the license expires (null for permanent licenses)'
    }
  ],
  metadata: {
    category: 'professional',
    revocable: true,
    expirable: true
  }
})
```

### 2. Data Privacy and Security

```typescript
// Privacy-preserving attestation patterns
class PrivacyPreservingAttestations {
  // Hash sensitive data before storing
  static hashSensitiveData(data: string): string {
    const crypto = require('crypto')
    return 'sha256:' + crypto.createHash('sha256').update(data).digest('hex')
  }

  // Create minimal disclosure attestation
  static createMinimalDisclosureAttestation(userData: {
    fullName: string
    documentNumber: string
    dateOfBirth: string
  }) {
    return {
      nameHash: this.hashSensitiveData(userData.fullName),
      documentHash: this.hashSensitiveData(userData.documentNumber),
      ageVerified: this.isAdult(userData.dateOfBirth),
      verificationDate: Date.now()
    }
  }

  private static isAdult(dateOfBirth: string): boolean {
    const age = (Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    return age >= 18
  }
}
```

### 3. Performance Optimization

```typescript
// Caching for frequently accessed schemas
class SchemaCache {
  private cache = new Map<string, any>()
  private cacheExpiry = new Map<string, number>()
  private ttl = 5 * 60 * 1000 // 5 minutes

  async getSchema(client: StellarAttestationClient, uid: Buffer) {
    const uidStr = uid.toString('hex')
    
    // Check cache first
    if (this.cache.has(uidStr) && this.cacheExpiry.get(uidStr)! > Date.now()) {
      return this.cache.get(uidStr)
    }

    // Fetch from network
    const schema = await client.getSchema(uid)
    
    if (schema) {
      this.cache.set(uidStr, schema)
      this.cacheExpiry.set(uidStr, Date.now() + this.ttl)
    }
    
    return schema
  }

  clearExpired() {
    const now = Date.now()
    for (const [uid, expiry] of this.cacheExpiry.entries()) {
      if (expiry <= now) {
        this.cache.delete(uid)
        this.cacheExpiry.delete(uid)
      }
    }
  }
}
```

## Testing

### Setting Up Tests

```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ]
}
```

### Integration Tests

```typescript
import { StellarAttestationClient } from '@attestprotocol/stellar-sdk'
import { Keypair } from '@stellar/stellar-sdk'

describe('Integration Tests', () => {
  let client: StellarAttestationClient
  let schemaUid: Buffer
  let signer: Keypair

  beforeAll(async () => {
    signer = Keypair.random()
    
    client = new StellarAttestationClient({
      rpcUrl: 'https://soroban-testnet.stellar.org',
      network: 'testnet',
      publicKey: signer.publicKey()
    })

    // Create test schema
    const result = await client.createSchema({
      definition: 'name:string,verified:bool',
      revocable: true,
      options: { signer }
    })
    
    schemaUid = result // Assuming result is the schema UID
  })

  it('should complete full attestation lifecycle', async () => {
    const subject = Keypair.random().publicKey()
    
    // 1. Create attestation
    const attestationData = {
      schemaUid,
      value: JSON.stringify({ name: 'Test User', verified: true }),
      subject,
      options: { signer }
    }

    const attestationUid = await client.attest(attestationData)
    expect(attestationUid).toBeTruthy()

    // 2. Retrieve attestation
    const attestation = await client.getAttestation(attestationUid)
    expect(attestation).toBeDefined()
    expect(attestation.subject).toBe(subject)

    // 3. Revoke attestation
    await client.revoke({
      attestationUid,
      options: { signer }
    })
  })
})
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Contract Not Found Error

```
Error: Contract CBQHNBFQ... not found
```

**Solution:**
```typescript
// Verify contract deployment
const client = new StellarAttestationClient({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  network: 'testnet',
  publicKey: 'YOUR_PUBLIC_KEY',
  contractId: 'YOUR_PROTOCOL_CONTRACT_ID' // Make sure this is correct
})
```

#### 2. Insufficient Funds for Transaction

```
Error: Insufficient funds for transaction fees
```

**Solution:**
```typescript
// Fund your testnet account
// Visit: https://laboratory.stellar.org/#account-creator?network=test
// Or use friendbot
const fundingUrl = `https://friendbot.stellar.org?addr=${publicKey}`
const response = await fetch(fundingUrl)
```

#### 3. Schema Validation Errors

```
SchemaValidationError: Field 'email' must be a string
```

**Solution:**
```typescript
// Debug schema validation
const encoder = new SorobanSchemaEncoder({
  name: 'Test Schema',
  fields: [
    { name: 'email', type: StellarDataType.STRING }
  ]
})

try {
  encoder.validateData({ email: 123 }) // This will fail
} catch (error) {
  console.error('Validation error:', error.message)
  // Provide correct data type
  encoder.validateData({ email: 'user@example.com' }) // This will pass
}
```

## Contributing

We welcome contributions to the Stellar Attestation Service SDK! Please see our [Contributing Guide](../../CONTRIBUTING.md) for detailed information.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/attestprotocol/attest.so.git

# Install dependencies
cd attest.so
pnpm install

# Build the SDK
cd packages/stellar-sdk
pnpm build

# Run tests
pnpm test
```

## Resources

### Documentation
- 📖 [Full Documentation](https://attest.so/docs)
- 🔧 [API Reference](https://attest.so/api/stellar-sdk)
- 📋 [Contract Documentation](../../contracts/stellar/README.md)
- 💡 [Example Applications](../../examples/)

### Community
- 💬 [Discord Community](https://discord.gg/attestprotocol)
- 🐛 [GitHub Issues](https://github.com/attestprotocol/attest.so/issues)
- 📧 [Email Support](mailto:support@attest.so)

### Related Projects
- 🌟 [Stellar Development Foundation](https://stellar.org/)
- ⚡ [Soroban Documentation](https://soroban.stellar.org/)
- 🔗 [Ethereum Attestation Service](https://attest.sh/)

## License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## Support

If you encounter any issues or need assistance:

1. 📖 Check this documentation and the [FAQ](https://attest.so/docs/faq)
2. 🔍 Search [existing issues](https://github.com/attestprotocol/attest.so/issues)
3. 💬 Ask in our [Discord community](https://discord.gg/attestprotocol)
4. 🐛 [Create a new issue](https://github.com/attestprotocol/attest.so/issues/new) if needed

For enterprise support and custom implementations, contact us at [enterprise@attest.so](mailto:enterprise@attest.so).

---

**Ready to start building?** Check out our [Quick Start](#quick-start) guide above, or explore our [example applications](../../examples/) for real-world implementations.