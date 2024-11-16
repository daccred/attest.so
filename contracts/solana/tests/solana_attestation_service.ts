import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import { SolanaAttestationService, IDL } from '../target/types/solana_attestation_service'
import { expect } from './_expect'

describe('SolanaAttestationService', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.SolanaAttestationService as Program<SolanaAttestationService>

  // Generate keypairs
  const authorityKeypair = anchor.web3.Keypair.generate()
  const adminKeypair = anchor.web3.Keypair.generate() // Assuming a separate admin
  const recipientKeypair = anchor.web3.Keypair.generate()
  let schemaUID: PublicKey

  // Airdrop SOL to the authority and admin for testing
  before(async () => {
    // Airdrop to authority
    const airdropSig1 = await provider.connection.requestAirdrop(
      authorityKeypair.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    )
    await provider.connection.confirmTransaction(airdropSig1)
    // Airdrop to admin
    const airdropSig2 = await provider.connection.requestAirdrop(
      adminKeypair.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    )
    await provider.connection.confirmTransaction(airdropSig2)
  })

  // Test 1: Initialize the program.
  it('Initializes the program', async () => {
    const tx = await program.methods.initialize().rpc()
    console.log(
      '[@attestso/solana-attestation-service]:Program initialized with transaction signature:',
      tx
    )
  })
 
 

  // Test 5: Fetch an existing schema.
  it('///unit:test/// Fetches a schema using UID', async () => {
    const schemaAccount = await program.account.schemaData.fetch(schemaUID)

    console.log('[Fetches a schema using UID::Fetched Schema:', schemaAccount)

    // Verify schema details.
    expect(schemaAccount.schema).to.equal('{"name": "example", "type": "object"}')
    expect(schemaAccount.deployer.toBase58()).to.equal(authorityKeypair.publicKey.toBase58())
  })

  it('Creates a new attestation', async () => {
    const attester = authorityKeypair // Using the authorityKeypair as the attester
    const recipient = recipientKeypair.publicKey
    const data = 'This is a test attestation data.'
    const refUid = null // No reference UID
    const expirationTime = null // No expiration time
    const revocable = true

    // Derive the attestation PDA
    const [attestationPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from('attestation'),
        schemaUID.toBuffer(),
        recipient.toBuffer(),
        attester.publicKey.toBuffer(),
      ],
      program.programId
    )

    // Call the create_attestation method
    const tx = await program.methods
      .createAttestation(data, refUid, expirationTime, revocable)
      .accounts({
        attester: attester.publicKey,
        recipient: recipient,
        schemaData: schemaUID,
        // attestation: attestationPDA,
        // systemProgram: SystemProgram.programId,
      })
      .signers([attester])
      .rpc()

    console.log('Attestation created with transaction signature:', tx)

    // Fetch the attestation account
    const attestationAccount = await program.account.attestation.fetch(attestationPDA)

    // Verify attestation details
    expect(attestationAccount.schema.toBase58()).to.equal(schemaUID.toBase58())
    expect(attestationAccount.recipient.toBase58()).to.equal(recipient.toBase58())
    expect(attestationAccount.attester.toBase58()).to.equal(attester.publicKey.toBase58())
    expect(attestationAccount.data).to.equal(data)
    expect(attestationAccount.time.toNumber()).to.greaterThan(0)
    expect(attestationAccount.expirationTime).to.be.null
    expect(attestationAccount.revocable).to.be.true
    expect(attestationAccount.revocationTime).to.be.null
    expect(attestationAccount.uid.toBase58()).to.equal(attestationPDA.toBase58())
  })

  // Test 7: Revoke the attestation
  it('Revokes an existing attestation', async () => {
    const attester = authorityKeypair
    const recipient = recipientKeypair.publicKey

    // Derive the attestation PDA
    const [attestationPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from('attestation'),
        schemaUID.toBuffer(),
        recipient.toBuffer(),
        attester.publicKey.toBuffer(),
      ],
      program.programId
    )

    // Call the revoke_attestation method
    const tx = await program.methods
      .revokeAttestation(schemaUID, recipient)
      .accounts({
        attester: attester.publicKey,
        attestation: attestationPDA,
      })
      .signers([attester])
      .rpc()

    console.log('Attestation revoked with transaction signature:', tx)

    // Fetch the attestation account
    const attestationAccount = await program.account.attestation.fetch(attestationPDA)

    // Verify that revocation_time is set
    expect(attestationAccount.revocationTime.toNumber()).to.greaterThan(0)

    // Try revoking again and expect an error
    try {
      await program.methods
        .revokeAttestation(schemaUID, recipient)
        .accounts({
          attester: attester.publicKey,
          attestation: attestationPDA,
        })
        .signers([attester])
        .rpc()
      throw new Error('Expected error when revoking an already revoked attestation')
    } catch (error) {
      // Check that the error is the expected one
      const errMsg = 'Attestation already revoked.'
      expect(error.error.errorMessage).to.equal(errMsg)
    }
  })
})
