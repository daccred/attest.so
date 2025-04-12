import { AttestSDK } from '../src'
import * as StellarSdk from '@stellar/stellar-sdk'

async function run() {
  console.log('Starting Stellar attestation test...')

  // Initialize test accounts
  const url = 'https://horizon-testnet.stellar.org'

  // These are test keypairs - in a real app you would use real keypairs or secret keys
  const authorityKeypair = StellarSdk.Keypair.random()
  const recipientKeypair = StellarSdk.Keypair.random()

  console.log('Authority public key:', authorityKeypair.publicKey())
  console.log('Recipient public key:', recipientKeypair.publicKey())

  // Fund accounts on testnet - this would be done externally in a real app
  // You can use the Stellar Laboratory or Friendbot to fund accounts in testnet
  console.log(
    `Fund the authority account at: https://laboratory.stellar.org/#account-creator?network=test`
  )
  console.log(
    `Or use Friendbot: https://friendbot.stellar.org/?addr=${encodeURIComponent(
      authorityKeypair.publicKey()
    )}`
  )

  // Initialize the Stellar SDK
  const stellarSDK = await AttestSDK.initializeStellar({
    url,
    secretKey: authorityKeypair.secret(),
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })

  console.log('SDK initialized')

  try {
    // Initialize contract (set admin)
    console.log('Initializing contract...')
    const initResult = await stellarSDK.initialize()
    if (initResult.error) {
      console.error('Failed to initialize contract:', initResult.error)
    } else {
      console.log('Contract initialized')
    }

    // Fetch authority
    console.log('Fetching authority...')
    const { data: authority, error: authorityError } = await stellarSDK.fetchAuthority()
    if (authorityError) {
      console.error('Failed to fetch authority:', authorityError)
    } else {
      console.log('Authority:', authority)
    }

    // Create schema
    console.log('Creating schema...')
    const { data: schema, error: schemaError } = await stellarSDK.createSchema({
      schemaName: 'test-schema',
      schemaContent: 'string name, string email, uint8 verification_level',
      revocable: true,
    })

    if (schemaError || !schema) {
      console.error('Failed to create schema:', schemaError)
    } else {
      console.log('Schema created with UID:', schema)

      // Fetch the created schema
      console.log('Fetching schema...')
      const fetchSchemaResult = await stellarSDK.fetchSchema(schema)
      if (fetchSchemaResult.error) {
        console.error('Failed to fetch schema:', fetchSchemaResult.error)
      } else {
        console.log('Fetched schema:', fetchSchemaResult.data)
      }

      // Create attestation
      console.log('Creating attestation...')
      const { data: attestation, error: attestationError } = await stellarSDK.attest({
        schemaData: schema,
        data: JSON.stringify({
          name: 'John Doe',
          email: 'john@example.com',
          verification_level: 2,
        }),
        // Reference to another attestation (optional)
        refUID: null,
        // Can be revoked later
        revocable: true,
        // The accounts involved in this attestation
        accounts: {
          recipient: recipientKeypair.publicKey(),
          // These fields are required by the base interface but not used in Stellar
          levyReceipent: authorityKeypair.publicKey(),
          mintAccount: authorityKeypair.publicKey(),
        },
      })

      if (attestationError || !attestation) {
        console.error('Failed to create attestation:', attestationError)
      } else {
        console.log('Attestation created with ID:', attestation)

        // Fetch the created attestation
        console.log('Fetching attestation...')
        const fetchAttestationResult = await stellarSDK.fetchAttestation(attestation)
        if (fetchAttestationResult.error) {
          console.error('Failed to fetch attestation:', fetchAttestationResult.error)
        } else {
          console.log('Fetched attestation:', fetchAttestationResult.data)
        }

        // Revoke the attestation
        console.log('Revoking attestation...')
        const { data: revokedAttestation, error: revokeError } = await stellarSDK.revokeAttestation(
          {
            schemaUID: schema,
            recipient: recipientKeypair.publicKey(),
          }
        )

        if (revokeError || !revokedAttestation) {
          console.error('Failed to revoke attestation:', revokeError)
        } else {
          console.log('Attestation revoked:', revokedAttestation)

          // Fetch the attestation again to see the revocation
          console.log('Fetching revoked attestation...')
          const fetchRevokedResult = await stellarSDK.fetchAttestation(revokedAttestation)
          if (fetchRevokedResult.error) {
            console.error('Failed to fetch revoked attestation:', fetchRevokedResult.error)
          } else {
            console.log('Fetched revoked attestation:', fetchRevokedResult.data)
          }
        }
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error)
  }

  console.log('Test completed')
}

run().catch((err) => {
  console.error('Error running test:', err)
})
