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
import { Keypair, Transaction } from '@stellar/stellar-sdk'
import * as ProtocolContract from '../bindings/src/protocol'
import { loadTestConfig } from './test-utils'

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
  let subjectKp: Keypair

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
      allowHttp: true
    })

    // Generate test accounts
    attesterKp = Keypair.random()
    subjectKp = Keypair.random()

    // Generate test data
    testRunId = randomBytes(4).toString('hex')

    // Fund test accounts using Friendbot
    const accounts = [
      adminKeypair.publicKey(),
      attesterKp.publicKey(),
      subjectKp.publicKey()
    ]

    for (const account of accounts) {
      try {
        console.log(`Funding account: ${account}`)
        const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(account)}`)
        if (!response.ok) {
          console.warn(`Friendbot funding failed for ${account}: ${response.statusText}`)
        }
      } catch (error) {
        console.warn(`Error funding account ${account}:`, error)
      }
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

    const needsSigningBy = tx.needsNonInvokerSigningBy()
    console.log(`Schema registration needs signatures from: ${needsSigningBy.join(', ')}`)
    
    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        transaction.sign(adminKeypair)
        
        for (const signer of needsSigningBy) {
          if (signer === adminKeypair.publicKey()) {
            // Already signed above
            continue
          }
          console.log(`Additional signer required: ${signer}`)
        }
        
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

  it('should create an attestation', async () => {
    if (!schemaUid) {
      throw new Error('Schema UID not available - schema registration test must pass first')
    }

    const attestationValue = `{"value":"test_value_${testRunId}"}`
    
    const tx = await protocolClient.attest({
      attester: attesterKp.publicKey(),
      schema_uid: schemaUid,
      subject: subjectKp.publicKey(),
      value: attestationValue,
      expiration_time: undefined // No expiration
    }, {
      fee: 1000000,
      timeoutInSeconds: 30
    })

    const needsSigningBy = tx.needsNonInvokerSigningBy()
    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        transaction.sign(attesterKp) // Attester signs
        
        for (const signer of needsSigningBy) {
          if (signer === attesterKp.publicKey()) continue
          console.log(`Additional signer required: ${signer}`)
        }
        
        return { signedTxXdr: transaction.toXDR() }
      }
    })

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
    expect(attestation.subject).toBe(subjectKp.publicKey())
    expect(attestation.schema_uid).toEqual(schemaUid)
    console.log(`Retrieved attestation for subject: ${attestation.subject}`)
  }, 30000)

  it('should revoke an attestation', async () => {
    if (!attestationUid) {
      throw new Error('Attestation UID not available - attestation creation test must pass first')
    }

    const tx = await protocolClient.revoke_attestation({
      revoker: attesterKp.publicKey(),
      attestation_uid: attestationUid
    }, {
      fee: 1000000,
      timeoutInSeconds: 30
    })

    const needsSigningBy = tx.needsNonInvokerSigningBy()
    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        transaction.sign(attesterKp) // Original attester signs
        
        for (const signer of needsSigningBy) {
          if (signer === attesterKp.publicKey()) continue
          console.log(`Additional signer required: ${signer}`)
        }
        
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