// client.ts
import {
    Connection,
    PublicKey,
    Keypair,
    TransactionInstruction,
    Transaction,
    sendAndConfirmTransaction,
    SystemProgram,
  } from '@solana/web3.js';
  import * as borsh from 'borsh';
  import * as fs from 'fs';
  
  // Replace with your program ID
  const PROGRAM_ID = new PublicKey('YourProgramPublicKey');
  
  class SchemaRecord {
    uid: Uint8Array;
    schema_definition: Uint8Array;
    resolver: Uint8Array | null;
    revocable: boolean;
  
    constructor(fields: {
      uid: Uint8Array;
      schema_definition: Uint8Array;
      resolver: Uint8Array | null;
      revocable: boolean;
    }) {
      this.uid = fields.uid;
      this.schema_definition = fields.schema_definition;
      this.resolver = fields.resolver;
      this.revocable = fields.revocable;
    }
  }
  
  const SchemaRecordSchema = new Map([
    [
      SchemaRecord,
      {
        kind: 'struct',
        fields: [
          ['uid', [32]],
          ['schema_definition', ['u8']],
          ['resolver', { kind: 'option', type: [32] }],
          ['revocable', 'u8'], // 1 for true, 0 for false
        ],
      },
    ],
  ]);
  
  // Function to generate UID
  function generateUID(data: Uint8Array): Uint8Array {
    const hash = require('crypto').createHash('sha256');
    hash.update(data);
    return Uint8Array.from(hash.digest());
  }
  
  async function main() {
    const connection = new Connection('http://localhost:8899', 'recent');
    const payer = Keypair.fromSecretKey(/* your secret key */);
  
    // Define your schema
    const schemaDefinition = Buffer.from(JSON.stringify({
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    }), 'utf-8');
  
    const schemaUID = generateUID(schemaDefinition);
  
    // Derive the schema account address
    const [schemaAccountAddress, _] = await PublicKey.findProgramAddress(
      [Buffer.from('schema'), schemaUID],
      PROGRAM_ID
    );
  
    // Create instruction data
    const instructionData = Buffer.from(
      Uint8Array.of(
        0, // Instruction index for RegisterSchema
        ...new borsh.BorshSerializer().serialize(
          SchemaRecordSchema,
          new SchemaRecord({
            uid: schemaUID,
            schema_definition: schemaDefinition,
            resolver: null,
            revocable: true,
          })
        )
      )
    );
  
    // Create the transaction instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: schemaAccountAddress, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: instructionData,
    });
  
    // Send the transaction
    const transaction = new Transaction().add(instruction);
    await sendAndConfirmTransaction(connection, transaction, [payer]);
  }
  
  main().catch((err) => {
    console.error(err);
  });
  