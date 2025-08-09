import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'crypto'
import { Keypair } from '@stellar/stellar-sdk'
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

  // Test data
  let testRunId: string
  let schemaDefinition: string
  let schemaUid: Buffer
  let recipient: string
  let attestationValue: string
  let attestationReference: string

  beforeAll(async () => {
    // Load test configuration
    config = loadTestConfig()
    adminKeypair = Keypair.fromSecret(config.adminSecretKey)

    // Initialize protocol client using testnet with contract ID from env.sh
    protocolClient = new ProtocolContract.Client({
      contractId: config.protocolContractId,
      networkPassphrase: ProtocolContract.networks.testnet.networkPassphrase,
      rpcUrl: config.rpcUrl,
      allowHttp: true,
      publicKey: adminKeypair.publicKey(),
      secretKey: config.adminSecretKey
    })

    // Generate test data
    testRunId = randomBytes(4).toString('hex')
    schemaDefinition = `IntegrationTestSchema_${testRunId}(field=String)`
    recipient = Keypair.random().publicKey()
    attestationValue = `test_value_${testRunId}`
    attestationReference = `ref_${testRunId}`

    // Fund admin account if needed
    try {
      await protocolClient.options.publicKey && 
      await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(adminKeypair.publicKey())}`)
    } catch {
      // Friendbot funding may fail if account already exists - ignore
    }

    // Wait for account setup
    await new Promise(resolve => setTimeout(resolve, 3000))
  })

  it('should register a schema successfully', async () => {
    const tx = await protocolClient.register({
      caller: adminKeypair.publicKey(),
      schema_definition: schemaDefinition,
      resolver: null, // No resolver
      revocable: true
    }, {
      fee: 1000000,
      timeoutInSeconds: 30
    })

    const result = await tx.signAndSend({ publicKey: adminKeypair.publicKey(), secretKey: config.adminSecretKey })

    expect(result.isOk()).toBe(true)
    
    if (result.isOk()) {
      schemaUid = result.value
      expect(Buffer.isBuffer(schemaUid)).toBe(true)
      expect(schemaUid.length).toBe(32)
    }
  }, 60000)

  it('should create an attestation', async () => {
    expect(schemaUid).toBeDefined()

    const tx = await protocolClient.attest({
      caller: adminKeypair.publicKey(),
      schema_uid: schemaUid,
      subject: recipient,
      value: attestationValue,
      reference: attestationReference
    }, {
      fee: 1000000,
      timeoutInSeconds: 30
    })

    const result = await tx.signAndSend({ publicKey: adminKeypair.publicKey(), secretKey: config.adminSecretKey })

    expect(result.isOk()).toBe(true)
  }, 60000)

  it('should read the attestation', async () => {
    expect(schemaUid).toBeDefined()

    const tx = await protocolClient.get_attestation({
      schema_uid: schemaUid,
      subject: recipient,
      reference: attestationReference
    }, {
      simulate: true // Read-only operation
    })

    const result = await tx.simulate()

    expect(result.isOk()).toBe(true)
    
    if (result.isOk()) {
      const attestation = result.value
      expect(attestation.schema_uid.toString('hex')).toBe(schemaUid.toString('hex'))
      expect(attestation.subject).toBe(recipient)
      expect(attestation.value).toBe(attestationValue)
      expect(attestation.reference).toBe(attestationReference)
      expect(attestation.revoked).toBe(false)
    }
  }, 60000)

  it('should revoke the attestation', async () => {
    expect(schemaUid).toBeDefined()

    const tx = await protocolClient.revoke_attestation({
      caller: adminKeypair.publicKey(),
      schema_uid: schemaUid,
      subject: recipient,
      reference: attestationReference
    }, {
      fee: 1000000,
      timeoutInSeconds: 30
    })

    const result = await tx.signAndSend({ publicKey: adminKeypair.publicKey(), secretKey: config.adminSecretKey })

    expect(result.isOk()).toBe(true)
  }, 60000)

  it('should verify attestation is revoked', async () => {
    expect(schemaUid).toBeDefined()

    const tx = await protocolClient.get_attestation({
      schema_uid: schemaUid,
      subject: recipient,
      reference: attestationReference
    }, {
      simulate: true
    })

    const result = await tx.simulate()

    expect(result.isOk()).toBe(true)
    
    if (result.isOk()) {
      const attestation = result.value
      expect(attestation.revoked).toBe(true)
    }
  }, 60000)
})