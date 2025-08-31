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
- [Core Concepts](#core-concepts)
- [Schema System](#schema-system)
- [API Reference](#api-reference)
- [Common Use Cases](#common-use-cases)
- [Advanced Features](#advanced-features)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Migration Guide](#migration-guide)
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

// Initialize the SDK
const sdk = new StellarAttestProtocol({
  secretKeyOrCustomSigner: 'YOUR_SECRET_KEY',
  publicKey: 'YOUR_PUBLIC_KEY',
  url: 'https://soroban-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET,
  // Optional: specify contract addresses if different from defaults
  contractAddresses: {
    protocol: 'YOUR_PROTOCOL_CONTRACT_ID',
    authority: 'YOUR_AUTHORITY_CONTRACT_ID'
  }
})

// Initialize the protocol
await sdk.initialize()
```

### Environment Configuration

You can also configure the SDK using environment variables:

```bash
STELLAR_SECRET_KEY=SXXXXX...
STELLAR_PUBLIC_KEY=GXXXXX...
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
PROTOCOL_CONTRACT_ID=CBQHNBFQHAHAHA...
AUTHORITY_CONTRACT_ID=CBQHNBFQHAHAHA...
```

### Creating Your First Schema

```typescript
import { StellarSchemaEncoder, StellarDataType } from '@attestprotocol/stellar-sdk/internal'

// Create a custom schema
const identitySchema = new StellarSchemaEncoder({
  name: 'Identity Verification',
  version: '1.0.0',
  description: 'Standard identity verification attestation',
  fields: [
    {
      name: 'fullName',
      type: StellarDataType.STRING,
      description: 'Legal full name of the individual'
    },
    {
      name: 'documentType',
      type: StellarDataType.STRING,
      validation: { enum: ['passport', 'drivers_license', 'national_id'] }
    },
    {
      name: 'verificationDate',
      type: StellarDataType.TIMESTAMP,
      description: 'When the verification was completed'
    },
    {
      name: 'verifiedBy',
      type: StellarDataType.ADDRESS,
      description: 'Address of the verifying authority'
    }
  ],
  metadata: {
    category: 'identity',
    revocable: true,
    expirable: false
  }
})

// Register the schema
const { data: schema, error } = await sdk.createSchema({
  name: 'identity-verification-v1',
  content: JSON.stringify(identitySchema.toJSONSchema()),
  revocable: true,
  resolver: null
})

if (error) {
  console.error('Schema registration failed:', error)
} else {
  console.log('Schema registered with UID:', schema.uid)
}
```

### Creating an Attestation

```typescript
// Using the registered schema
const attestationData = {
  schemaUid: schema.uid,
  subject: 'GBULAMIEKTTBKNV44XSC3SQZ7P2YU5BTBZI3WG3ZDYBPIH7N74D3SXAA',
  data: JSON.stringify({
    fullName: 'John Alexander Smith',
    documentType: 'passport',
    verificationDate: Date.now(),
    verifiedBy: sdk.publicKey
  }),
  reference: 'identity-verification-001',
  expirationTime: null, // Never expires
  revocable: true
}

// Create the attestation
const { data: attestation, error: attestError } = await sdk.issueAttestation(attestationData)

if (attestError) {
  console.error('Attestation creation failed:', attestError)
} else {
  console.log('Attestation created:', attestation)
}
```

## Core Concepts

### Schemas

Schemas define the structure, validation rules, and metadata for attestation data. They ensure data consistency and enable type-safe operations.

**Schema Components:**
- **Fields**: Define data structure with types and validation
- **Metadata**: Category, versioning, and lifecycle information  
- **Validation**: Type checking, enums, ranges, and custom rules

### Attestations

Attestations are signed statements about a subject, conforming to a specific schema. They include:
- **Subject**: The entity the attestation is about
- **Data**: Structured information following the schema
- **Authority**: Who issued the attestation
- **Lifecycle**: Creation, expiration, and revocation status

### Authorities

Authorities are entities authorized to issue attestations for specific schemas. The system supports:
- **Registration**: Become a recognized authority
- **Permissions**: Schema-specific authorization
- **Delegation**: Authority can grant permissions to others

## Schema System

### Pre-Built Schema Registry

Access ready-to-use schemas for common use cases:

```typescript
import { 
  StellarSchemaRegistry, 
  createStandardizedSchemaEncoder,
  createStandardizedTestData
} from '@attestprotocol/stellar-sdk/internal'

// List all available schemas
console.log('Available schemas:', StellarSchemaRegistry.list())
// Output: ['identity-verification', 'academic-credential', 'professional-certification']

// Get a pre-built schema encoder
const identityEncoder = createStandardizedSchemaEncoder('identity')

// Create standardized test data
const testData = createStandardizedTestData('identity')

// Validate and encode data
const encoded = await identityEncoder.encodeData(testData)
console.log('Encoded data:', encoded.encodedData)
console.log('Schema hash:', encoded.schemaHash)
```

### Custom Schema Creation

```typescript
// Create a sophisticated KYC schema
const kycSchema = new StellarSchemaEncoder({
  name: 'Enhanced KYC Verification',
  version: '2.0.0',
  description: 'Comprehensive KYC verification with risk assessment',
  fields: [
    {
      name: 'subjectAddress',
      type: StellarDataType.ADDRESS,
      description: 'Stellar address of the subject'
    },
    {
      name: 'verificationTier',
      type: StellarDataType.STRING,
      validation: { enum: ['basic', 'enhanced', 'premium'] },
      description: 'Level of verification completed'
    },
    {
      name: 'riskScore',
      type: StellarDataType.U32,
      validation: { min: 0, max: 1000 },
      description: 'Calculated risk score (0-1000)'
    },
    {
      name: 'documentsVerified',
      type: 'array<string>',
      description: 'List of verified document types'
    },
    {
      name: 'verificationDate',
      type: StellarDataType.TIMESTAMP,
      description: 'Completion timestamp'
    },
    {
      name: 'expiryDate',
      type: StellarDataType.TIMESTAMP,
      optional: true,
      description: 'When this verification expires'
    },
    {
      name: 'notes',
      type: StellarDataType.STRING,
      optional: true,
      description: 'Additional verification notes'
    }
  ],
  metadata: {
    category: 'compliance',
    revocable: true,
    expirable: true,
    authority: sdk.publicKey
  }
})

// Validate schema design
try {
  kycSchema.validateData({
    subjectAddress: 'GBULAMIEKTTBKNV44XSC3SQZ7P2YU5BTBZI3WG3ZDYBPIH7N74D3SXAA',
    verificationTier: 'enhanced',
    riskScore: 150,
    documentsVerified: ['passport', 'utility_bill'],
    verificationDate: Date.now()
  })
  console.log('✅ Schema validation passed')
} catch (error) {
  console.error('❌ Schema validation failed:', error.message)
}
```

### Schema Conversion and Interoperability

```typescript
// Convert from JSON Schema to Stellar Schema
const legacyJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Legacy Verification',
  type: 'object',
  properties: {
    userId: { type: 'string' },
    status: { type: 'boolean' },
    timestamp: { type: 'integer' }
  },
  required: ['userId', 'status']
}

const convertedEncoder = convertLegacySchema(legacyJsonSchema)

// Generate default values
const defaults = convertedEncoder.generateDefaults()
console.log('Default values:', defaults)

// Convert to standardized format
const jsonSchema = convertedEncoder.toJSONSchema()
console.log('Converted to JSON Schema:', jsonSchema)
```

## API Reference

### StellarAttestProtocol Class

#### Constructor
```typescript
constructor(config: StellarConfig)
```

**StellarConfig:**
```typescript
interface StellarConfig {
  secretKeyOrCustomSigner: string | StellarCustomSigner
  publicKey: string
  url?: string
  networkPassphrase?: string
  contractAddresses?: {
    protocol?: string
    authority?: string
  }
  allowHttp?: boolean
}
```

#### Core Methods

##### `initialize(): Promise<AttestProtocolResponse<void>>`
Initialize the protocol by setting the admin.

```typescript
const result = await sdk.initialize()
if (result.error) {
  console.error('Initialization failed:', result.error)
}
```

##### Schema Operations

###### `createSchema(schema: SchemaDefinition): Promise<AttestProtocolResponse<Schema>>`
Register a new schema on-chain.

```typescript
const { data, error } = await sdk.createSchema({
  name: 'my-schema',
  content: JSON.stringify(schemaDefinition),
  revocable: true,
  resolver: null
})
```

###### `fetchSchemaById(uid: string): Promise<AttestProtocolResponse<Schema | null>>`
Retrieve a schema by its UID.

###### `listSchemasByIssuer(params: ListSchemasByIssuerParams): Promise<AttestProtocolResponse<PaginatedResponse<Schema>>>`
List schemas created by a specific issuer.

##### Attestation Operations

###### `issueAttestation(attestation: AttestationDefinition): Promise<AttestProtocolResponse<Attestation>>`
Create a new attestation.

```typescript
const { data: attestation, error } = await sdk.issueAttestation({
  schemaUid: 'schema-uid-here',
  subject: 'GSUBJECT...ADDRESS',
  data: JSON.stringify(attestationData),
  reference: 'unique-reference',
  expirationTime: Date.now() + 86400000, // 24 hours
  revocable: true
})
```

###### `fetchAttestationById(uid: string): Promise<AttestProtocolResponse<Attestation | null>>`
Retrieve an attestation by UID.

###### `listAttestationsByWallet(params: ListAttestationsByWalletParams): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>>`
Find attestations by subject/wallet address.

###### `listAttestationsBySchema(params: ListAttestationsBySchemaParams): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>>`
Find attestations by schema UID.

###### `revokeAttestation(definition: RevocationDefinition): Promise<AttestProtocolResponse<void>>`
Revoke an existing attestation.

```typescript
const { error } = await sdk.revokeAttestation({
  attestationUid: 'attestation-uid',
  reason: 'Information no longer valid'
})
```

##### Authority Operations

###### `registerAuthority(): Promise<AttestProtocolResponse<string>>`
Register as an attestation authority.

```typescript
const { data: authorityId, error } = await sdk.registerAuthority()
```

###### `fetchAuthority(id: string): Promise<AttestProtocolResponse<Authority | null>>`
Retrieve authority details by ID.

###### `isIssuerAnAuthority(issuer: string): Promise<AttestProtocolResponse<boolean>>`
Check if an address is registered as an authority.

### Schema Encoder Classes

#### StellarSchemaEncoder

##### `constructor(schema: StellarSchemaDefinition)`
Create a new schema encoder.

##### `encodeData(data: Record<string, any>): Promise<EncodedAttestationData>`
Encode and validate data according to the schema.

##### `decodeData(encodedData: string): Record<string, any>`
Decode data from blockchain format.

##### `validateData(data: Record<string, any>): void`
Validate data against schema (throws on failure).

##### `getSchema(): StellarSchemaDefinition`
Get the schema definition.

##### `getSchemaHash(): string`
Generate a unique hash for the schema.

##### `toJSONSchema(): object`
Convert to standard JSON Schema format.

##### `generateDefaults(): Record<string, any>`
Generate default values for all required fields.

#### StellarSchemaRegistry

##### `static get(name: string): StellarSchemaEncoder | undefined`
Retrieve a pre-registered schema encoder.

##### `static list(): string[]`
List all available schema names.

##### `static register(name: string, encoder: StellarSchemaEncoder): void`
Register a custom schema encoder.

### Internal Utilities

The internal module provides utility functions for testing and development:

```typescript
import { 
  createTestKeypairs, 
  createStandardizedTestData,
  createTestSchema,
  createTestAttestation,
  generateSchemaUid,
  formatSchemaUid,
  validateAttestationData,
  convertLegacySchema,
  generateFundingUrls
} from '@attestprotocol/stellar-sdk/internal'

// Generate test keypairs
const keypairs = createTestKeypairs()

// Create realistic test data
const testData = createStandardizedTestData('identity')

// Generate schema UIDs
const uid = await generateSchemaUid(schemaContent, authority)

// Format UIDs for display
const formatted = formatSchemaUid(uid)

// Validate attestation data
const validation = validateAttestationData('identity', testData)
```

## Common Use Cases

### 1. Identity Verification Service

```typescript
// Complete identity verification flow
class IdentityVerificationService {
  constructor(private sdk: StellarAttestProtocol) {}

  async verifyIdentity(userData: {
    fullName: string
    documentType: 'passport' | 'drivers_license' | 'national_id'
    documentNumber: string
    userAddress: string
  }) {
    // 1. Create schema if not exists
    const identitySchema = createStandardizedSchemaEncoder('identity')
    
    // 2. Validate user data
    const verificationData = {
      fullName: userData.fullName,
      documentType: userData.documentType,
      documentNumber: this.hashDocument(userData.documentNumber),
      verificationLevel: 'enhanced',
      verificationDate: Date.now(),
      verifiedBy: this.sdk.publicKey
    }

    try {
      identitySchema.validateData(verificationData)
    } catch (error) {
      throw new Error(`Invalid verification data: ${error.message}`)
    }

    // 3. Create attestation
    const { data: attestationUid, error } = await this.sdk.attest.create({
      schemaUid: await this.getIdentitySchemaUid(),
      subject: userData.userAddress,
      data: JSON.stringify(verificationData),
      reference: `identity-${Date.now()}`,
      expirationTime: Date.now() + (2 * 365 * 24 * 60 * 60 * 1000), // 2 years
      revocable: true
    })

    if (error) {
      throw new Error(`Attestation creation failed: ${error}`)
    }

    return {
      attestationUid,
      verificationLevel: 'enhanced',
      validUntil: new Date(Date.now() + (2 * 365 * 24 * 60 * 60 * 1000))
    }
  }

  private hashDocument(documentNumber: string): string {
    // In production, use proper hashing
    return `sha256:${documentNumber.slice(0, 3)}...${documentNumber.slice(-3)}`
  }

  private async getIdentitySchemaUid(): Promise<string> {
    // Implementation to get or create identity schema
    return 'your-identity-schema-uid'
  }
}
```

### 2. Academic Credential Issuer

```typescript
// University degree attestation system
class UniversityCredentialIssuer {
  constructor(private sdk: StellarAttestProtocol) {}

  async issueDegree(graduateData: {
    studentName: string
    studentAddress: string
    degree: string
    fieldOfStudy: string
    graduationDate: string
    gpa?: number
    honors?: string
  }) {
    const degreeSchema = createStandardizedSchemaEncoder('degree')
    
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
    const { data: attestationUid, error } = await this.sdk.attest.create({
      schemaUid: await this.getDegreeSchemaUid(),
      subject: graduateData.studentAddress,
      data: JSON.stringify(credentialData),
      reference: `degree-${graduateData.studentName.replace(/\s+/g, '-')}-${Date.now()}`,
      expirationTime: null, // Degrees don't expire
      revocable: false // Academic credentials should be immutable
    })

    if (error) {
      throw new Error(`Degree attestation failed: ${error}`)
    }

    return {
      attestationUid,
      credentialType: 'degree',
      institution: 'Stanford University',
      verifiable: true
    }
  }

  private async getDegreeSchemaUid(): Promise<string> {
    return 'your-degree-schema-uid'
  }
}
```

### 3. Professional Certification Authority

```typescript
// Professional certification management
class CertificationAuthority {
  constructor(private sdk: StellarAttestProtocol) {}

  async issueCertification(certData: {
    holderName: string
    holderAddress: string
    certificationName: string
    level: 'entry' | 'associate' | 'professional' | 'expert' | 'master'
    validityPeriod: number // months
    skillsValidated: string[]
  }) {
    const certSchema = createStandardizedSchemaEncoder('certification')
    
    const issueDate = Date.now()
    const expirationDate = issueDate + (certData.validityPeriod * 30 * 24 * 60 * 60 * 1000)

    const certificationData = {
      holderName: certData.holderName,
      certificationName: certData.certificationName,
      issuingOrganization: 'Professional Certification Board',
      certificationNumber: this.generateCertNumber(),
      issueDate,
      expirationDate,
      skillsValidated: certData.skillsValidated,
      certificationLevel: certData.level
    }

    const { data: attestationUid, error } = await this.sdk.attest.create({
      schemaUid: await this.getCertSchemaUid(),
      subject: certData.holderAddress,
      data: JSON.stringify(certificationData),
      reference: `cert-${this.generateCertNumber()}`,
      expirationTime: expirationDate,
      revocable: true // Certifications can be revoked for violations
    })

    if (error) {
      throw new Error(`Certification issuance failed: ${error}`)
    }

    // Schedule renewal reminder
    this.scheduleRenewalReminder(certData.holderAddress, expirationDate)

    return {
      attestationUid,
      certificationNumber: certificationData.certificationNumber,
      validUntil: new Date(expirationDate),
      renewalRequired: true
    }
  }

  private generateCertNumber(): string {
    return `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  }

  private async getCertSchemaUid(): Promise<string> {
    return 'your-certification-schema-uid'
  }

  private scheduleRenewalReminder(address: string, expirationDate: number) {
    // Implementation for renewal notifications
    console.log(`Renewal reminder scheduled for ${address} at ${new Date(expirationDate)}`)
  }
}
```

### 4. Financial Compliance (KYC/AML)

```typescript
// KYC/AML compliance attestation system
class ComplianceService {
  constructor(private sdk: StellarAttestProtocol) {}

  async performKYC(customerData: {
    customerAddress: string
    fullName: string
    dateOfBirth: string
    nationality: string
    documentType: string
    documentNumber: string
  }) {
    // 1. Perform background checks
    const riskAssessment = await this.performRiskAssessment(customerData)
    
    // 2. Create compliance attestation
    const kycData = {
      subjectAddress: customerData.customerAddress,
      verificationTier: riskAssessment.tier,
      riskScore: riskAssessment.score,
      documentsVerified: ['identity', 'address'],
      verificationDate: Date.now(),
      complianceStatus: riskAssessment.approved ? 'approved' : 'rejected',
      reviewedBy: this.sdk.publicKey
    }

    const { data: attestationUid, error } = await this.sdk.attest.create({
      schemaUid: await this.getKYCSchemaUid(),
      subject: customerData.customerAddress,
      data: JSON.stringify(kycData),
      reference: `kyc-${customerData.customerAddress}-${Date.now()}`,
      expirationTime: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
      revocable: true
    })

    if (error) {
      throw new Error(`KYC attestation failed: ${error}`)
    }

    return {
      attestationUid,
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

  private async getKYCSchemaUid(): Promise<string> {
    return 'your-kyc-schema-uid'
  }
}
```

## Advanced Features

### Batch Operations

```typescript
// Efficient batch attestation creation
async function createBatchAttestations() {
  const attestations = [
    {
      schemaUid: 'identity-schema-uid',
      subject: 'GUSER1...ADDRESS',
      data: JSON.stringify({ name: 'User 1', verified: true }),
      reference: 'batch-1-user1',
      expirationTime: null,
      revocable: true
    },
    {
      schemaUid: 'identity-schema-uid', 
      subject: 'GUSER2...ADDRESS',
      data: JSON.stringify({ name: 'User 2', verified: true }),
      reference: 'batch-1-user2',
      expirationTime: null,
      revocable: true
    }
  ]

  const { data: attestationUids, error } = await sdk.attest.createBatch(attestations)
  
  if (error) {
    console.error('Batch creation failed:', error)
  } else {
    console.log(`Created ${attestationUids.length} attestations:`, attestationUids)
  }
}
```

### Advanced Querying

```typescript
// Complex attestation queries
class AttestationQueryService {
  constructor(private sdk: StellarAttestProtocol) {}

  async findVerifiedUsers(verificationLevel: string = 'enhanced') {
    // Get all identity attestations
    const { data: attestations, error } = await this.sdk.attest.getBySchema(
      'identity-schema-uid',
      { limit: 100, offset: 0 }
    )

    if (error) return []

    // Filter by verification level
    return attestations.items.filter(attestation => {
      try {
        const data = JSON.parse(attestation.data)
        return data.verificationLevel === verificationLevel
      } catch {
        return false
      }
    })
  }

  async getUserAttestationSummary(userAddress: string) {
    const { data: attestations, error } = await this.sdk.attest.getBySubject(userAddress)
    
    if (error) return null

    const summary = {
      total: attestations.items.length,
      byCategory: {} as Record<string, number>,
      bySchema: {} as Record<string, number>,
      active: 0,
      expired: 0,
      revoked: 0
    }

    for (const attestation of attestations.items) {
      // Get schema details to categorize
      const { data: schema } = await this.sdk.schema.get(attestation.schemaUid)
      
      if (schema) {
        summary.bySchema[schema.name] = (summary.bySchema[schema.name] || 0) + 1
      }

      // Check status
      if (attestation.revoked) {
        summary.revoked++
      } else if (attestation.expirationTime && attestation.expirationTime < Date.now()) {
        summary.expired++
      } else {
        summary.active++
      }
    }

    return summary
  }
}
```

### Custom Validation and Hooks

```typescript
// Advanced schema with custom validation
const advancedSchema = new StellarSchemaEncoder({
  name: 'Advanced Verification',
  version: '1.0.0',
  description: 'Schema with custom validation logic',
  fields: [
    {
      name: 'score',
      type: StellarDataType.U32,
      validation: {
        min: 0,
        max: 1000,
        custom: (value: number) => {
          if (value % 5 !== 0) {
            throw new Error('Score must be divisible by 5')
          }
          return true
        }
      }
    },
    {
      name: 'email',
      type: StellarDataType.STRING,
      validation: {
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
      }
    },
    {
      name: 'age',
      type: StellarDataType.U32,
      validation: {
        min: 18,
        max: 120,
        custom: (age: number) => {
          if (age < 21 && Math.random() > 0.5) {
            throw new Error('Additional verification required for under 21')
          }
          return true
        }
      }
    }
  ]
})

// Validation with error handling
try {
  advancedSchema.validateData({
    score: 85, // Will fail - not divisible by 5
    email: 'user@example.com',
    age: 25
  })
} catch (error) {
  console.error('Validation failed:', error.message)
}
```

### Attestation Lifecycle Management

```typescript
// Complete attestation lifecycle management
class AttestationLifecycleManager {
  constructor(private sdk: StellarAttestProtocol) {}

  async createTimeBoundAttestation(data: {
    schemaUid: string
    subject: string
    attestationData: any
    validityDays: number
  }) {
    const expirationTime = Date.now() + (data.validityDays * 24 * 60 * 60 * 1000)
    
    const { data: attestationUid, error } = await this.sdk.attest.create({
      schemaUid: data.schemaUid,
      subject: data.subject,
      data: JSON.stringify(data.attestationData),
      reference: `time-bound-${Date.now()}`,
      expirationTime,
      revocable: true
    })

    if (error) {
      throw new Error(`Attestation creation failed: ${error}`)
    }

    // Schedule expiration notification
    this.scheduleExpirationNotification(attestationUid, expirationTime)
    
    return attestationUid
  }

  async renewAttestation(originalUid: string, newValidityDays: number) {
    // Get original attestation
    const { data: original, error } = await this.sdk.attest.get(originalUid)
    
    if (error || !original) {
      throw new Error('Original attestation not found')
    }

    // Create new attestation with extended validity
    const newExpirationTime = Date.now() + (newValidityDays * 24 * 60 * 60 * 1000)
    
    const { data: newUid, error: createError } = await this.sdk.attest.create({
      schemaUid: original.schemaUid,
      subject: original.subject,
      data: original.data,
      reference: `renewal-of-${originalUid}`,
      expirationTime: newExpirationTime,
      revocable: true
    })

    if (createError) {
      throw new Error(`Renewal failed: ${createError}`)
    }

    // Revoke original attestation
    await this.sdk.attest.revoke({
      attestationUid: originalUid,
      reason: `Renewed with attestation ${newUid}`
    })

    return newUid
  }

  private scheduleExpirationNotification(uid: string, expirationTime: number) {
    // In production, use a proper job scheduler
    console.log(`Scheduled expiration notification for ${uid} at ${new Date(expirationTime)}`)
  }
}
```

## Error Handling

### Comprehensive Error Handling

```typescript
import { AttestProtocolErrorType } from '@attestprotocol/stellar-sdk'

async function robustAttestationCreation(attestationData: any) {
  try {
    const { data, error } = await sdk.attest.create(attestationData)
    
    if (error) {
      // Handle SDK-level errors
      switch (error.type) {
        case AttestProtocolErrorType.VALIDATION_ERROR:
          console.error('Data validation failed:', error.message)
          // Show user-friendly validation errors
          break
          
        case AttestProtocolErrorType.NETWORK_ERROR:
          console.error('Network connection failed:', error.message)
          // Retry logic or show connectivity issues
          break
          
        case AttestProtocolErrorType.UNAUTHORIZED:
          console.error('Not authorized:', error.message)
          // Redirect to authorization flow
          break
          
        case AttestProtocolErrorType.INSUFFICIENT_FUNDS:
          console.error('Insufficient funds for transaction:', error.message)
          // Show funding instructions
          break
          
        default:
          console.error('Unknown error:', error.message)
      }
      return null
    }
    
    return data
    
  } catch (contractError) {
    // Handle contract-specific errors
    if (contractError.message.includes('schema not found')) {
      console.error('Schema does not exist - please register it first')
    } else if (contractError.message.includes('unauthorized authority')) {
      console.error('You are not authorized to issue attestations for this schema')
    } else if (contractError.message.includes('invalid subject')) {
      console.error('Subject address is invalid')
    } else {
      console.error('Contract error:', contractError.message)
    }
    return null
  }
}

// Error recovery patterns
async function createAttestationWithRetry(
  attestationData: any, 
  maxRetries: number = 3
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await robustAttestationCreation(attestationData)
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

### Schema Validation Error Handling

```typescript
function handleSchemaValidationErrors(error: any) {
  if (error.name === 'SchemaValidationError') {
    const field = error.field
    const message = error.message
    
    // Provide specific guidance based on field
    switch (field) {
      case 'email':
        return 'Please provide a valid email address'
      case 'age':
        return 'Age must be between 18 and 120'
      case 'score':
        return 'Score must be between 0 and 1000'
      default:
        return `Field '${field}': ${message}`
    }
  }
  
  return 'Validation failed: ' + error.message
}

// Usage in forms
async function validateFormData(formData: any) {
  const schema = createStandardizedSchemaEncoder('identity')
  
  try {
    schema.validateData(formData)
    return { valid: true, errors: [] }
  } catch (error) {
    return {
      valid: false,
      errors: [handleSchemaValidationErrors(error)]
    }
  }
}
```

## Best Practices

### 1. Schema Design Best Practices

```typescript
// ✅ Good schema design
const goodSchema = new StellarSchemaEncoder({
  name: 'Professional License',
  version: '1.0.0',
  description: 'Professional license verification with clear validation rules',
  fields: [
    {
      name: 'licenseNumber',
      type: StellarDataType.STRING,
      description: 'Unique license identifier',
      validation: { pattern: '^[A-Z]{2}[0-9]{6}$' } // Clear format requirement
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
    revocable: true, // Licenses can be revoked
    expirable: true  // Licenses can expire
  }
})

// ❌ Poor schema design
const badSchema = new StellarSchemaEncoder({
  name: 'Bad Schema', // Non-descriptive name
  version: '1.0.0',
  description: 'Some data', // Vague description
  fields: [
    {
      name: 'data', // Generic field name
      type: StellarDataType.STRING
      // No validation or description
    },
    {
      name: 'number',
      type: StellarDataType.U32
      // No validation limits
    }
  ]
  // No metadata
})
```

### 2. Data Privacy and Security

```typescript
// Privacy-preserving attestation patterns
class PrivacyPreservingAttestations {
  
  // Hash sensitive data before storing
  static hashSensitiveData(data: string): string {
    // Use proper cryptographic hashing in production
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

// Selective disclosure pattern
const privacySchema = new StellarSchemaEncoder({
  name: 'Privacy-Preserving Identity',
  version: '1.0.0',
  description: 'Identity verification with minimal data disclosure',
  fields: [
    {
      name: 'ageVerified',
      type: StellarDataType.BOOL,
      description: 'Whether the person is verified to be over 18'
    },
    {
      name: 'countryVerified',
      type: StellarDataType.STRING,
      description: 'Country of citizenship (ISO code only)'
    },
    {
      name: 'documentTypeVerified',
      type: StellarDataType.STRING,
      validation: { enum: ['government_id', 'passport', 'other'] },
      description: 'Type of document verified (category only)'
    },
    {
      name: 'verificationLevel',
      type: StellarDataType.STRING,
      validation: { enum: ['basic', 'enhanced'] },
      description: 'Level of verification performed'
    }
  ]
})
```

### 3. Performance Optimization

```typescript
// Efficient batch processing
class OptimizedAttestationService {
  private batchSize = 10
  private processingQueue: any[] = []

  async queueAttestation(attestationData: any) {
    this.processingQueue.push(attestationData)
    
    if (this.processingQueue.length >= this.batchSize) {
      await this.processBatch()
    }
  }

  private async processBatch() {
    if (this.processingQueue.length === 0) return

    const batch = this.processingQueue.splice(0, this.batchSize)
    
    try {
      const { data: uids, error } = await sdk.attest.createBatch(batch)
      
      if (error) {
        console.error('Batch processing failed:', error)
        // Re-queue failed items
        this.processingQueue.unshift(...batch)
      } else {
        console.log(`Successfully processed batch of ${uids.length} attestations`)
      }
    } catch (error) {
      console.error('Batch processing error:', error)
      // Re-queue failed items
      this.processingQueue.unshift(...batch)
    }
  }

  // Process any remaining items
  async flush() {
    while (this.processingQueue.length > 0) {
      await this.processBatch()
    }
  }
}

// Caching for frequently accessed schemas
class SchemaCache {
  private cache = new Map<string, any>()
  private cacheExpiry = new Map<string, number>()
  private ttl = 5 * 60 * 1000 // 5 minutes

  async getSchema(uid: string) {
    // Check cache first
    if (this.cache.has(uid) && this.cacheExpiry.get(uid)! > Date.now()) {
      return this.cache.get(uid)
    }

    // Fetch from network
    const { data: schema, error } = await sdk.schema.get(uid)
    
    if (!error && schema) {
      this.cache.set(uid, schema)
      this.cacheExpiry.set(uid, Date.now() + this.ttl)
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

### 4. Testing Strategies

```typescript
// Comprehensive testing patterns
import { _internal } from '@attestprotocol/stellar-sdk'

describe('Attestation Service Tests', () => {
  let sdk: StellarAttestProtocol
  let testKeypairs: any

  beforeEach(async () => {
    // Use test utilities
    testKeypairs = createTestKeypairs()
    
    sdk = new StellarAttestProtocol({
      network: Networks.TESTNET,
      secretKeyOrCustomSigner: testKeypairs.authority.secret(),
      publicKey: testKeypairs.authority.publicKey()
    })
    
    await sdk.initialize()
  })

  describe('Schema Operations', () => {
    it('should create and register a schema', async () => {
      const testSchema = createTestSchema('identity')
      
      const { data: schema, error } = await sdk.schema.register(testSchema)
      
      expect(error).toBeNull()
      expect(schema).toBeDefined()
      expect(schema.uid).toBeTruthy()
    })

    it('should validate schema data correctly', () => {
      const identityEncoder = createStandardizedSchemaEncoder('identity')
      const testData = createStandardizedTestData('identity')
      
      expect(() => {
        identityEncoder.validateData(testData)
      }).not.toThrow()
    })
  })

  describe('Attestation Operations', () => {
    it('should create attestation with valid data', async () => {
      const schemaUid = 'test-schema-uid'
      const attestationData = createTestAttestation(
        schemaUid,
        'identity',
        testKeypairs.recipientPublic
      )

      const { data: attestationUid, error } = await sdk.attest.create(attestationData)
      
      expect(error).toBeNull()
      expect(attestationUid).toBeTruthy()
    })

    it('should handle batch attestation creation', async () => {
      const attestations = Array.from({ length: 5 }, (_, i) => 
        createTestAttestation(
          'test-schema-uid',
          'identity',
          `GUSER${i}...ADDRESS`
        )
      )

      const { data: uids, error } = await sdk.attest.createBatch(attestations)
      
      expect(error).toBeNull()
      expect(uids).toHaveLength(5)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid schema gracefully', async () => {
      const { data, error } = await sdk.schema.get('non-existent-uid')
      
      expect(data).toBeNull()
      expect(error).toBeDefined()
      expect(error.type).toBe(AttestProtocolErrorType.NOT_FOUND)
    })

    it('should validate attestation data', () => {
      const encoder = createStandardizedSchemaEncoder('identity')
      
      expect(() => {
        encoder.validateData({
          invalidField: 'invalid'
        })
      }).toThrow('Unknown field')
    })
  })
})
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
    '!src/**/*.d.ts',
    '!src/internal/**'
  ],
  coverageReporters: ['text', 'lcov', 'html']
}

// test/setup.ts
import { Networks } from '@stellar/stellar-sdk'

global.testConfig = {
  network: Networks.TESTNET,
  rpcUrl: 'https://soroban-testnet.stellar.org'
}
```

### Integration Tests

```typescript
// test/integration/attestation.test.ts
import StellarAttestProtocol, { _internal } from '@attestprotocol/stellar-sdk'

describe('Integration Tests', () => {
  let sdk: StellarAttestProtocol
  let schemaUid: string

  beforeAll(async () => {
    const keypairs = createTestKeypairs()
    
    sdk = new StellarAttestProtocol({
      network: global.testConfig.network,
      rpcUrl: global.testConfig.rpcUrl,
      secretKeyOrCustomSigner: keypairs.authority.secret(),
      publicKey: keypairs.authority.publicKey()
    })

    await sdk.initialize()

    // Create test schema
    const testSchema = createTestSchema('identity')
    const { data: schema } = await sdk.schema.register(testSchema)
    schemaUid = schema.uid
  })

  it('should complete full attestation lifecycle', async () => {
    const keypairs = createTestKeypairs()
    
    // 1. Create attestation
    const attestationData = createTestAttestation(
      schemaUid,
      'identity',
      keypairs.recipientPublic
    )

    const { data: attestationUid } = await sdk.attest.create(attestationData)
    expect(attestationUid).toBeTruthy()

    // 2. Retrieve attestation
    const { data: attestation } = await sdk.attest.get(attestationUid)
    expect(attestation).toBeDefined()
    expect(attestation.subject).toBe(keypairs.recipientPublic)

    // 3. Query by subject
    const { data: subjectAttestations } = await sdk.attest.getBySubject(
      keypairs.recipientPublic
    )
    expect(subjectAttestations.items.length).toBeGreaterThan(0)

    // 4. Revoke attestation
    const { error: revokeError } = await sdk.attest.revoke({
      attestationUid,
      reason: 'Test revocation'
    })
    expect(revokeError).toBeNull()
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
const contracts = {
  protocol: process.env.PROTOCOL_CONTRACT_ID,
  authority: process.env.AUTHORITY_CONTRACT_ID
}

// Check if contracts are deployed
const sdk = new StellarAttestProtocol({
  network: Networks.TESTNET,
  contracts
})

// Verify the contract addresses are correct for your network
console.log('Using contracts:', contracts)
```

#### 2. Insufficient Funds for Transaction

```
Error: Insufficient funds for transaction fees
```

**Solution:**
```typescript
// Fund your testnet account
const keypairs = createTestKeypairs()
const fundingUrls = generateFundingUrls([
  keypairs.authorityPublic,
  keypairs.recipientPublic
])

console.log('Fund accounts at:', fundingUrls)

// Or check account balance
async function checkBalance(publicKey: string) {
  const response = await fetch(
    `https://horizon-testnet.stellar.org/accounts/${publicKey}`
  )
  const account = await response.json()
  const balance = account.balances.find((b: any) => b.asset_type === 'native')
  return balance ? parseFloat(balance.balance) : 0
}
```

#### 3. Schema Validation Errors

```
SchemaValidationError: Field 'email' must be a string
```

**Solution:**
```typescript
// Debug schema validation
const schema = createStandardizedSchemaEncoder('identity')

try {
  schema.validateData(yourData)
} catch (error) {
  console.error('Validation details:', {
    field: error.field,
    message: error.message,
    receivedValue: yourData[error.field],
    expectedType: schema.getSchema().fields.find(f => f.name === error.field)?.type
  })
}

// Generate valid defaults
const defaults = schema.generateDefaults()
console.log('Valid default values:', defaults)
```

#### 4. Authority Permission Denied

```
Error: Authority not authorized for schema
```

**Solution:**
```typescript
// Check authority permissions
const hasPermission = await sdk.authority.hasPermission(
  sdk.publicKey,
  schemaUid
)

if (!hasPermission) {
  // Register as authority or request permission
  await sdk.authority.register({
    name: 'Your Organization',
    description: 'Description of your authority'
  })
  
  // Or request permission from schema owner
  console.log('Request permission from schema owner')
}
```

#### 5. Network Connection Issues

```
Error: Failed to submit transaction to network
```

**Solution:**
```typescript
// Implement retry logic with exponential backoff
async function submitWithRetry(transaction: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await sdk.submitTransaction(transaction)
    } catch (error) {
      if (i === maxRetries - 1) throw error
      
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      )
    }
  }
}

// Check network status
const networkStatus = await fetch('https://soroban-testnet.stellar.org/health')
console.log('Network status:', networkStatus.status)
```

### Debug Mode

```typescript
// Enable debug logging
const sdk = new StellarAttestProtocol({
  network: Networks.TESTNET,
  // Add debug flag if available
  debug: true
})

// Manual transaction inspection
sdk.on('transaction', (tx) => {
  console.log('Transaction details:', {
    hash: tx.hash,
    operations: tx.operations.length,
    fee: tx.fee
  })
})
```

## Migration Guide

### Migrating from Legacy Systems

```typescript
// Legacy to standardized schema migration
class LegacyMigrationService {
  constructor(private sdk: StellarAttestProtocol) {}

  async migrateLegacyAttestation(legacyData: {
    id: string
    userId: string
    verified: boolean
    verificationDate: number
    documentType: string
  }) {
    // Transform legacy data to standardized format
    const standardizedData = {
      fullName: await this.lookupUserName(legacyData.userId),
      documentType: this.mapDocumentType(legacyData.documentType),
      verificationLevel: legacyData.verified ? 'basic' : 'pending',
      verificationDate: legacyData.verificationDate,
      verifiedBy: this.sdk.publicKey,
      legacyId: legacyData.id // Keep reference to original
    }

    // Create new attestation using standardized schema
    const { data: attestationUid, error } = await this.sdk.attest.create({
      schemaUid: await this.getIdentitySchemaUid(),
      subject: await this.deriveAddressFromUserId(legacyData.userId),
      data: JSON.stringify(standardizedData),
      reference: `migrated-${legacyData.id}`,
      expirationTime: null,
      revocable: true
    })

    if (error) {
      throw new Error(`Migration failed for ${legacyData.id}: ${error}`)
    }

    return attestationUid
  }

  private mapDocumentType(legacyType: string): string {
    const mapping: Record<string, string> = {
      'driver_license': 'drivers_license',
      'passport': 'passport',
      'id_card': 'national_id'
    }
    return mapping[legacyType] || 'other'
  }

  private async lookupUserName(userId: string): Promise<string> {
    // Implement user lookup logic
    return `User ${userId}`
  }

  private async deriveAddressFromUserId(userId: string): Promise<string> {
    // Implement deterministic address derivation
    // Generate deterministic address (custom implementation needed)
    return `G${userId.slice(0, 54).toUpperCase().padEnd(54, 'A')}`
  }

  private async getIdentitySchemaUid(): Promise<string> {
    return 'your-identity-schema-uid'
  }
}
```

### Version Upgrade Guide

```typescript
// Upgrading from v1 to v2 schema format
const v1Schema = {
  name: 'Identity V1',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'verified', type: 'boolean' }
  ]
}

const v2Schema = new StellarSchemaEncoder({
  name: 'Identity V2',
  version: '2.0.0',
  description: 'Enhanced identity verification',
  fields: [
    { name: 'fullName', type: StellarDataType.STRING },
    { name: 'verificationLevel', type: StellarDataType.STRING },
    { name: 'verificationDate', type: StellarDataType.TIMESTAMP },
    { name: 'verifiedBy', type: StellarDataType.ADDRESS }
  ]
})

// Migration function
function migrateV1ToV2(v1Data: any) {
  return {
    fullName: v1Data.name,
    verificationLevel: v1Data.verified ? 'basic' : 'none',
    verificationDate: Date.now(),
    verifiedBy: 'GMIGRATION...ADDRESS'
  }
}
```

## Contributing

We welcome contributions to the Stellar Attestation Service SDK! Please see our [Contributing Guide](../../CONTRIBUTING.md) for detailed information on:

- Setting up the development environment
- Code style and conventions
- Testing requirements
- Submitting pull requests
- Reporting issues

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

# Run examples
pnpm example
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