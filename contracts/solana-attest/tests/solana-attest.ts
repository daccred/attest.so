import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { expect } from 'chai';
import { Attestso, IDL } from '../target/types/attestso'; // Generated IDL

describe('attestso', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Fetch the program IDL (you must have it in the target folder after compiling).
  // @ts-ignore
  const program = anchor.workspace.SolanaAttest as Program<Attestso>;

  const programId = new PublicKey('7KP6jDDanUAkFGTbkf9uXTDMsWhNGEyPyWjP5spsKBUz'); 
  // const program = new Program<Attestso>(IDL, programId, provider);


  let authorityKeypair = anchor.web3.Keypair.generate();
  let schemaUID: PublicKey;

  // Test 1: Initialize the program.
  it('Initializes the program', async () => {
    const tx = await program.methods.initialize().rpc();
    console.log('Program initialized with transaction signature:', tx);
  });

  // Test 2: Register a new authority.
  it('Registers a new authority', async () => {
    // Prepare the transaction for registering authority.
    const authorityPDA = await PublicKey.findProgramAddress(
      [Buffer.from('authority'), authorityKeypair.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .findOrSetAuthority()
      .accounts({
        authority: authorityKeypair.publicKey,
        authorityRecord: authorityPDA[0],
        systemProgram: SystemProgram.programId,
      })
      .signers([authorityKeypair])
      .rpc();

    console.log('Authority registered with transaction signature:', tx);

    // Check if the authority was registered correctly.
    const authorityAccount = await program.account.authorityRecord.fetch(authorityPDA[0]);
    expect(authorityAccount.authority.toBase58()).to.equal(authorityKeypair.publicKey.toBase58());
    expect(authorityAccount.isVerified).to.be.false;
  });

  // Test 3: Update authority verification status.
  // it('Verifies an authority', async () => {
  //   const authorityPDA = PublicKey.findProgramAddressSync(
  //     [Buffer.from('authority'), authorityKeypair.publicKey.toBuffer()],
  //     program.programId
  //   );

  //   // Update the authority's verification status.
  //   const tx = await program.methods
  //     .updateAuthority(true)
  //     .accounts({
  //       authorityRecord: authorityPDA[0],
  //       admin: authorityKeypair.publicKey,
  //     })
  //     .signers([authorityKeypair])
  //     .rpc();

  //   console.log('Authority verified with transaction signature:', tx);

  //   // Verify that the authority's status is updated.
  //   const authorityAccount = await program.account.authorityRecord.fetch(authorityPDA[0]);
  //   expect(authorityAccount.isVerified).to.be.true;
  // });

  // Test 4: Register a new schema.
  it('Registers a new schema', async () => {
    const schemaName = 'example-schema';
    const schemaContent = '{"name": "example", "type": "object"}';
    const resolverAddress = anchor.web3.Keypair.generate().publicKey;
    const revocable = true;

    // Derive the schema's PDA.
    const [schemaPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('schema'), authorityKeypair.publicKey.toBuffer(), Buffer.from(schemaName)],
      program.programId
    );

    const tx = await program.methods
      .register(schemaName, schemaContent, resolverAddress, revocable)
      .accounts({
        deployer: authorityKeypair.publicKey,
        schemaData: schemaPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([authorityKeypair])
      .rpc();

    console.log('Schema registered with transaction signature:', tx);

    // Save the schema UID for later use in the get_schema test.
    schemaUID = schemaPDA;

    // Check that the schema data is saved correctly.
    const schemaAccount = await program.account.schemaData.fetch(schemaPDA);
    expect(schemaAccount.schema).to.equal(schemaContent);
    expect(schemaAccount.resolver.toBase58()).to.equal(resolverAddress.toBase58());
    expect(schemaAccount.revocable).to.be.true;
    expect(schemaAccount.deployer.toBase58()).to.equal(authorityKeypair.publicKey.toBase58());
  });

  // Test 5: Fetch an existing schema.
  // it('Fetches a schema using UID', async () => {
  //   const schemaAccount = await program.account.schemaData.fetch(schemaUID);

  //   console.log('Fetched Schema:', schemaAccount);

  //   // Verify schema details.
  //   expect(schemaAccount.schema).to.equal('{"name": "example", "type": "object"}');
  //   expect(schemaAccount.deployer.toBase58()).to.equal(authorityKeypair.publicKey.toBase58());
  // });
});
