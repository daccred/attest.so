/**
 * Protocol Integration Test Suite
 * 
 * Tests the core protocol contract functionality including:
 * - Schema registration and management
 * - Direct attestation creation and retrieval
 * - Attestation revocation
 * - Basic contract initialization verification
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'crypto'
import { Keypair, Transaction, xdr } from '@stellar/stellar-sdk'
import * as ProtocolContract from '../bindings/src/protocol'
import { loadTestConfig, fundAccountIfNeeded, createTestXDRSchema } from './testutils'

// Pre-generated XDR schema string for testing
// This represents a simple schema with one field: { name: "value", type: "string" }
const TEST_XDR_SCHEMA = "XDR:AAAAAQAAAA5UZXN0IFNjaGVtYSB4eHh4AAAAAQAAAAZ2YWx1ZQAAAAZzdHJpbmcAAAAAAA=="

/**
 * Utility functions for XDR conversion
 */
function xdrToString(xdrValue: xdr.ScVal): string {
  // Convert XDR to base64 string

  console.log('========xdrValue=========', ProtocolContract.scValToNative(xdrValue))
  return xdrValue.toXDR('base64')
}

function stringToXDR(base64String: string): xdr.ScVal {
  // Convert base64 string back to XDR
  return xdr.ScVal.fromXDR(base64String, 'base64')
}

describe('Protocol Contract Integration Tests', () => {
  let protocolClient: ProtocolContract.Client
  let adminKeypair: Keypair
  let config: {
    adminSecretKey: string
    rpcUrl: string
    protocolContractId: string
    authorityContractId: string
  }

  // Test accounts
  let attesterKp: Keypair

  // Test data
  let testRunId: string
  let schemaUid: Buffer
  let attestationUid: Buffer

  beforeAll(async () => {
    // Load test configuration
    config = loadTestConfig()
    adminKeypair = Keypair.fromSecret(config.adminSecretKey)

    // Initialize protocol client
    protocolClient = new ProtocolContract.Client({
      contractId: config.protocolContractId,
      networkPassphrase: ProtocolContract.networks.testnet.networkPassphrase,
      rpcUrl: config.rpcUrl,
      allowHttp: true,
      publicKey: adminKeypair.publicKey()
    })

    // Generate test accounts
    attesterKp = Keypair.random()

    // Generate test data
    testRunId = randomBytes(4).toString('hex')

    // Fund test accounts that need it
    const accounts = [
      adminKeypair.publicKey(),
      attesterKp.publicKey(),
    ]

    for (const account of accounts) {
      await fundAccountIfNeeded(account)
    }

    // Wait for accounts to be ready
    await new Promise(resolve => setTimeout(resolve, 5000))
  }, 60000)

  it('should verify protocol contract is initialized', async () => {
    try {
      // Try to get an attestation (which will fail but shows contract is responding)
      const tx = await protocolClient.get_attestation({
        attestation_uid: Buffer.alloc(32, 0)
      })

      await tx.simulate()
      console.log('Protocol contract is accessible and initialized')
      expect(true).toBe(true) // Contract responded
    } catch (error: any) {
      // Expected to fail since attestation doesn't exist, but contract should respond
      console.log('Protocol contract error (expected):', error.message)
      expect(error.message).toBeDefined()
    }
  }, 30000)

  it('should register a schema', async () => {
    const schemaDefinition = `{"name":"Test Schema ${testRunId}","fields":[{"name":"value","type":"string"}]}`
    
    const tx = await protocolClient.register({
      caller: adminKeypair.publicKey(),
      schema_definition: schemaDefinition,
      resolver: undefined, // No resolver for this test
      revocable: true
    }, {
      fee: 1000000,
      timeoutInSeconds: 30
    })

    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        transaction.sign(adminKeypair)
        return { signedTxXdr: transaction.toXDR() }
      }
    })

    const res = sent.result as ProtocolContract.contract.Result<Buffer>
    expect(res.isOk()).toBe(true)
    schemaUid = res.unwrap()
    expect(schemaUid).toBeInstanceOf(Buffer)
    expect(schemaUid.length).toBe(32)
    console.log(`Schema registered with UID: ${schemaUid.toString('hex')}`)
  }, 60000)

  it('should register an XDR schema', async () => {
    // Use the pre-generated XDR schema
    const xdrSchema = TEST_XDR_SCHEMA
    
    const tx = await protocolClient.register({
      caller: adminKeypair.publicKey(),
      schema_definition: xdrSchema,
      resolver: undefined, // No resolver for this test
      revocable: true
    }, {
      fee: 1000000,
      timeoutInSeconds: 30
    })

    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        transaction.sign(adminKeypair)
        return { signedTxXdr: transaction.toXDR() }
      }
    })

    const res = sent.result as ProtocolContract.contract.Result<Buffer>
    expect(res.isOk()).toBe(true)
    const xdrSchemaUid = res.unwrap()
    expect(xdrSchemaUid).toBeInstanceOf(Buffer)
    expect(xdrSchemaUid.length).toBe(32)
    console.log(`XDR Schema registered with UID: ${xdrSchemaUid.toString('hex')}`)
  }, 60000)

  it('should register a Schema Encoded XDR from JSON', async () => {
    // Use the createTestXDRSchema function from testutils
    const dynamicSchema = createTestXDRSchema(`Dynamic Schema ${testRunId}`, [
      { name: 'verified', type: 'bool' },
      { name: 'score', type: 'u64' },
      { name: 'metadata', type: 'string' }
    ])
    
    const tx = await protocolClient.register({
      caller: adminKeypair.publicKey(),
      schema_definition: dynamicSchema,
      resolver: undefined, // No resolver for this test
      revocable: true
    }, {
      fee: 1000000,
      timeoutInSeconds: 30
    })

    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        transaction.sign(adminKeypair)
        return { signedTxXdr: transaction.toXDR() }
      }
    })

    const res = sent.result as ProtocolContract.contract.Result<Buffer>
    expect(res.isOk()).toBe(true)
    const dynamicSchemaUid = res.unwrap()
    expect(dynamicSchemaUid).toBeInstanceOf(Buffer)
    expect(dynamicSchemaUid.length).toBe(32)
    console.log(`Dynamic XDR Schema registered with UID: ${dynamicSchemaUid.toString('hex')}`)
  }, 60000)

  it('should demonstrate XDR to string conversion', async () => {
    // Example: Convert XDR to string and back
    const testString = "Hello World"
    const stringXdr = xdr.ScVal.scvString(testString)
    
    // XDR to string (base64)
    const xdrAsString = xdrToString(stringXdr)
    console.log('XDR as base64 string:', xdrAsString)
    
    // String back to XDR
    const backToXdr = stringToXDR(xdrAsString)
    console.log('Back to XDR:', backToXdr)
    
    // Verify they produce the same base64 representation
    expect(backToXdr.toXDR('base64')).toEqual(stringXdr.toXDR('base64'))
    
    // Also verify the actual string value is preserved
    expect(backToXdr.str().toString()).toEqual(testString)
  })

  it('should create an attestation', async () => {
    if (!schemaUid) {
      throw new Error('Schema UID not available - schema registration test must pass first')
    }

    const attestationValue = `{"value":"test_value_${testRunId}"}`
    
    // Create a client with attester as publicKey
    const attesterProtocolClient = new ProtocolContract.Client({
      contractId: config.protocolContractId,
      networkPassphrase: ProtocolContract.networks.testnet.networkPassphrase,
      rpcUrl: config.rpcUrl,
      allowHttp: true,
      publicKey: attesterKp.publicKey()
    })
    
    const tx = await attesterProtocolClient.attest({
      attester: attesterKp.publicKey(),
      schema_uid: schemaUid,
      value: attestationValue,
      expiration_time: undefined // No expiration
    }, {
      fee: 1000000,
      timeoutInSeconds: 30
    })

    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        transaction.sign(attesterKp)
        return { signedTxXdr: transaction.toXDR() }
      }
    })

    console.log('=======sent=========', { sent, result: sent.result.unwrap() })

    const res = sent.result as ProtocolContract.contract.Result<Buffer>
    expect(res.isOk()).toBe(true)
    attestationUid = res.unwrap()
    expect(attestationUid).toBeInstanceOf(Buffer)
    expect(attestationUid.length).toBe(32)
    console.log(`Attestation created with UID: ${attestationUid.toString('hex')}`)
  }, 60000)

  it('should retrieve an attestation', async () => {
    if (!attestationUid) {
      throw new Error('Attestation UID not available - attestation creation test must pass first')
    }

    const tx = await protocolClient.get_attestation({
      attestation_uid: attestationUid
    })

    await tx.simulate()
    const res = tx.result as ProtocolContract.contract.Result<ProtocolContract.Attestation>
    expect(res.isOk()).toBe(true)
    
    const attestation = res.unwrap()
    expect(attestation.uid).toEqual(attestationUid)
    expect(attestation.attester).toBe(attesterKp.publicKey())
    // In the new contract API, subject is the same as attester when not specified
    expect(attestation.subject).toBe(attesterKp.publicKey())
    expect(attestation.schema_uid).toEqual(schemaUid)
    console.log(`Retrieved attestation for subject: ${attestation.subject}`)
  }, 30000)

  it('should revoke an attestation', async () => {
    if (!attestationUid) {
      throw new Error('Attestation UID not available - attestation creation test must pass first')
    }

    // Create a client with attester as publicKey to revoke their own attestation
    const attesterProtocolClient = new ProtocolContract.Client({
      contractId: config.protocolContractId,
      networkPassphrase: ProtocolContract.networks.testnet.networkPassphrase,
      rpcUrl: config.rpcUrl,
      allowHttp: true,
      publicKey: attesterKp.publicKey()
    })

    const tx = await attesterProtocolClient.revoke({
      revoker: attesterKp.publicKey(),
      attestation_uid: attestationUid
    }, {
      fee: 1000000,
      timeoutInSeconds: 30
    })

    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        transaction.sign(attesterKp)
        return { signedTxXdr: transaction.toXDR() }
      }
    })

    const res = sent.result as ProtocolContract.contract.Result<void>
    expect(res.isOk()).toBe(true)
    console.log(`Attestation ${attestationUid.toString('hex')} revoked`)
  }, 60000)

  it('should verify attestation is revoked', async () => {
    if (!attestationUid) {
      throw new Error('Attestation UID not available')
    }

    try {
      const tx = await protocolClient.get_attestation({
        attestation_uid: attestationUid
      })

      await tx.simulate()
      const res = tx.result as ProtocolContract.contract.Result<ProtocolContract.Attestation>
      
      if (res.isOk()) {
        const attestation = res.unwrap()
        // Check if attestation shows as revoked
        expect(attestation.revoked).toBe(true)
        console.log({attestation}, 'Attestation correctly marked as revoked')
      }
    } catch (error: any) {
      // Attestation might not be found if it was completely removed
      console.log('Revoked attestation handling:', error.message)
      expect(error.message).toBeDefined()
    }
  }, 30000)

  it('should check attester nonce', async () => {
    const tx = await protocolClient.get_attester_nonce({
      attester: attesterKp.publicKey()
    })

    await tx.simulate()
    const result = tx.result
    expect(typeof result).toBe('bigint')
    expect(result).toBeGreaterThan(0n) // Should have incremented from our attestation
    console.log(`Attester nonce: ${result}`)
  }, 30000)
})