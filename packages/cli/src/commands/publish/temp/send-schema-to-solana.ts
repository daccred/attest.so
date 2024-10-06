// send-schema-to-solana.ts

import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from '@solana/web3.js'

//apparently, the payer secret key can't be same as who created the contract program
let secretKey = Uint8Array.from([
  69, 132, 107, 242, 113, 121, 246, 82, 219, 188, 155, 155, 130, 227, 159, 161, 177, 47, 124, 94, 0, 57, 17, 108, 55,
  49, 13, 190, 226, 41, 238, 123, 59, 206, 230, 210, 224, 60, 102, 242, 242, 64, 37, 158, 230, 188, 59, 248, 98, 152,
  119, 124, 191, 119, 160, 32, 187, 241, 158, 38, 188, 103, 139, 223,
])

// Assuming you have a Solana connection and wallet setup
export const connection = new Connection('http://127.0.0.1:8899')
export const payer = Keypair.fromSecretKey(secretKey)

// The program ID of your Solana contract
export const programId = new PublicKey('3rzXdwEZfnod7NvkeFGkx8Tp73ERaRfUPwjPEnvKaYrF')

/**
 *
 * THIS IS THE FIRST TEST FNUCTION BUT KEEPS RETURNING, PROGRAM ERROR
 *
 */
export const sendSchemaToSolana1 = async ({
  schemaUID,
  serializedSchema,
}: {
  schemaUID: Uint8Array
  serializedSchema: Uint8Array
}) => {
  // The account where the schema will be stored
  const schemaAccount = await PublicKey.createWithSeed(payer.publicKey, 'schema' + schemaUID.toString(), programId)
  console.log({ schemaAccount })

  // Create the account if it doesn't exist
  const lamports = await connection.getMinimumBalanceForRentExemption(serializedSchema.length)
  console.log({ lamports })

  // Create an instruction to create the account
  const createAccountIx = SystemProgram.createAccountWithSeed({
    fromPubkey: payer.publicKey,
    basePubkey: payer.publicKey,
    seed: 'schema' + schemaUID.toString(),
    newAccountPubkey: schemaAccount,
    lamports,
    space: serializedSchema.length,
    programId,
  })
  console.log({ createAccountIx })

  // Create an instruction to store the schema
  const storeSchemaIx = new TransactionInstruction({
    keys: [
      { pubkey: schemaAccount, isSigner: false, isWritable: true },
      // Add any other necessary accounts
    ],
    programId,
    data: Buffer.concat([schemaUID, serializedSchema]), // Instruction data contains schemaUID and serializedSchema
  })

  console.log({ storeSchemaIx })

  // // Create and send the transaction
  const transaction = new Transaction().add(createAccountIx, storeSchemaIx)
  console.log({ transaction })

  try {
    const res = await sendAndConfirmTransaction(connection, transaction, [payer])
    console.log({ res })
    return res
  } catch (error: any) {
    console.error('Transaction failed', error)
    console.error('Transaction failed', await error.getLogs(connection))

    throw error
  }
}

import { Buffer } from 'buffer'
import * as borsh from 'borsh'
import { RegisterSchemaInstructionData, registerSchemaInstructionSchema } from './instruction'

// Ensure Buffer is available globally
if (typeof Buffer === 'undefined') {
  global.Buffer = Buffer
}

// Define the layout for your instruction data if needed
// Alternatively, since you're using Borsh for serialization, ensure server-side matches the client-side schema.

/**
 *
 * THIS IS THE SECOND TEST FNUCTION BUT KEEPS RETURNING
 * Error: Signature verification failed.
 * Missing signature for public key [`EkcaSBFK3G2NwGzmFLe2ik5WBceKvNJDbN4jt1UctCwC`].
 *
 */
export const sendSchemaToSolana = async ({
  schemaUID,
  serializedSchema,
}: {
  schemaUID: Uint8Array
  serializedSchema: Uint8Array
}) => {
  // The program ID of your Solana contract (Replace with your actual Program ID)
  const programId = new PublicKey('3rzXdwEZfnod7NvkeFGkx8Tp73ERaRfUPwjPEnvKaYrF')

  // Derive the schema account address with a seed
  const schemaAccount = await PublicKey.createWithSeed(payer.publicKey, 'schema' + schemaUID.toString(), programId)
  console.log({ schemaAccount })

  // Calculate the minimum lamports required for rent exemption
  const lamports = await connection.getMinimumBalanceForRentExemption(serializedSchema.length)
  console.log({ lamports })

  // Create an instruction to create the schema account with the seed
  const createAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: schemaAccount,
    lamports,
    space: serializedSchema.length,
    programId,
  })

  console.log({ createAccountIx })

  const registerSchemaInstruction = new RegisterSchemaInstructionData(
    0, // Assuming RegisterSchema is the first instruction variant
    serializedSchema, // Schema definition
    0, // Resolver (replace with PublicKey if needed)
    true, // Revocable
  )

  // Serialize instruction data using Borsh
  const instructionData = borsh.serialize(registerSchemaInstructionSchema, registerSchemaInstruction)

  // Create the TransactionInstruction to register the schema
  const storeSchemaIx = new TransactionInstruction({
    keys: [
      { pubkey: schemaAccount, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    ],
    programId,
    data: Buffer.from(instructionData),
  })

  console.log({ storeSchemaIx })

  // Create and send the transaction
  const transaction = new Transaction().add(createAccountIx, storeSchemaIx)
  console.log({ transaction })

  try {
    const res = await sendAndConfirmTransaction(connection, transaction, [payer])
    console.log({ res })
    return res
  } catch (error: any) {
    console.error('Transaction failed', error)
    if (error.logs) {
      console.error('Transaction logs:', error.logs)
    } else if (error.message) {
      console.error('Error message:', error.message)
    }
    throw error
  }
}
