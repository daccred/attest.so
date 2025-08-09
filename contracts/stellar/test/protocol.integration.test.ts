import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'crypto'
import { Keypair, rpc, Transaction } from '@stellar/stellar-sdk'
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
      publicKey: adminKeypair.publicKey()
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
      resolver: undefined, // No resolver (Option<string>)
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

    // Extract returned Buffer from Result
    const res = sent.result
    if (res && typeof res === 'object' && 'unwrap' in res) {
      const value = (res as ProtocolContract.contract.Result<Buffer>).unwrap()
      schemaUid = value
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

    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        transaction.sign(adminKeypair)
        return { signedTxXdr: transaction.toXDR() }
      }
    })

    const res = sent.result as ProtocolContract.contract.Result<void>
    expect(res.isOk()).toBe(true)
  }, 60000)

  it('should read the attestation', async () => {
    expect(schemaUid).toBeDefined()

    const tx = await protocolClient.get_attestation({
      schema_uid: schemaUid,
      subject: recipient,
      reference: attestationReference
    })

    await tx.simulate()
    const record = (tx.result as ProtocolContract.contract.Result<ProtocolContract.AttestationRecord>).unwrap()

    expect(record).toBeDefined()
    expect(record.schema_uid.toString('hex')).toBe(schemaUid.toString('hex'))
    expect(record.subject).toBe(recipient)
    expect(record.value).toBe(attestationValue)
    expect(record.reference).toBe(attestationReference)
    expect(record.revoked).toBe(false)
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

    const sent = await tx.signAndSend({
      signTransaction: async (xdr) => {
        const { Transaction } = await import('@stellar/stellar-sdk')
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        transaction.sign(adminKeypair)
        return { signedTxXdr: transaction.toXDR() }
      }
    })

    const res = sent.result as ProtocolContract.contract.Result<void>
    expect(res.isOk()).toBe(true)
  }, 60000)

  it('should verify attestation is revoked', async () => {
    expect(schemaUid).toBeDefined()

    const tx = await protocolClient.get_attestation({
      schema_uid: schemaUid,
      subject: recipient,
      reference: attestationReference
    })

    await tx.simulate()
    const record = (tx.result as ProtocolContract.contract.Result<ProtocolContract.AttestationRecord>).unwrap()

    expect(record).toBeDefined()
    expect(record.revoked).toBe(true)
  }, 60000)
})