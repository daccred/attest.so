// submit-attestation.ts

import { sendAndConfirmTransaction, Transaction, TransactionInstruction } from '@solana/web3.js'
import { connection, payer, programId } from './send-schema-to-solana'

export const submitAttestation = async ({
  schemaUID,
}: {
  schemaUID: Uint8Array
  serializedSchema: Uint8Array
}) => {
  const attestationData = {
    uid: 'unique-attestation-id',
    name: 'Alice',
    age: 30,
    email: 'alice@example.com',
  }

  function serializeAttestationData(data: object): Uint8Array {
    const dataString = JSON.stringify(data)
    const encoder = new TextEncoder()
    return encoder.encode(dataString)
  }

  const serializedAttestationData = serializeAttestationData(attestationData)

  // Prepare instruction to send attestation data
  const submitAttestationIx = new TransactionInstruction({
    keys: [
      // Accounts required by your program
    ],
    programId,
    data: Buffer.concat([schemaUID, serializedAttestationData]), // Include schemaUID and data
  })

  // Send transaction
  const transaction = new Transaction().add(submitAttestationIx)
  await sendAndConfirmTransaction(connection, transaction, [payer])

  console.log('Attestation submitted successfully!')
}
