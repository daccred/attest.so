import AttestSDK from '../src'
import * as StellarSdk from '@stellar/stellar-sdk'

async function run() {
  console.log('Starting Stellar attestation test...')

  // Initialize test accounts
  const url = 'https://soroban-testnet.stellar.org'

  // In a real app you would provide valid test keypairs
  // For demonstration, we use random keypairs
  const authorityKeypair = StellarSdk.Keypair.random()
  const recipientKeypair = StellarSdk.Keypair.random()

  console.log('Authority public key:', authorityKeypair.publicKey())
  console.log('Recipient public key:', recipientKeypair.publicKey())

  console.log(`IMPORTANT: Fund the authority account before proceeding`)
  console.log(`Fund the authority at: https://laboratory.stellar.org/#account-creator?network=test`)
  console.log(
    `Or use Friendbot: https://friendbot.stellar.org/?addr=${encodeURIComponent(
      authorityKeypair.publicKey()
    )}`
  )

  // Give time to fund the account
  console.log('Waiting 10 seconds to allow time for account funding...')
  await new Promise((resolve) => setTimeout(resolve, 10000))

  // Contract IDs - replace with actual deployed contract IDs if available
  const protocolContractId =
    process.env.PROTOCOL_CONTRACT_ID || 'CAF5SWYR7B7V5FYUXTGYXCRUNRQEIWEUZRDCARNMX456LRD64RX76BNN'
  const authorityContractId =
    process.env.AUTHORITY_CONTRACT_ID || 'CDQREK6BTPEVD4O56XR6TKLEEMNYTRJUG466J2ERNE5POIEKN2N6O7EL'

  console.log('Using Protocol Contract ID:', protocolContractId)
  console.log('Using Authority Contract ID:', authorityContractId)

  // Initialize the Stellar SDK
  const stellarSDK = await AttestSDK.initializeStellar({
    url,
    secretKey: authorityKeypair.secret(),
    networkPassphrase: StellarSdk.Networks.TESTNET,
    protocolContractId,
    authorityContractId,
  })

  console.log('SDK initialized')

  try {
    // Step 1: Initialize protocol contract (set admin)
    console.log('\n1. Initializing protocol contract...')
    const initResult = await stellarSDK.initialize()
    if (initResult.error) {
      console.error('Failed to initialize protocol contract:', initResult.error)
      console.log('Continuing with tests as the contract may already be initialized...')
    } else {
      console.log('Protocol contract initialized successfully')
    }

    // Step 2: Initialize authority contract (optional if using a token)
    // This step would require a deployed token contract ID
    if (process.env.TOKEN_CONTRACT_ID) {
      console.log('\n2. Initializing authority contract...')
      try {
        const authResult = await stellarSDK.initializeAuthority(process.env.TOKEN_CONTRACT_ID)
        if (authResult.error) {
          console.error('Failed to initialize authority contract:', authResult.error)
        } else {
          console.log('Authority contract initialized successfully')
        }
      } catch (error) {
        console.error('Authority initialization error:', error)
        console.log('Continuing with tests...')
      }
    } else {
      console.log('Skipping authority contract initialization (TOKEN_CONTRACT_ID not provided)')
    }

    // Step 3: Fetch authority (in Stellar this is implicit)
    console.log('\n3. Fetching authority...')
    const { data: authority, error: authorityError } = await stellarSDK.fetchAuthority()
    if (authorityError) {
      console.error('Failed to fetch authority:', authorityError)
    } else {
      console.log('Authority retrieved:', authority)
    }

    // Step 4: Create schema
    console.log('\n4. Creating schema...')
    const { data: schema, error: schemaError } = await stellarSDK.createSchema({
      schemaName: 'test-schema',
      schemaContent: 'string name, string email, uint8 verification_level',
      revocable: true,
    })

    if (schemaError || !schema) {
      console.error('Failed to create schema:', schemaError)
      throw new Error('Cannot continue without a valid schema')
    } else {
      console.log('Schema created with UID:', schema)

      // Step 5: Fetch the created schema
      console.log('\n5. Fetching schema...')
      const fetchSchemaResult = await stellarSDK.fetchSchema(schema)
      if (fetchSchemaResult.error) {
        console.error('Failed to fetch schema:', fetchSchemaResult.error)
      } else {
        console.log('Fetched schema:', fetchSchemaResult.data)
      }

      // Step 6: Create attestation
      console.log('\n6. Creating attestation...')

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
        },
      })

      if (attestationError || !attestation) {
        console.error('Failed to create attestation:', attestationError)
      } else {
        console.log('Attestation created with ID:', attestation)

        // Step 7: Fetch the created attestation
        console.log('\n7. Fetching attestation...')
        const fetchAttestationResult = await stellarSDK.fetchAttestation(attestation)
        if (fetchAttestationResult.error) {
          console.error('Failed to fetch attestation:', fetchAttestationResult.error)
        } else {
          console.log('Fetched attestation:', fetchAttestationResult.data)
        }

        // Step 8: Revoke the attestation
        console.log('\n8. Revoking attestation...')
        const { data: revokedAttestation, error: revokeError } = await stellarSDK.revokeAttestation(
          {
            attestationUID: attestation,
            recipient: recipientKeypair.publicKey(),
          }
        )

        if (revokeError || !revokedAttestation) {
          console.error('Failed to revoke attestation:', revokeError)
        } else {
          console.log('Attestation revoked with ID:', revokedAttestation)

          // Step 9: Fetch the attestation again to see the revocation
          console.log('\n9. Fetching revoked attestation...')
          const fetchRevokedResult = await stellarSDK.fetchAttestation(revokedAttestation)
          if (fetchRevokedResult.error) {
            console.error('Failed to fetch revoked attestation:', fetchRevokedResult.error)
          } else {
            console.log('Fetched revoked attestation:', fetchRevokedResult.data)
            console.log(
              'Revocation status:',
              fetchRevokedResult.data?.revoked ? 'Revoked' : 'Not Revoked'
            )
          }
        }
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error)
  }

  console.log('\nTest completed')
}

// Add ability to check for command line flags
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    skipFunding: args.includes('--skip-funding'),
    useTestnet: args.includes('--testnet'),
    protocolContract: args.find((arg) => arg.startsWith('--protocol='))?.split('=')[1],
    authorityContract: args.find((arg) => arg.startsWith('--authority='))?.split('=')[1],
    tokenContract: args.find((arg) => arg.startsWith('--token='))?.split('=')[1],
  }

  if (options.protocolContract) {
    process.env.PROTOCOL_CONTRACT_ID = options.protocolContract
  }
  if (options.authorityContract) {
    process.env.AUTHORITY_CONTRACT_ID = options.authorityContract
  }
  if (options.tokenContract) {
    process.env.TOKEN_CONTRACT_ID = options.tokenContract
  }

  return options
}

// Parse command line args and run tests
const options = parseArgs()
console.log('Test options:', options)
run().catch((err) => {
  console.error('Error running test:', err)
  process.exit(1)
})
