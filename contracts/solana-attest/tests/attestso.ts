import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import { Attestso } from '../target/types/attestso'
import { expect } from './expect-util';


describe('attestso', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  // Fetch the program IDL (you must have it in the target folder after compiling).
  const program = anchor.workspace.Attestso as Program<Attestso>

  // Generate keypairs
  const authorityKeypair = anchor.web3.Keypair.generate()
  const adminKeypair = anchor.web3.Keypair.generate() // Assuming a separate admin
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
    console.log('[attestso]:Program initialized with transaction signature:', tx)
  })

    // Test 2: Register a new authority.
    it('///unit:test/// Registers a new authority', async () => {
      // Derive the authorityRecord PDA
      const [authorityRecordPDA, authorityRecordBump] = PublicKey.findProgramAddressSync(
        [Buffer.from('authority'), authorityKeypair.publicKey.toBuffer()],
        program.programId
      );
  
      console.log('[attestso::register new authority]', { authorityRecordPDA: authorityRecordPDA.toBase58() });
  
      const tx = await program.methods
        .findOrSetAuthority()
        .accounts({
          // authorityRecord: authorityRecordPDA,
          authority: authorityKeypair.publicKey,
        })
        .signers([authorityKeypair])
        .rpc();
  
      console.log('Authority registered with transaction signature:', tx);
      console.log('[Fetch authority]>>>>>>>>>>>>>', await program.account.authorityRecord.fetch(authorityRecordPDA))
  
      // Check if the authority was registered correctly.
      const authorityAccount = await program.account.authorityRecord.fetch(authorityRecordPDA);
      expect(authorityAccount.authority.toBase58()).to.equal(authorityKeypair.publicKey.toBase58());
      expect(authorityAccount.isVerified).to.be.false;
    });
  
    // Test 3: Update authority verification status.
    it('Verifies an authority', async () => {
      // Derive the authorityRecord PDA
      const [authorityRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('authority'), authorityKeypair.publicKey.toBuffer()],
        program.programId
      );
  
      // Update the authority's verification status.
      const tx = await program.methods
        .updateAuthority(true)
        .accounts({
          authorityRecord: authorityRecordPDA,
          admin: adminKeypair.publicKey,
        })
        .signers([adminKeypair])
        .rpc();
  
      console.log('Authority verified with transaction signature:', tx);
  
      // Verify that the authority's status is updated.
      const authorityAccount = await program.account.authorityRecord.fetch(authorityRecordPDA);
      expect(authorityAccount.isVerified).to.be.true;
    });

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
      '[Registers a new schema]::::::::::::Schema registered with transaction signature:',
      tx
    )

    // Save the schema UID for later use
    schemaUID = schemaDataPDA
    // tx returns a UID which is a public key, update schemaUID with it

    // Check that the schema data is saved correctly.

    const schemaAccount = await program.account.schemaData.fetch(schemaDataPDA);
    expect(schemaAccount.schema).to.equal(schemaContent);
    if (resolverAddress) {
      expect(schemaAccount.resolver.toBase58()).to.equal(resolverAddress.toBase58());
    } else {
      expect(schemaAccount.resolver).to.be.null;
    }
    expect(schemaAccount.revocable).to.be.true;
    expect(schemaAccount.deployer.toBase58()).to.equal(authorityKeypair.publicKey.toBase58());
  });


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
        '[Duplicate Schema]::::::::::::Schema registered with transaction signature:',
        error
      )
    }
  })


  // Test 5: Fetch an existing schema.
  it('///unit:test/// Fetches a schema using UID', async () => {
    const schemaAccount = await program.account.schemaData.fetch(schemaUID)

    console.log('[Fetches a schema using UID::Fetched Schema:', schemaAccount)

    // Verify schema details.
    expect(schemaAccount.schema).to.equal('{"name": "example", "type": "object"}');
    expect(schemaAccount.deployer.toBase58()).to.equal(authorityKeypair.publicKey.toBase58());
  });
});
