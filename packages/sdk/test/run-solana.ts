import  AttestSDK from '../src'
import * as anchor from '@coral-xyz/anchor'
import { createMint, createAccount, mintTo } from '@solana/spl-token'

async function run() {
  const url = 'http://localhost:8899'
  const connection = new anchor.web3.Connection(url, 'confirmed')

  // Initialize SDK with Solana chain and relevant wallets
  const authorityKeypair = anchor.web3.Keypair.generate()
  const recipientKeypair = anchor.web3.Keypair.generate()
  const levyRecipientKeypair = anchor.web3.Keypair.generate()
  const attesterKeypair = anchor.web3.Keypair.generate()

  const authoritySolana = await AttestSDK.initializeSolana({
    url,
    walletOrSecretKey: new anchor.Wallet(authorityKeypair),
  })

  const attesterSolana = await AttestSDK.initializeSolana({
    url,
    walletOrSecretKey: new anchor.Wallet(attesterKeypair),
  })

  const authorityAirdrop = await connection.requestAirdrop(
    authorityKeypair.publicKey,
    anchor.web3.LAMPORTS_PER_SOL
  )
  console.log('Airdropped SOL to authority:', authorityAirdrop)
  await connection.confirmTransaction(authorityAirdrop)

  const attesterAirdrop = await connection.requestAirdrop(
    attesterKeypair.publicKey,
    anchor.web3.LAMPORTS_PER_SOL
  )
  console.log('Airdropped SOL to attester:', attesterAirdrop)
  await connection.confirmTransaction(attesterAirdrop)

  // Create Mint Account
  const mintAcount = await createMint(
    connection,
    authorityKeypair,
    authorityKeypair.publicKey,
    null,
    0
  )

  const attesterTokenAccount = await createAccount(
    connection,
    authorityKeypair,
    mintAcount,
    attesterKeypair.publicKey
  )
  await mintTo(
    connection,
    authorityKeypair,
    mintAcount,
    attesterTokenAccount,
    authorityKeypair,
    10_000
  )

  // Register as authority
  const { data: authority, error: authorityError } = await authoritySolana.registerAuthority()

  console.log({ authority, authorityError })
  const { data: schema, error: schemaError } = await authoritySolana.createSchema({
    schemaName: 'test-schema',
    schemaContent: 'string name, string email, uint8 verification_level',
    revocable: true,
    levy: {
      amount: new anchor.BN(10),
      asset: mintAcount,
      recipient: authorityKeypair.publicKey,
    },
  })

  if (schemaError) {
    console.error('Error creating schema:', schemaError)
  } else {
    console.log({ schema })
  }

  const fetchSchema = await attesterSolana.fetchSchema(schema!)

  console.log({ fetchSchema })

  const { data: attestation, error: attestationError } = await attesterSolana.attest({
    schemaData: schema!,
    data: 'This is a test attestation',
    revocable: true,
    accounts: {
      recipient: recipientKeypair.publicKey,
      levyReceipent: levyRecipientKeypair.publicKey,
      mintAccount: mintAcount,
    },
  })

  if (attestationError) {
    console.error('Error creating attestation:', attestationError)
  } else {
    console.log({ attestation })
  }

  const { data: fetchAttestation, error: fetchAttestationError } =
    await attesterSolana.fetchAttestation(attestation!)

  if (fetchAttestationError) {
    console.error('Error fetching attestation:', fetchAttestationError)
  } else {
    console.log({ fetchAttestation })
  }

  const { data: revokedAttestation, error: revokedAttestationError } =
    await attesterSolana.revokeAttestation({
      attestationUID: attestation!,
      recipient: recipientKeypair.publicKey,
    })

  if (revokedAttestationError) {
    console.error('Error revoking attestation:', revokedAttestationError)
  } else {
    console.log({ revokedAttestation })
  }
}

run().catch((err) => {
  console.error('Error running test:', err)
})
