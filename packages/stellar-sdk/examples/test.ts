import StellarAttestProtocol from '../src'
import * as client from '@stellar/stellar-sdk'

async function run(options: any = {}) {
  console.log('Starting Stellar attestation test...')

  // Authority Keypair: SALAT34FZK3CSTAWIOT6D4PY6UWKSG6AABGJHXJZCOUHUGP75DDOFPO4
  // Recipient Keypair: SCA2IFDKXLRPWCMUWIW6RLOCVGXOQOFQJIODGGGJQ2UAD2RI3WQAXLKX
  // Authority public key: GBULAMIEKTTBKNV44XSC3SQZ7P2YU5BTBZI3WG3ZDYBPIH7N74D3SXAA
  // Recipient public key: GCBG6NXX3TNAYFSJMJ6XZWJOZHIUSEHIXTTZ3HHRVPWLBIH427OYGZ4C
  const authorityKeypair = client.Keypair.fromSecret(
    'SALAT34FZK3CSTAWIOT6D4PY6UWKSG6AABGJHXJZCOUHUGP75DDOFPO4'
  )
  const recipientKeypair = client.Keypair.fromSecret(
    'SCA2IFDKXLRPWCMUWIW6RLOCVGXOQOFQJIODGGGJQ2UAD2RI3WQAXLKX'
  )

  console.log('Authority public key:', authorityKeypair.publicKey())
  console.log('Recipient public key:', recipientKeypair.publicKey())

  // Check if accounts need funding and display info
  console.log(`
=======================================================================
IMPORTANT: Before running this test, make sure to fund the test accounts
with XLM on the Stellar Testnet. Use the Stellar Friendbot to fund them:

Authority Account:
https://friendbot.stellar.org/?addr=${authorityKeypair.publicKey()}

Recipient Account:
https://friendbot.stellar.org/?addr=${recipientKeypair.publicKey()}

You can also visit https://laboratory.stellar.org/ to fund the accounts
and explore your transactions.

If you're already funded, please ignore this message.
=======================================================================
`)

  try {
    // Check if accounts are funded unless skipped
    if (!options.skipFunding && !options.forceContinue) {
      const authorityFunded = await checkAccountFunding(authorityKeypair.publicKey())
      const recipientFunded = await checkAccountFunding(recipientKeypair.publicKey())

      if (!authorityFunded || !recipientFunded) {
        console.error(`
    Test cannot continue with unfunded accounts.
    Please fund the accounts first, or use the --force-continue flag to bypass this check.
            `)
        process.exit(1)
      }
    }

    const client = new StellarAttestProtocol({
      secretKeyOrCustomSigner: authorityKeypair.secret(), // or wallet Kit here
      publicKey: authorityKeypair.publicKey(),
    })
    
    await client.initialize();

    console.log('SDK initialized')

    console.log('\nCreating schema...')
    const { data: schema, error: schemaError } = await client.createSchema({
      name: 'test-schema',
      content: 'TestSchema(Name=string, Age=u32)',
      revocable: true,
    })

    console.log(schema, schemaError)

    if (schemaError || !schema) {
      throw new Error(schemaError || 'Cannot continue without a valid schema')
    }

    console.log('Schema created with UID:', schema)

    const reference = `sample_reference_${Date.now()}`

    const attestData = {
      schemaUid: schema.uid,
      subject: recipientKeypair.publicKey(),
      data: JSON.stringify({
        Name: 'Chill Guy',
        Age: 50,
      }),
      reference,
    }

    // Step 6: Create attestation
    console.log('\nCreating attestation...')

    const { data: attestation, error: attestationError } =
      await client.issueAttestation(attestData)

    console.log(attestation, attestationError)

    if (attestationError || !attestation) {
      console.error(`Failed to create attestation: ${attestationError}`)
    }
    console.log('Attestation created with ID:', attestation)

    // Step 7: Fetch the created attestation
    console.log('Fetching attestation...')
    // try {
    //   const { data: fetchedAttestation, error: fetchError } =
    //     await client.fetchAttestationById(attestData)

    //   if (fetchError) {
    //     console.warn('Warning: Could not fetch attestation:', fetchError)
    //     console.log('Continuing with test...')
    //   } else {
    //     console.log('Fetched attestation:', fetchedAttestation)
    //   }
    // } catch (error) {
    //   console.warn('Error fetching attestation:', error)
    //   console.log('Continuing with test...')
    // }

    // Step 8: Revoke the attestation
    console.log('\nRevoking attestation...')
    // try {
    //   const { data: revokedAttestation, error: revokeError } =
    //     await client.revokeAttestation(attestData)

    //   if (revokeError || !revokedAttestation) {
    //     throw new Error(`Failed to revoke attestation: ${revokeError}`)
    //   }

    //   console.log('Attestation revoked with ID:', revokedAttestation)
    // } catch (error) {
    //   console.error('Error during revocation process:', error)
    //   throw error
    // }

    console.log('\nTest completed successfully')
  } catch (error) {
    console.error('Test error:', JSON.stringify(error, null, 2))
    process.exit(1)
  }
}

// Helper function to check if account is funded before proceeding
async function checkAccountFunding(publicKey: string): Promise<boolean> {
  try {
    const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${publicKey}`)

    const accountResponse = await res.json()
    // Check if the account has a minimum balance
    const balances = (accountResponse as any).balances || []
    const nativeBalance = balances.find((balance: any) => balance.asset_type === 'native')

    if (!nativeBalance || parseFloat(nativeBalance.balance) < 5) {
      console.error(`
ERROR: Account ${publicKey} has insufficient funds (${nativeBalance?.balance || '0'} XLM).
Please fund this account with XLM before proceeding.
You can visit: https://friendbot.stellar.org/?addr=${publicKey}
      `)
      return false
    }

    console.log(`Account ${publicKey} is funded with ${nativeBalance.balance} XLM`)
    return true
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      console.error(`
ERROR: Account ${publicKey} does not exist on the Stellar network.
Please create and fund this account before proceeding.
You can visit: https://friendbot.stellar.org/?addr=${publicKey}
      `)
    } else {
      console.error('Error checking account status:', error.message || error)
    }
    return false
  }
}

// Add ability to check for command line flags
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    skipFunding: args.includes('--skip-funding'),
    useTestnet: args.includes('--testnet'),
    forceContinue: args.includes('--force-continue'),
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
run(options)
