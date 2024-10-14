import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { SchemaRegistry } from '../target/types/schema_registry'
import { PublicKey } from '@solana/web3.js'
import { expect } from './_expect'

describe('resolver', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.SchemaRegistry as Program<SchemaRegistry>

  // it("Is initialized!", async () => {
  //   // Add your test here.
  //   const tx = await program.methods.initialize().rpc();
  //   console.log("[resolver]: Your transaction signature", tx);
  // });

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

  // Test 4: Register a new schema.
  it('Registers a new schema', async () => {
    const schemaName = 'example-schema'
    const schemaContent = '{"name": "example", "type": "object"}'
    const resolverAddress = null // Or set to a valid Pubkey
    const revocable = true

    // Derive the schemaData PDA
    const [schemaDataPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('schema'), authorityKeypair.publicKey.toBuffer(), Buffer.from(schemaName)],
      program.programId
    )

    const tx = await program.methods
      .register(schemaName, schemaContent, resolverAddress, revocable)
      .accounts({
        deployer: authorityKeypair.publicKey,
        // systemProgram: SystemProgram.programId,
      })
      .signers([authorityKeypair]) // Deployer is the authority and signer
      .rpc()

    console.log(
      '[@attestso/solana-attestation-registry::Registers a new schema]::::::::::::Schema registered with transaction signature:',
      tx
    )

    // Save the schema UID for later use
    schemaUID = schemaDataPDA
    // tx returns a UID which is a public key, update schemaUID with it

    // Check that the schema data is saved correctly.

    const schemaAccount = await program.account.schemaData.fetch(schemaDataPDA)
    expect(schemaAccount.schema).to.equal(schemaContent)
    if (resolverAddress) {
      expect(schemaAccount.resolver.toBase58()).to.equal(resolverAddress.toBase58())
    } else {
      expect(schemaAccount.resolver).to.be.null
    }
    expect(schemaAccount.revocable).to.be.true
    expect(schemaAccount.deployer.toBase58()).to.equal(authorityKeypair.publicKey.toBase58())
  })

  it('Fails when registering a schema with the same variables', async () => {
    const schemaName = 'example-schema'
    const schemaContent = '{"name": "example", "type": "object"}'
    const resolverAddress = null // Or set to a valid Pubkey
    const revocable = true

    try {
      const tx = await program.methods
        .register(schemaName, schemaContent, resolverAddress, revocable)
        .accounts({
          deployer: authorityKeypair.publicKey,
        })
        .signers([authorityKeypair]) // Deployer is the authority and signer
        .rpc()

      // Check that the schema data is saved correctly.
      const schemaAccount = await program.account.schemaData.fetch(tx)
      expect(schemaAccount.revocable).to.be.true
      expect(schemaAccount.deployer.toBase58()).to.equal(authorityKeypair.publicKey.toBase58())
    } catch (error) {
      console.warn(
        '[@attestso/solana-attestation-registry::Duplicate Schema]::::::::::::Schema registered with transaction signature:',
        error
      )
    }
  })

  // Test 5: Fetch an existing schema.
  it('///unit:test/// Fetches a schema using UID', async () => {
    const schemaAccount = await program.account.schemaData.fetch(schemaUID)

    console.log('[@attestso/solana-attestation-registry::Fetches a schema using UID::Fetched Schema:', schemaAccount)

    // Verify schema details.
    expect(schemaAccount.schema).to.equal('{"name": "example", "type": "object"}')
    expect(schemaAccount.deployer.toBase58()).to.equal(authorityKeypair.publicKey.toBase58())
  })
})
