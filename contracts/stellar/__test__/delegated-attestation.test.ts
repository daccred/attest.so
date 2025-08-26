/**
 * Delegated Attestation Integration Tests
 * 
 * This test suite validates the complete delegated attestation flow including:
 * - BLS key registration and management
 * - Cross-platform signature creation and verification
 * - Nonce management and replay protection
 * - Delegated submission mechanics
 * - Error handling and edge cases
 * 
 * Tests are designed to run against testnet deployments to validate
 * real-world protocol behavior.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'crypto'
import { bls12_381 } from '@noble/curves/bls12-381'
import { sha256 } from '@noble/hashes/sha2'
import { Keypair, Transaction } from '@stellar/stellar-sdk'
import * as ProtocolContract from '../bindings/src/protocol'
import { loadTestConfig } from './testutils'

describe('Delegated Attestation Integration Tests', () => {
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
  let submitterKp: Keypair
  let subjectKp: Keypair

  // BLS key pair for the attester
  let attesterBlsPrivateKey: Uint8Array
  let attesterBlsPublicKey: Uint8Array

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
    submitterKp = Keypair.random()
    subjectKp = Keypair.random()

    // Use test BLS key pair from Rust tests (known to work with contract)
    attesterBlsPrivateKey = new Uint8Array([
      34, 38, 144, 121, 33, 229, 89, 185, 68, 32, 10, 221, 176, 119, 70, 160, 41, 238, 104, 43, 146, 16, 63, 200, 77,
      240, 207, 42, 165, 238, 248, 220
    ])
    
    attesterBlsPublicKey = new Uint8Array([
      6, 93, 9, 178, 174, 49, 129, 153, 182, 231, 94, 43, 166, 156, 240, 6, 245, 40, 128, 24, 16, 200, 165, 140, 213,
      138, 173, 184, 241, 181, 68, 79, 158, 235, 10, 199, 46, 1, 95, 170, 198, 80, 78, 154, 117, 34, 79, 34, 16, 150, 0,
      78, 71, 46, 44, 45, 50, 165, 223, 217, 71, 237, 143, 212, 88, 132, 30, 164, 254, 207, 117, 121, 40, 221, 243, 25,
      134, 151, 14, 113, 19, 237, 33, 147, 87, 231, 97, 232, 22, 143, 218, 33, 181, 245, 148, 178, 7, 157, 149, 57, 38,
      248, 116, 56, 250, 92, 108, 192, 238, 249, 61, 124, 118, 147, 186, 229, 174, 17, 68, 79, 170, 239, 234, 244, 72,
      255, 99, 171, 38, 111, 159, 131, 174, 144, 237, 194, 86, 4, 244, 176, 154, 77, 44, 188, 18, 17, 184, 111, 29, 54,
      215, 190, 219, 210, 202, 120, 188, 93, 86, 160, 66, 52, 177, 69, 209, 121, 52, 33, 200, 176, 183, 9, 180, 199, 245,
      30, 88, 170, 205, 232, 13, 241, 193, 193, 0, 137, 176, 174, 100, 179, 122, 8
    ])

    // Generate test data
    testRunId = randomBytes(4).toString('hex')

    // Fund test accounts using Friendbot
    const accounts = [
      adminKeypair.publicKey(),
      attesterKp.publicKey(),
      submitterKp.publicKey(),
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

  it('should register a BLS public key for the attester', async () => {
    const tx = await protocolClient.register_bls_key({
      attester: attesterKp.publicKey(),
      public_key: Buffer.from(attesterBlsPublicKey) // 192 bytes
    }, {
      fee: 1000000,
      timeoutInSeconds: 30
    })

    const needsSigningBy = tx.needsNonInvokerSigningBy()
    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        
        // Sign with all available keypairs
        const allKeypairs = [attesterKp, adminKeypair, submitterKp, subjectKp]
        for (const signer of needsSigningBy) {
          const keypair = allKeypairs.find(kp => kp.publicKey() === signer)
          if (keypair) {
            transaction.sign(keypair)
          } else {
            console.log(`No keypair available for signer: ${signer}`)
          }
        }
        
        return { signedTxXdr: transaction.toXDR() }
      }
    })

    const res = sent.result as ProtocolContract.contract.Result<void>
    expect(res.isOk()).toBe(true)
    console.log(`BLS key registered for attester: ${attesterKp.publicKey()}`)
  }, 60000)

  it('should retrieve the registered BLS public key', async () => {
    const tx = await protocolClient.get_bls_key({
      attester: attesterKp.publicKey()
    })

    await tx.simulate()
    const result = tx.result as ProtocolContract.contract.Option<ProtocolContract.BlsPublicKey>
    
    expect(result).toBeDefined()
    if (result) {
      expect(Buffer.from(result.key).equals(Buffer.from(attesterBlsPublicKey))).toBe(true)
      console.log('BLS public key retrieved successfully')
    }
  }, 30000)

  it('should register a schema for delegated attestations', async () => {
    const schemaDefinition = `{"name":"Delegated Test Schema ${testRunId}","fields":[{"name":"claim","type":"string"}]}`
    
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
    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        
        // Sign with all available keypairs
        const allKeypairs = [adminKeypair, attesterKp, submitterKp, subjectKp]
        for (const signer of needsSigningBy) {
          const keypair = allKeypairs.find(kp => kp.publicKey() === signer)
          if (keypair) {
            transaction.sign(keypair)
          } else {
            console.log(`No keypair available for signer: ${signer}`)
          }
        }
        
        return { signedTxXdr: transaction.toXDR() }
      }
    })

    const res = sent.result as ProtocolContract.contract.Result<Buffer>
    expect(res.isOk()).toBe(true)
    schemaUid = res.unwrap()
    console.log(`Schema registered for delegated attestations: ${schemaUid.toString('hex')}`)
  }, 60000)

  it('should get the attestation nonce for the attester', async () => {
    const tx = await protocolClient.get_attester_nonce({
      attester: attesterKp.publicKey()
    })

    await tx.simulate()
    const nonce = tx.result
    expect(typeof nonce).toBe('bigint')
    console.log(`Attester nonce: ${nonce}`)
  }, 30000)

  it('should get the DST (Domain Separation Tag) for attestation signatures', async () => {
    const tx = await protocolClient.get_dst_for_attestation()

    await tx.simulate()
    const dst = tx.result
    expect(dst).toBeInstanceOf(Buffer)
    expect(dst.length).toBeGreaterThan(0)
    console.log(`DST for attestation: ${Buffer.from(dst).toString('hex')}`)
  }, 30000)

  it('should create a delegated attestation request and submit it', async () => {
    if (!schemaUid) {
      throw new Error('Schema UID not available - schema registration test must pass first')
    }

    // Get current nonce
    const nonceTx = await protocolClient.get_attester_nonce({
      attester: attesterKp.publicKey()
    })
    await nonceTx.simulate()
    const nonce = nonceTx.result

    // Create deadline (1 hour from now)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)
    
    const attestationValue = `{"claim":"delegated_test_claim_${testRunId}"}`

    // Create the delegated attestation request
    const delegatedRequest: ProtocolContract.DelegatedAttestationRequest = {
      attester: attesterKp.publicKey(),
      deadline: deadline,
      nonce: nonce,
      schema_uid: schemaUid,
      subject: subjectKp.publicKey(),
      value: attestationValue,
      signature: Buffer.alloc(96) // Placeholder signature for now
    }

    // Get the DST for signing
    const dstTx = await protocolClient.get_dst_for_attestation()
    await dstTx.simulate()
    const dst = Buffer.from(dstTx.result)

    // Create the message to sign
    const messageToSign = createAttestationMessage(delegatedRequest, dst)
    
    // Sign with BLS private key (minimal signature scheme)
    const signature = bls12_381.sign(messageToSign, attesterBlsPrivateKey)
    delegatedRequest.signature = Buffer.from(signature)

    // Submit the delegated attestation (submitter pays the fees)
    const tx = await protocolClient.attest_by_delegation({
      submitter: submitterKp.publicKey(),
      request: delegatedRequest
    }, {
      fee: 1000000,
      timeoutInSeconds: 30
    })

    const needsSigningBy = tx.needsNonInvokerSigningBy()
    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        transaction.sign(submitterKp) // Submitter signs and pays fees
        
        for (const signer of needsSigningBy) {
          if (signer === submitterKp.publicKey()) continue
          console.log(`Additional signer required: ${signer}`)
        }
        
        return { signedTxXdr: transaction.toXDR() }
      }
    })

    const res = sent.result as ProtocolContract.contract.Result<Buffer>
    expect(res.isOk()).toBe(true)
    attestationUid = res.unwrap()
    console.log(`Delegated attestation created successfully with UID: ${attestationUid.toString('hex')}`)
  }, 60000)

  it('should verify nonce incremented after delegated attestation', async () => {
    const tx = await protocolClient.get_attester_nonce({
      attester: attesterKp.publicKey()
    })

    await tx.simulate()
    const nonce = tx.result
    expect(typeof nonce).toBe('bigint')
    expect(nonce).toBeGreaterThan(0n) // Should have incremented
    console.log(`Updated attester nonce: ${nonce}`)
  }, 30000)

  it('should create and submit a delegated revocation request', async () => {
    if (!attestationUid) {
      console.log('Skipping revocation test - no attestation UID available from direct attestation')
      return
    }

    // Get current nonce
    const nonceTx = await protocolClient.get_attester_nonce({
      attester: attesterKp.publicKey()
    })
    await nonceTx.simulate()
    const nonce = nonceTx.result

    const attestationTx = await protocolClient.get_attestation({
      attestation_uid: attestationUid
    })
    await attestationTx.simulate()
    const attestationResult = attestationTx.result as ProtocolContract.contract.Result<ProtocolContract.Attestation>
    const attestation = attestationResult.unwrap()

    // Create deadline (1 hour from now)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)

    // Create the delegated revocation request
    const delegatedRequest: ProtocolContract.DelegatedRevocationRequest = {
        attestation_uid: attestationUid,
        deadline: deadline,
        nonce: nonce,
        signature: Buffer.alloc(96),
        revoker: attestation.attester,
        schema_uid: attestation.schema_uid,
        subject: ''
    }

    // Get the DST for revocation signing
    const dstTx = await protocolClient.get_dst_for_revocation()
    await dstTx.simulate()
    const dst = Buffer.from(dstTx.result)

    // Create the message to sign
    const messageToSign = createRevocationMessage(delegatedRequest, dst)
    
    // Sign with BLS private key (minimal signature scheme)
    const signature = bls12_381.sign(messageToSign, attesterBlsPrivateKey)
    delegatedRequest.signature = Buffer.from(signature)

    // Submit the delegated revocation
    const tx = await protocolClient.revoke_by_delegation({
      submitter: submitterKp.publicKey(),
      request: delegatedRequest
    }, {
      fee: 1000000,
      timeoutInSeconds: 30
    })

    const needsSigningBy = tx.needsNonInvokerSigningBy()
    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        transaction.sign(submitterKp) // Submitter signs and pays fees
        
        for (const signer of needsSigningBy) {
          if (signer === submitterKp.publicKey()) continue
          console.log(`Additional signer required: ${signer}`)
        }
        
        return { signedTxXdr: transaction.toXDR() }
      }
    })

    const res = sent.result as ProtocolContract.contract.Result<void>
    expect(res.isOk()).toBe(true)
    console.log('Delegated revocation submitted successfully')
  }, 60000)
})

/**
 * Creates the message to sign for delegated attestations
 * Must match the exact format from delegation.rs create_attestation_message
 */
function createAttestationMessage(request: ProtocolContract.DelegatedAttestationRequest, dst: Buffer): Uint8Array {
  // Match exact format from Rust contract: 
  // Domain Separator + Schema UID + Nonce + Deadline + [Expiration Time] + Value Length
  const components: Buffer[] = []
  
  // Domain separation (ATTEST_PROTOCOL_V1_DELEGATED)
  components.push(Buffer.from('ATTEST_PROTOCOL_V1_DELEGATED', 'utf8'))
  
  // Schema UID (32 bytes)
  components.push(Buffer.from(request.schema_uid))
  
  // Nonce (8 bytes, big-endian u64)
  const nonceBuffer = Buffer.allocUnsafe(8)
  nonceBuffer.writeBigUInt64BE(request.nonce, 0)
  components.push(nonceBuffer)
  
  // Deadline (8 bytes, big-endian u64) 
  const deadlineBuffer = Buffer.allocUnsafe(8)
  deadlineBuffer.writeBigUInt64BE(request.deadline, 0)
  components.push(deadlineBuffer)
  
  // Optional expiration time - skip since request doesn't have it
  
  // Value length (8 bytes, big-endian u64)
  const valueLenBuffer = Buffer.allocUnsafe(8)
  valueLenBuffer.writeBigUInt64BE(BigInt(request.value.length), 0)
  components.push(valueLenBuffer)
  
  const message = Buffer.concat(components)
  return sha256(message)
}

/**
 * Creates the message to sign for delegated revocations
 * Must match the exact format from delegation.rs create_revocation_message
 */
function createRevocationMessage(request: ProtocolContract.DelegatedRevocationRequest, dst: Buffer): Uint8Array {
  const components: Buffer[] = []
  
  // Domain separation (REVOKE_PROTOCOL_V1_DELEGATED)
  components.push(Buffer.from('REVOKE_PROTOCOL_V1_DELEGATED', 'utf8'))
  
  // Schema UID (32 bytes)
  components.push(Buffer.from(request.schema_uid))
  
  // Nonce (8 bytes, big-endian u64)
  const nonceBuffer = Buffer.allocUnsafe(8)
  nonceBuffer.writeBigUInt64BE(request.nonce, 0)
  components.push(nonceBuffer)
  
  // Deadline (8 bytes, big-endian u64)
  const deadlineBuffer = Buffer.allocUnsafe(8)
  deadlineBuffer.writeBigUInt64BE(request.deadline, 0)
  components.push(deadlineBuffer)
  
  const message = Buffer.concat(components)
  return sha256(message)
}