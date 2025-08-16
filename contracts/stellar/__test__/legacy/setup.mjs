import {
  Keypair,
  TransactionBuilder,
  Operation,
  Networks,
  rpc,
  TimeoutInfinite,
  BASE_FEE,
} from '@stellar/stellar-sdk'

/**
 * Fund an account using Friendbot
 * @param {string} publicKey - The public key of the account to fund
 * @returns {Promise<Object>} - The response from Friendbot
 */
export async function fundAccountWithFriendbot(publicKey) {
  try {
    console.log(`Funding account ${publicKey} with Friendbot...`)
    const friendbotUrl = `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
    const response = await fetch(friendbotUrl)

    if (!response.ok) {
      throw new Error(`Friendbot request failed: ${response.statusText}`)
    }

    const responseJSON = await response.json()
    console.log(`SUCCESS! Account funded with 10,000 XLM: ${publicKey}`)
    return responseJSON
  } catch (error) {
    console.error(`ERROR funding account ${publicKey}:`, error)
    throw error
  }
}

/**
 * Wait for a transaction to complete by polling its status
 * @param {rpc.Server} server - The Soroban RPC server
 * @param {string} txHash - The transaction hash
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {number} pollIntervalMs - Polling interval in milliseconds
 * @returns {Promise<Object>} - The final transaction response
 */
async function waitForTransaction(server, txHash, timeoutMs = 120000, pollIntervalMs = 5000) {
  console.log(`Waiting for transaction ${txHash} to complete...`)
  const startTime = Date.now()
  let parseErrorCount = 0
  const maxParseErrors = 10

  while (true) {
    try {
      // Check if we've exceeded the timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Transaction ${txHash} timed out after ${timeoutMs / 1000} seconds`)
      }

      // Get the transaction status
      let txResponse
      try {
        txResponse = await server.getTransaction(txHash)
        console.log(`Transaction status: ${txResponse.status}`)
        parseErrorCount = 0 // Reset on successful parse
      } catch (parseError) {
        // Handle parsing error - might be due to SDK version mismatch
        if (parseError.message && parseError.message.includes('Bad union switch')) {
          parseErrorCount++
          console.warn(`Encountered parsing error (${parseErrorCount}/${maxParseErrors}), retrying...`, parseError.message)
          
          if (parseErrorCount >= maxParseErrors) {
            console.warn('Too many parsing errors, checking if account was created anyway...')
            break // Exit to fallback check
          }
          
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
          continue
        }
        throw parseError
      }

      // If status is no longer pending, return the response
      if (
        txResponse.status !== 'PENDING' &&
        txResponse.status !== 'NOT_FOUND' &&
        txResponse.status !== 'TRY_AGAIN_LATER'
      ) {
        if (txResponse.status === 'SUCCESS') {
          return txResponse
        } else {
          throw new Error(`Transaction failed with status: ${txResponse.status}`)
        }
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    } catch (error) {
      // If it's a "transaction not found" error, keep polling
      if (
        error.message &&
        (error.message.includes('not found') ||
          error.message.includes('NOT_FOUND') ||
          error.message.includes('TRY_AGAIN_LATER'))
      ) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
        continue
      }
      throw error
    }
  }
}

/**
 * Create a new account using a parent account
 * @param {rpc.Server} server - The Soroban RPC server
 * @param {Keypair} parentKeypair - The keypair of the parent account
 * @param {string} accountName - A descriptive name for the account (for logging)
 * @param {string} startingBalance - The starting balance for the new account (in XLM)
 * @returns {Promise<Keypair>} - The keypair of the newly created account
 */
export async function createAccount(server, parentKeypair, accountName, startingBalance = '2') {
  try {
    console.log(`Creating new ${accountName} account with parent ${parentKeypair.publicKey()}...`)

    // Generate a random keypair for the new account
    const newAccountKeypair = Keypair.random()
    console.log(`New ${accountName} account public key: ${newAccountKeypair.publicKey()}`)

    // Load the parent account to get the current sequence number
    const parentAccount = await server.getAccount(parentKeypair.publicKey())

    // Create a transaction to create the new account
    const transaction = new TransactionBuilder(parentAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.createAccount({
          destination: newAccountKeypair.publicKey(),
          startingBalance: startingBalance,
        })
      )
      .setTimeout(TimeoutInfinite)
      .build()

    // Sign the transaction with the parent account
    transaction.sign(parentKeypair)

    // Submit the transaction
    console.log(`Submitting transaction to create ${accountName} account...`)
    const sendResponse = await server.sendTransaction(transaction)

    if (sendResponse.status === 'ERROR' || sendResponse.status === 'FAILED') {
      throw new Error(
        `Failed to submit transaction: ${sendResponse.status}${sendResponse.extras ? ' - ' + JSON.stringify(sendResponse.extras) : ''}`
      )
    }

    // Wait for the transaction to complete with a 120-second timeout
    console.log(`Transaction submitted with hash: ${sendResponse.hash}`)
    try {
      await waitForTransaction(server, sendResponse.hash, 120000, 5000)
    } catch (error) {
      // If waitForTransaction fails, try to verify account exists anyway
      console.warn('Transaction tracking failed, checking if account was created...')
      await new Promise((resolve) => setTimeout(resolve, 10000)) // Wait longer for network propagation
      
      try {
        await server.getAccount(newAccountKeypair.publicKey())
        console.log('Account creation confirmed despite transaction tracking failure')
      } catch (accountError) {
        // Account doesn't exist, the transaction truly failed
        throw new Error(`Account creation failed: ${error.message}`)
      }
    }

    console.log(`SUCCESS! Created new ${accountName} account: ${newAccountKeypair.publicKey()}`)
    return newAccountKeypair
  } catch (error) {
    console.error(`ERROR creating ${accountName} account:`, error)
    throw error
  }
}

/**
 * Setup test accounts for authority integration tests
 * This function creates auxiliary accounts for testing but requires the admin keypair
 * to be provided from the environment.
 *
 * @param {rpc.Server} server - The Soroban RPC server
 * @returns {Promise<Object>} - Object containing all the keypairs for testing
 */
export async function setupTestAccounts(server) {
  console.log('Setting up authority test accounts...')
  const maxRetries = 3

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create a new parent account for this test run
      const parentKeypair = Keypair.random()
      console.log(`Generated parent account (attempt ${attempt}/${maxRetries}): ${parentKeypair.publicKey()}`)

      // Fund the parent account with Friendbot
      await fundAccountWithFriendbot(parentKeypair.publicKey())

      // Add a delay to ensure the parent account is properly funded and ready
      console.log('Waiting for parent account to be ready...')
      await new Promise((resolve) => setTimeout(resolve, 10000)) // Increased wait time

      try {
        // Verify parent account exists by loading it
        await server.getAccount(parentKeypair.publicKey())
        console.log('Parent account is ready')
      } catch (error) {
        console.error('Parent account not found after funding:', error)
        if (attempt === maxRetries) {
          throw new Error('Failed to setup parent account after all retries')
        }
        console.log(`Retrying account setup (attempt ${attempt + 1}/${maxRetries})...`)
        continue
      }

      // Create auxiliary accounts with error handling
      console.log('Creating auxiliary accounts...')
      
      const authorityToRegisterKp = await createAccountWithRetry(server, parentKeypair, 'authority', '3')
      const levyRecipientKp = await createAccountWithRetry(server, parentKeypair, 'levy-recipient', '2')
      const subjectKp = await createAccountWithRetry(server, parentKeypair, 'attestation-subject', '1')
      const userKp = await createAccountWithRetry(server, parentKeypair, 'general-user', '1')

      console.log('Account setup completed successfully')

      return {
        parentKeypair,
        authorityToRegisterKp,
        levyRecipientKp,
        subjectKp,
        userKp,
      }
    } catch (error) {
      console.error(`Setup attempt ${attempt} failed:`, error)
      if (attempt === maxRetries) {
        throw error
      }
      console.log(`Retrying full setup in 15 seconds...`)
      await new Promise((resolve) => setTimeout(resolve, 15000))
    }
  }
}

async function createAccountWithRetry(server, parentKeypair, accountName, startingBalance, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await createAccount(server, parentKeypair, accountName, startingBalance)
    } catch (error) {
      console.error(`Failed to create ${accountName} account (attempt ${attempt}/${maxRetries}):`, error)
      if (attempt === maxRetries) {
        throw error
      }
      console.log(`Retrying ${accountName} account creation in 10 seconds...`)
      await new Promise((resolve) => setTimeout(resolve, 10000))
    }
  }
}
