import * as anchor from '@coral-xyz/anchor'
import { Program, AnchorError } from '@coral-xyz/anchor'
import { AuthorityResolver } from '../target/types/authority_resolver'
import { SchemaRegistry } from '../target/types/schema_registry'
import { SolanaAttestationService } from '../target/types/solana_attestation_service'
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
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const authority_program = anchor.workspace.AuthorityResolver as Program<AuthorityResolver>
  const schema_program = anchor.workspace.SchemaRegistry as Program<SchemaRegistry>
  const attestation_program = anchor.workspace
    .SolanaAttestationService as Program<SolanaAttestationService>

  // Generate keypairs
  const authorityKeypair = anchor.web3.Keypair.generate()
  const unauthorityKeypair = anchor.web3.Keypair.generate()
  const recipientKeypair = anchor.web3.Keypair.generate()
  const levyRecipientKeypair = anchor.web3.Keypair.generate()
  const attestKeypair = anchor.web3.Keypair.generate()
  let schemaUID: PublicKey

  let mintAcount: PublicKey
  let attesterTokenAccount: PublicKey
  let levyTokenAccount: PublicKey

  // Airdrop SOL to the authority and admin for testing
  before(async () => {
    // Airdrop to authority
    const airdropSig1 = await provider.connection.requestAirdrop(
      authorityKeypair.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    )
    await provider.connection.confirmTransaction(airdropSig1)
    // Airdrop to unauthority
    const airdropSig2 = await provider.connection.requestAirdrop(
      unauthorityKeypair.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    )
    await provider.connection.confirmTransaction(airdropSig2)

    // Airdrop to attester
    const airdropSig3 = await provider.connection.requestAirdrop(
      attestKeypair.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    )
    await provider.connection.confirmTransaction(airdropSig3)

    mintAcount = await createMint(
      provider.connection,
      authorityKeypair, // Payer
      authorityKeypair.publicKey, // Mint authority
      null, // Freeze authority
      0 // Decimals
    )

    attesterTokenAccount = await createAccount(
      provider.connection,
      authorityKeypair, // Payer
      mintAcount, // Mint
      attestKeypair.publicKey // Owner
    )

    levyTokenAccount = await createAccount(
      provider.connection,
      authorityKeypair, // Payer
      mintAcount, // Mint
      levyRecipientKeypair.publicKey // Owner
    )

    await mintTo(
      provider.connection,
      authorityKeypair, // Payer
      mintAcount, // Mint
      attesterTokenAccount, // Destination
      authorityKeypair, // Authority
      10_000, // Amount
      [], // Multi signers
      undefined, // Confirm options
      TOKEN_PROGRAM_ID
    )
  })

  it('user can register authority', async () => {
    // Derive the authorityRecord PDA
    const [authorityRecordPDA, authorityRecordBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority'), authorityKeypair.publicKey.toBuffer()],
      authority_program.programId
    )

    await authority_program.methods
      .registerAuthority()
      .accounts({
        authority: authorityKeypair.publicKey,
      })
      .signers([authorityKeypair])
      .rpc()

    // Check if the authority was registered correctly.
    const authorityAccount = await authority_program.account.authorityRecord.fetch(
      authorityRecordPDA
    )
    expect(authorityAccount.authority.toBase58()).to.equal(authorityKeypair.publicKey.toBase58())
    expect(authorityAccount.isVerified).to.be.false
  })

  // TODO - add these cases
  // unathorized cannot create schema
  // authority can create schema with token levy
  // authority can create shcema with sol levy
  // authority can create schema without levy
  //
  // TODO - add checks if not present
  // creating a levy without a receipent
  // creating a levy without an amount
  // creating a levy without an asset(this defaults to sol)
  it('authority can create schema with token levy', async () => {
    const schemaName = 'example-schema'
    const schemaContent = '{"name": "example", "type": "object"}'
    const resolverAddress = null // Or set to a valid Pubkey
    const revocable = true
    const levy = {
      amount: new anchor.BN(10),
      asset: mintAcount,
      recipient: authorityKeypair.publicKey,
    }

    // Derive the authorityRecord PDA
    const [authorityRecordPDA, authorityRecordBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority'), authorityKeypair.publicKey.toBuffer()],
      authority_program.programId
    )

    // Derive the schemaData PDA
    const [schemaDataPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('schema'), authorityKeypair.publicKey.toBuffer(), Buffer.from(schemaName)],
      schema_program.programId
    )

    await schema_program.methods
      .createSchema(schemaName, schemaContent, resolverAddress, revocable, levy)
      .accounts({
        deployer: authorityKeypair.publicKey,
        authorityRecord: authorityRecordPDA,
      })
      .signers([authorityKeypair]) // Deployer is the authority and signer
      .rpc()

    const schemeDataAccount = await schema_program.account.schemaData.fetch(schemaDataPDA)
    expect(schemeDataAccount.levy.amount.toNumber()).to.equal(10)
    expect(schemeDataAccount.levy.recipient.toBase58()).to.equal(
      authorityKeypair.publicKey.toBase58()
    )
  })

  // TODO - add these cases
  // attester can attest with sol levy
  // attester can attest with token levy
  // attester can attest without levy
  it('attester can attest with token levy', async () => {
    const data = 'This is a test attestation data.'
    const refUid = null // No reference UID
    const expirationTime = null // No expiration time
    const revocable = true

    const schemaName = 'example-schema'
    // Derive the schemaData PDA
    const [schemaDataPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('schema'), authorityKeypair.publicKey.toBuffer(), Buffer.from(schemaName)],
      schema_program.programId
    )

    // Derive the attestation PDA
    const [attestationPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from('attestation'),
        schemaDataPDA.toBuffer(),
        recipientKeypair.publicKey.toBuffer(),
        attestKeypair.publicKey.toBuffer(),
      ],
      attestation_program.programId
    )

    await attestation_program.methods
      .attest(data, refUid, expirationTime, revocable)
      .accounts({
        attester: attestKeypair.publicKey,
        recipient: recipientKeypair.publicKey,
        levyReceipent: levyRecipientKeypair.publicKey,
        deployer: authorityKeypair.publicKey,
        mintAccount: mintAcount,
        attesterTokenAccount: attesterTokenAccount,
        levyReceipentTokenAccount: levyTokenAccount,
        schemaData: schemaDataPDA,
        attestation: attestationPDA,
        schemaRegistryProgram: schema_program.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([attestKeypair])
      .rpc()

    const levyTokenAccountBalance = await provider.connection.getTokenAccountBalance(
      levyTokenAccount
    )
    expect(levyTokenAccountBalance.value.amount).to.equal('10')
  })
})
