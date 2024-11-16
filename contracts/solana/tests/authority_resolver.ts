import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { AuthorityResolver } from '../target/types/authority_resolver'
import { PublicKey } from '@solana/web3.js'
import { expect } from './_expect'

describe('resolver', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.AuthorityResolver as Program<AuthorityResolver>

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc()
    console.log('[resolver]: Your transaction signature', tx)
  })

  // Configure the client to use the local cluster.

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

  // Test 2: Register a new authority.
  it('///unit:test/// Registers a new authority', async () => {
    // Derive the authorityRecord PDA
    const [authorityRecordPDA, authorityRecordBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority'), authorityKeypair.publicKey.toBuffer()],
      program.programId
    )

    console.log('[@attestso/solana-attestation-authority::register new authority]', {
      authorityRecordPDA: authorityRecordPDA.toBase58(),
    })

    const tx = await program.methods
      .registerAuthority()
      .accounts({
        // authorityRecord: authorityRecordPDA,
        authority: authorityKeypair.publicKey,
      })
      .signers([authorityKeypair])
      .rpc()

    console.log(
      '[@attestso/solana-attestation-authority]::::::::::::Authority registered with transaction signature:',
      tx
    )
    console.log(
      '[@attestso/solana-attestation-authority:[Fetch authority]>>>>>>>>>>>>>',
      await program.account.authorityRecord.fetch(authorityRecordPDA)
    )

    // Check if the authority was registered correctly.
    const authorityAccount = await program.account.authorityRecord.fetch(authorityRecordPDA)
    expect(authorityAccount.authority.toBase58()).to.equal(authorityKeypair.publicKey.toBase58())
    expect(authorityAccount.isVerified).to.be.false
  })

  // Test 3: Update authority verification status.
  it('Verifies an authority', async () => {
    // Derive the authorityRecord PDA
    const [authorityRecordPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('authority'), authorityKeypair.publicKey.toBuffer()],
      program.programId
    )

    // Update the authority's verification status.
    const tx = await program.methods
      .verifyAuthority(true)
      .accounts({
        authorityRecord: authorityRecordPDA,
        admin: adminKeypair.publicKey,
      })
      .signers([adminKeypair])
      .rpc()

    console.log(
      '[@attestso/solana-attestation-authority]::::::::::::Authority verified with transaction signature:',
      tx
    )

    // Verify that the authority's status is updated.
    const authorityAccount = await program.account.authorityRecord.fetch(authorityRecordPDA)
    expect(authorityAccount.isVerified).to.be.true
  })
})
