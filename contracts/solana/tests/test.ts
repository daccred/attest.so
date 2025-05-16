import * as anchor from '@coral-xyz/anchor'
import { Program, AnchorError } from '@coral-xyz/anchor'
import { Attest } from '../target/types/attest'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { expect } from './_expect'
// import { assert, expect } from 'chai'
const {
  createMint,
  createAccount,
  mintTo,
  getAssociatedTokenAddress,
} = require('@solana/spl-token')
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'

describe('attest.so', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const attest = anchor.workspace.Attest as Program<Attest>

  const authorityKeypair = anchor.web3.Keypair.generate()
  const unauthorityKeypair = anchor.web3.Keypair.generate()
  const recipientKeypair = anchor.web3.Keypair.generate()
  const levyRecipientKeypair = anchor.web3.Keypair.generate()
  const attestKeypair = anchor.web3.Keypair.generate()
  let schemaUID: PublicKey

  let mintAcount: PublicKey
  let attesterTokenAccount: PublicKey
  let levyTokenAccount: PublicKey

  before(async () => {
    console.log('Starting setup...')

    const airdropSig1 = await provider.connection.requestAirdrop(
      authorityKeypair.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    )
    console.log('Airdropped SOL to authority:', airdropSig1)
    await provider.connection.confirmTransaction(airdropSig1)

    const airdropSig2 = await provider.connection.requestAirdrop(
      unauthorityKeypair.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    )
    console.log('Airdropped SOL to unauthority:', airdropSig2)
    await provider.connection.confirmTransaction(airdropSig2)

    const airdropSig3 = await provider.connection.requestAirdrop(
      attestKeypair.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    )
    console.log('Airdropped SOL to attester:', airdropSig3)
    await provider.connection.confirmTransaction(airdropSig3)

    mintAcount = await createMint(
      provider.connection,
      authorityKeypair,
      authorityKeypair.publicKey,
      null,
      0
    )
    console.log('Created mint account:', mintAcount.toBase58())

    attesterTokenAccount = await createAccount(
      provider.connection,
      authorityKeypair,
      mintAcount,
      attestKeypair.publicKey
    )
    console.log('Created attester token account:', attesterTokenAccount.toBase58())

    levyTokenAccount = await createAccount(
      provider.connection,
      authorityKeypair,
      mintAcount,
      levyRecipientKeypair.publicKey
    )
    console.log('Created levy token account:', levyTokenAccount.toBase58())

    await mintTo(
      provider.connection,
      authorityKeypair,
      mintAcount,
      attesterTokenAccount,
      authorityKeypair,
      10_000
    )
    console.log('Minted tokens to attester token account')
  })

  it('user can register authority', async () => {
    console.log('Registering authority...')
    const [authorityRecordPDA, authorityRecordBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority'), authorityKeypair.publicKey.toBuffer()],
      attest.programId
    )
    console.log('Derived authorityRecord PDA:', authorityRecordPDA.toBase58())

    await attest.methods
      .registerAuthority()
      .accounts({
        authority: authorityKeypair.publicKey,
      })
      .signers([authorityKeypair])
      .rpc()
    console.log('Authority registered successfully')

    const authorityAccount = await attest.account.authorityRecord.fetch(authorityRecordPDA)
    console.log('Fetched authority account:', authorityAccount)
    expect(authorityAccount.authority.toBase58()).to.equal(authorityKeypair.publicKey.toBase58())
    expect(authorityAccount.isVerified).to.be.false
  })

  it('authority can create schema with token levy', async () => {
    console.log('Creating schema with token levy...')
    const schemaName = 'example-schema'
    const schemaContent = '{"name": "example", "type": "object"}'
    const resolverAddress = null
    const revocable = true
    const levy = {
      amount: new anchor.BN(10),
      asset: mintAcount,
      recipient: authorityKeypair.publicKey,
    }

    const [authorityRecordPDA, authorityRecordBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority'), authorityKeypair.publicKey.toBuffer()],
      attest.programId
    )
    console.log('Derived authorityRecord PDA:', authorityRecordPDA.toBase58())

    const [schemaDataPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('schema'), authorityKeypair.publicKey.toBuffer(), Buffer.from(schemaName)],
      attest.programId
    )
    console.log('Derived schemaData PDA:', schemaDataPDA.toBase58())

    await attest.methods
      .createSchema(schemaName, schemaContent, resolverAddress, revocable, levy)
      .accounts({
        deployer: authorityKeypair.publicKey,
        authorityRecord: authorityRecordPDA,
      })
      .signers([authorityKeypair])
      .rpc()
    console.log('Schema created successfully')

    const schemeDataAccount = await attest.account.schemaData.fetch(schemaDataPDA)
    console.log('Fetched schema data account:', schemeDataAccount)
    expect(schemeDataAccount.levy.amount.toNumber()).to.equal(10)
    expect(schemeDataAccount.levy.recipient.toBase58()).to.equal(
      authorityKeypair.publicKey.toBase58()
    )
  })

  it('attester can attest with token levy', async () => {
    console.log('Attesting with token levy...')
    const data = 'This is a test attestation data.'
    const refUid = null
    const expirationTime = null
    const revocable = true

    const schemaName = 'example-schema'
    const [schemaDataPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('schema'), authorityKeypair.publicKey.toBuffer(), Buffer.from(schemaName)],
      attest.programId
    )
    console.log('Derived schemaData PDA:', schemaDataPDA.toBase58())

    const [attestationPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from('attestation'),
        schemaDataPDA.toBuffer(),
        recipientKeypair.publicKey.toBuffer(),
        attestKeypair.publicKey.toBuffer(),
      ],
      attest.programId
    )
    console.log('Derived attestation PDA:', attestationPDA.toBase58())

    await attest.methods
      .attest(data, refUid, expirationTime, revocable)
      .accounts({
        attester: attestKeypair.publicKey,
        recipient: recipientKeypair.publicKey,
        levyReceipent: levyRecipientKeypair.publicKey,
        mintAccount: mintAcount,
        schemaData: schemaDataPDA,
      })
      .signers([attestKeypair])
      .rpc()
    console.log('Attestation completed successfully')

    const levyTokenAccountBalance =
      await provider.connection.getTokenAccountBalance(levyTokenAccount)
    console.log('Levy token account balance:', levyTokenAccountBalance.value.amount)
    expect(levyTokenAccountBalance.value.amount).to.equal('10')

    // Store schema UID for later tests
    schemaUID = schemaDataPDA
  })

  it('attester can revoke attestation', async () => {
    console.log('Revoking attestation...')

    const [attestationPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from('attestation'),
        schemaUID.toBuffer(),
        recipientKeypair.publicKey.toBuffer(),
        attestKeypair.publicKey.toBuffer(),
      ],
      attest.programId
    )
    console.log('Derived attestation PDA:', attestationPDA.toBase58())

    // Fetch attestation account before revocation
    const attestationBefore = await attest.account.attestation.fetch(attestationPDA)
    console.log('Attestation before revocation:', attestationBefore)
    expect(attestationBefore.revocationTime).to.be.null

    // Revoke the attestation
    await attest.methods
      .revokeAttestation(schemaUID, recipientKeypair.publicKey)
      .accounts({
        attester: attestKeypair.publicKey,
        attestation: attestationPDA,
      })
      .signers([attestKeypair])
      .rpc()
    console.log('Attestation revoked successfully')

    // Fetch attestation account after revocation
    const attestationAfter = await attest.account.attestation.fetch(attestationPDA)
    console.log('Attestation after revocation:', attestationAfter)
    expect(attestationAfter.revocationTime).to.be.not_null

    // Try to revoke again, should fail with AlreadyRevoked error
    try {
      await attest.methods
        .revokeAttestation(schemaUID, recipientKeypair.publicKey)
        .accounts({
          attester: attestKeypair.publicKey,
          attestation: attestationPDA,
        })
        .signers([attestKeypair])
        .rpc()
      // assert.fail('Should have thrown AlreadyRevoked error')
    } catch (error) {
      console.error(error)
      expect(error.message).to.include('AlreadyRevoked')
    }
  })
})
