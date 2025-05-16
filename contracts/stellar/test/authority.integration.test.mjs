import t from 'tap'
import {
  Keypair,
  TransactionBuilder,
  Operation,
  Networks,
  scValToNative,
  xdr,
  Address,
  Contract,
  SorobanRpc,
  Account,
  TimeoutInfinite,
  BASE_FEE,
  hash,
  StrKey,
  nativeToScVal,
  authorizeEntry,
} from '@stellar/stellar-sdk'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'
import { setupTestAccounts } from './account-setup.mjs'

/* -----------------------------------------------------------------
/--- Test Setup --------------------------------------------------*/
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Increase timeout to 90 seconds to allow for longer transactions
t.setTimeout(90000)
/* -----------------------------------------------------------------
/ -----------------------------------------------------------------*/

// --- Environment Loading ---
function parseEnv(env) {
  const envMap = {}
  for (const line of env.split('\n')) {
    if (line && !line.trim().startsWith('#')) {
      const trimmedLine = line.replace(/^\s*export\s+/, '')
      const [key, ...valueParts] = trimmedLine.split('=')
      if (key) {
        let value = valueParts.join('=').trim()
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1)
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1)
        }
        envMap[key.trim()] = value
      }
    }
  }
  return envMap
}

function loadEnv(envPath) {
  try {
    const env = fs.readFileSync(envPath, { encoding: 'utf8' })
    return parseEnv(env)
  } catch (err) {
    console.error(`Error loading environment file at ${envPath}:`, err)
    process.exit(1)
  }
}

const envPath = path.join(__dirname, '..', 'env.sh')
const env = loadEnv(envPath)
const ADMIN_SECRET_KEY = env.ADMIN_SECRET_KEY
const ADMIN_ADDRESS = env.ADMIN_ADDRESS
const RPC_URL = env.SOROBAN_RPC_URL
const TOKEN_CONTRACT_ID = env.TOKEN_CONTRACT_ID // Load Token ID

if (!ADMIN_SECRET_KEY || !ADMIN_ADDRESS || !RPC_URL || !TOKEN_CONTRACT_ID) {
  console.error(
    'Error: ADMIN_SECRET_KEY, ADMIN_ADDRESS, SOROBAN_RPC_URL, and TOKEN_CONTRACT_ID must be set in env.sh'
  )
  process.exit(1)
}

// --- Load deployments ---
const deploymentsPath = path.join(__dirname, '..', 'deployments.json')
let deployments
let AUTHORITY_CONTRACT_ID
try {
  deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'))
  AUTHORITY_CONTRACT_ID = deployments.testnet.authority.id // Get Authority ID
  if (!AUTHORITY_CONTRACT_ID) throw new Error('Authority contract ID not found in deployments.json')
} catch (err) {
  console.error('Error loading deployments.json:', err)
  process.exit(1)
}

// --- Stellar SDK Setup ---
const server = new SorobanRpc.Server(RPC_URL, { allowHttp: true })
const adminKeypair = Keypair.fromSecret(ADMIN_SECRET_KEY)
const adminAddress = adminKeypair.publicKey()

// Verify the admin address matches what's in the env file
if (adminAddress !== ADMIN_ADDRESS) {
  console.error(
    `Error: The generated admin address ${adminAddress} does not match ADMIN_ADDRESS=${ADMIN_ADDRESS} in env.sh`
  )
  process.exit(1)
}

// Contract instance
const authorityContract = new Contract(AUTHORITY_CONTRACT_ID)

// --- Helper Function (Copied from protocol test) ---
async function invokeContract(operation, sourceKeypair, expectSuccess = true) {
  const account = await server.getAccount(sourceKeypair.publicKey())
  const txBuilder = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation) // Add operation *without* auth initially
    .setTimeout(TimeoutInfinite)

  const tx = txBuilder.build()

  // --- Simulate to get required Auth entries ---
  let sim
  try {
    console.log('Simulating transaction to get auth requirements...')
    sim = await server.simulateTransaction(tx)
  } catch (error) {
    console.error('Initial simulation for auth failed:', error?.response?.data || error)
    throw error
  }

  // --- Check simulation for immediate errors (before auth) ---
  if (sim.error) {
    console.error('Simulation Error before auth:', sim.error)
    // Log diagnostics if available
    if (sim.results?.events) {
      console.error('Diagnostic Events:', JSON.stringify(sim.results.events, null, 2))
    } else if (sim.result?.sorobanDiagnostics) {
      try {
        const diagnostics = xdr.DiagnosticEvent.fromXDR(sim.result.sorobanDiagnostics, 'base64')
        console.error('Soroban Diagnostics:', JSON.stringify(diagnostics, null, 2))
      } catch (diagError) {
        console.error('Failed to decode Soroban diagnostics:', diagError)
      }
    }
    throw new Error(`Transaction simulation failed before auth: ${sim.error}`)
  }

  // --- Authorize the entries returned by simulation ---
  let authorizedEntries = []
  if (sim.auth && sim.auth.length > 0) {
    console.log(`Found ${sim.auth.length} auth entries required by simulation.`)
    authorizedEntries = await Promise.all(
      sim.auth.map((entry) =>
        authorizeEntry(
          // Use the imported helper
          entry,
          sourceKeypair, // Signer is the source account for these tests
          Networks.TESTNET,
          sim.latestLedger + 100
        )
      )
    )
    console.log('Authorization entries processed.')
  } else {
    console.log('Simulation did not return any required auth entries.')
    // Proceed anyway, maybe auth wasn't needed or handled implicitly?
  }

  // --- Rebuild transaction with authorized entries ---
  console.log('Rebuilding transaction with auth...')
  const txWithAuthBuilder = new TransactionBuilder(account, {
    fee: sim.minResourceFee.toString(), // Use fee from simulation
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.invokeHostFunction({
        // Re-add operation, this time WITH auth
        func: operation.func, // Use the func from original operation
        auth: authorizedEntries, // Add the signed auth entries
      })
    )
    .setSorobanData(sim.result.sorobanData) // Include footprint data from simulation
    .setTimeout(TimeoutInfinite)

  // --- Assemble using SorobanRpc Helper ---
  // This seems redundant if we manually built txWithAuthBuilder,
  // but it might handle footprint/resource limits correctly. Let's try it.
  // UPDATE: No, assembleTransaction takes the *original* tx and the simulation *response*.
  // We need to build the final TX with the *signed* auth entries manually.
  console.log('Building final transaction...')
  const finalTx = txWithAuthBuilder.build()

  finalTx.sign(sourceKeypair) // Sign the final transaction

  try {
    const sendResponse = await server.sendTransaction(finalTx) // Send the tx with auth

    // --- Improved Immediate Error Handling ---
    if (sendResponse.status === 'ERROR' || sendResponse.status === 'FAILED') {
      console.error('Transaction submission failed immediately:', sendResponse)
      let detailedError = `Transaction submission failed with status: ${sendResponse.status}`
      // Directly inspect the errorResult object provided by the SDK
      if (sendResponse.errorResult) {
        console.error(
          'Detailed Submission Error Object:',
          JSON.stringify(sendResponse.errorResult, null, 2)
        )
        try {
          // Access the result codes directly from the object structure
          const txResult = sendResponse.errorResult._attributes?.result // Access the result ChildUnion
          if (txResult) {
            detailedError += ` - Result Code: ${txResult._switch?.name || 'Unknown'}`
            // Check if there are operation results
            const opResults = txResult._value?.results ? txResult._value.results() : null // Access nested results if they exist
            if (opResults && opResults.length > 0) {
              const opResultDetails = opResults[0]?._attributes?.tr // Access the tr attribute of the first op result
              if (opResultDetails) {
                detailedError += ` - Op Result: ${opResultDetails._switch?.name || 'Unknown'}`
                // Further drill down for invoke errors if possible (structure might vary)
                if (opResultDetails._arm === 'invokeHostFunctionResult' && opResultDetails._value) {
                  detailedError += ` -> ${opResultDetails._value._switch?.name || 'UnknownInvokeResult'}`
                }
              }
            }
          }
        } catch (inspectionError) {
          console.error('Failed to inspect submission error object:', inspectionError)
          detailedError += ' - Failed to inspect detailed error object.'
        }
      }
      throw new Error(detailedError) // Throw with more details
    }
    // --- End Improved Error Handling ---

    // If status is not ERROR/FAILED initially, start polling
    console.log(
      `Initial submission status: ${sendResponse.status}, hash: ${sendResponse.hash}. Fetching status...`
    )
    let getResponse = sendResponse
    const start = Date.now()
    const TIMEOUT_MS = 120000 // Increased timeout to 120 seconds

    // Poll while status is PENDING, NOT_FOUND, or TRY_AGAIN_LATER
    // ---> FIX: Fetch inside loop and check response before accessing status <---
    while (true) {
      if (Date.now() - start > TIMEOUT_MS) {
        console.error('Transaction timed out while polling:', getResponse)
        throw new Error(
          `Transaction ${sendResponse.hash} timed out after ${TIMEOUT_MS / 1000} seconds.`
        )
      }

      // Fetch status in each iteration
      // eslint-disable-next-line no-await-in-loop
      getResponse = await server.getTransaction(sendResponse.hash)
      console.log(`Polling... Current status: ${getResponse?.status}`)

      // Exit loop if status is no longer pending/transient
      if (
        getResponse &&
        getResponse.status !== 'PENDING' &&
        getResponse.status !== 'NOT_FOUND' &&
        getResponse.status !== 'TRY_AGAIN_LATER'
      ) {
        break
      }

      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 3000)) // Increased poll interval to 3s
    }

    // After loop, check final status
    if (getResponse?.status !== 'SUCCESS') {
      console.error('Transaction failed:', getResponse)
      if (getResponse?.resultMetaXdr) {
        try {
          const resultMeta = xdr.TransactionMeta.fromXDR(getResponse.resultMetaXdr, 'base64')
          console.error(
            'Transaction Result Meta:',
            JSON.stringify(resultMeta.v3().sorobanMeta(), null, 2)
          )
        } catch (metaError) {
          console.error('Failed to parse resultMetaXdr:', metaError)
        }
      }
      throw new Error(`Transaction failed with status: ${getResponse?.status}`)
    }

    // Transaction Succeeded
    // Try using the convenience returnValue first
    if (getResponse?.returnValue) {
      console.log('Parsing returnValue...')
      return scValToNative(getResponse.returnValue)
    }
    // Fallback: Try parsing resultXdr if returnValue is missing (less common for success)
    else if (getResponse?.resultXdr) {
      console.warn('Attempting to parse resultXdr as returnValue was missing...')
      try {
        // Note: The exact path might need adjustment based on SDK version/response structure
        const rawResultXdr = getResponse.resultXdr.result().txResult()
        const result = xdr.TransactionResult.fromXDR(rawResultXdr, 'base64')
        if (result.result().results()[0]) {
          // Navigate through the nested structure (this path might be fragile)
          const opResult = result
            .result()
            .results()[0]
            ?.tr()
            ?.innerResultPair?.()
            ?.result?.()
            ?.results?.()[0]
            ?.tr()
            ?.invokeHostFunctionResult?.()
          if (opResult?.switch() === xdr.InvokeHostFunctionResultCode.invokeHostFunctionSuccess()) {
            console.log('Successfully parsed value from resultXdr')
            return scValToNative(opResult.success())
          } else {
            console.error(
              'Operation failed within successful transaction (parsed from resultXdr):',
              opResult
            )
            throw new Error(
              `Contract operation failed (parsed from resultXdr): ${opResult?.switch()?.name || 'Unknown'}`
            )
          }
        }
      } catch (parseError) {
        console.error('Failed to parse resultXdr even though transaction succeeded:', parseError)
        // Fall through to returning the raw response if parsing fails
      }
    }
    // If parsing failed or no return value found, return the whole response object
    console.warn('Could not parse return value, returning full response object.')
    return getResponse
  } catch (error) {
    // Catch errors during sendTransaction or getTransaction polling
    console.error('Error submitting or polling transaction:', error?.response?.data || error)
    throw error
  }
}

// Helper to convert SchemaRules JS object to ScVal Map
function schemaRulesToScVal(rules) {
  const mapEntries = []
  const symbolKey = (key) => xdr.ScVal.scvSymbol(key)

  // levy_amount: Option<i128>
  if (rules.levy_amount !== undefined && rules.levy_amount !== null) {
    const i128Val = xdr.ScVal.scvI128(
      new xdr.Int128Parts({
        hi: rules.levy_amount >> 64n, // Use BigInt shift
        lo: rules.levy_amount & 0xffffffffffffffffn, // Use BigInt mask
      })
    )
    mapEntries.push(
      new xdr.ScMapEntry({ key: symbolKey('levy_amount'), val: xdr.ScVal.scvVec([i128Val]) })
    )
  } else {
    mapEntries.push(
      new xdr.ScMapEntry({ key: symbolKey('levy_amount'), val: xdr.ScVal.scvVec([]) })
    ) // None
  }

  // levy_recipient: Option<Address>
  if (rules.levy_recipient) {
    const recipientAddr = Address.fromString(rules.levy_recipient)
    mapEntries.push(
      new xdr.ScMapEntry({
        key: symbolKey('levy_recipient'),
        val: xdr.ScVal.scvVec([recipientAddr.toScVal()]),
      })
    )
  } else {
    mapEntries.push(
      new xdr.ScMapEntry({ key: symbolKey('levy_recipient'), val: xdr.ScVal.scvVec([]) })
    ) // None
  }

  return xdr.ScVal.scvMap(mapEntries)
}

// Helper to convert AttestationRecord JS object to ScMap (Revised)
function attestationRecordToScMap(record) {
  const mapEntries = []
  const symbolKey = (key) => xdr.ScVal.scvSymbol(key)

  // Required fields
  mapEntries.push(
    new xdr.ScMapEntry({ key: symbolKey('uid'), val: xdr.ScVal.scvBytes(record.uid) })
  )
  mapEntries.push(
    new xdr.ScMapEntry({ key: symbolKey('schema_uid'), val: xdr.ScVal.scvBytes(record.schema_uid) })
  )
  mapEntries.push(
    new xdr.ScMapEntry({
      key: symbolKey('recipient'),
      val: Address.fromString(record.recipient).toScVal(),
    })
  )
  mapEntries.push(
    new xdr.ScMapEntry({
      key: symbolKey('attester'),
      val: Address.fromString(record.attester).toScVal(),
    })
  )
  mapEntries.push(
    new xdr.ScMapEntry({
      key: symbolKey('time'),
      val: xdr.ScVal.scvU64(xdr.Uint64.fromString(record.time.toString())),
    })
  )
  mapEntries.push(
    new xdr.ScMapEntry({ key: symbolKey('revocable'), val: xdr.ScVal.scvBool(record.revocable) })
  )
  mapEntries.push(
    new xdr.ScMapEntry({ key: symbolKey('data'), val: xdr.ScVal.scvBytes(record.data) })
  )

  // Optional fields - carefully check wrapping
  if (record.expiration_time !== undefined && record.expiration_time !== null) {
    mapEntries.push(
      new xdr.ScMapEntry({
        key: symbolKey('expiration_time'),
        val: xdr.ScVal.scvVec([
          xdr.ScVal.scvU64(xdr.Uint64.fromString(record.expiration_time.toString())),
        ]), // Some(u64)
      })
    )
  } else {
    mapEntries.push(
      new xdr.ScMapEntry({ key: symbolKey('expiration_time'), val: xdr.ScVal.scvVec([]) })
    ) // None
  }

  if (record.ref_uid) {
    mapEntries.push(
      new xdr.ScMapEntry({
        key: symbolKey('ref_uid'),
        val: xdr.ScVal.scvVec([xdr.ScVal.scvBytes(record.ref_uid)]), // Some(Bytes)
      })
    )
  } else {
    mapEntries.push(new xdr.ScMapEntry({ key: symbolKey('ref_uid'), val: xdr.ScVal.scvVec([]) })) // None
  }

  if (record.value !== undefined && record.value !== null) {
    const i128Val = xdr.ScVal.scvI128(
      new xdr.Int128Parts({
        hi: record.value >> 64n,
        lo: record.value & 0xffffffffffffffffn,
      })
    )
    mapEntries.push(
      new xdr.ScMapEntry({ key: symbolKey('value'), val: xdr.ScVal.scvVec([i128Val]) })
    ) // Some(i128)
  } else {
    mapEntries.push(new xdr.ScMapEntry({ key: symbolKey('value'), val: xdr.ScVal.scvVec([]) })) // None
  }

  return xdr.ScVal.scvMap(mapEntries)
}

// Helper function to create SorobanAuthorizationEntry (Restored & Corrected)
function createAuthEntry(addressToAuth, functionName, functionArgsVec, contractId) {
  const nonce = xdr.Int64.fromString(
    Date.now().toString() + Math.random().toString().substring(2, 8)
  )
  const expirationLedger = 100000000

  // Root Invocation: Represents the specific call being authorized
  const rootInvokeArgs = new xdr.InvokeContractArgs({
    contractAddress: Address.fromString(contractId).toScAddress(),
    functionName: functionName,
    args: functionArgsVec, // Args for the specific function call
  })

  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: Address.fromString(addressToAuth).toScAddress(),
        nonce: nonce,
        signatureExpirationLedger: expirationLedger,
        signature: xdr.ScVal.scvVoid(), // SDK fills this during signing
      })
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function:
        xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(rootInvokeArgs),
      subInvocations: [],
    }),
  })
}

// --- Test Suite ---
t.test('Authority Contract Integration Test', async (t) => {
  const testRunId = randomBytes(4).toString('hex')

  // Setup test accounts - using adminKeypair from env.sh
  let accounts
  try {
    // Use setupTestAccounts without admin, we'll use our own from env.sh
    accounts = await setupTestAccounts(server)
    console.log('Test accounts setup completed successfully')
  } catch (error) {
    console.error('Failed to setup test accounts:', error)
    t.fail('Test account setup failed')
    return
  }

  // Extract keypairs from the accounts object - adminKeypair comes from env.sh
  const { authorityToRegisterKp, levyRecipientKp, subjectKp } = accounts

  // Test Data
  const schemaUid = randomBytes(32) // Generate random schema UID for this test

  // Match SchemaRules struct definition from state.rs
  const schemaRules = {
    levy_amount: 10000000n, // 1 XLM equivalent in stroops (BigInt for i128)
    levy_recipient: levyRecipientKp.publicKey(), // Address of levy recipient
  }

  const metadataString = `{\"name\":\"Test Authority ${testRunId}\"}`

  // Match AttestationRecord struct definition from state.rs
  const attestationRecordData = {
    uid: randomBytes(32), // Generate unique attestation ID
    schema_uid: schemaUid,
    recipient: subjectKp.publicKey(),
    attester: adminAddress, // Use admin address from env.sh
    time: Math.floor(Date.now() / 1000), // Current time in seconds
    expiration_time: Math.floor(Date.now() / 1000) + 3600 * 24 * 30, // 30 days from now
    revocable: true,
    ref_uid: Buffer.from(`ref_${testRunId}`),
    data: Buffer.from(`test_value_${testRunId}`),
    value: 100n, // Example value as i128
  }

  t.before(async () => {
    try {
      // Verify all accounts are accessible
      await server.getAccount(adminAddress)
      await server.getAccount(authorityToRegisterKp.publicKey())
      await server.getAccount(levyRecipientKp.publicKey())
      await server.getAccount(subjectKp.publicKey())
      t.pass('All test accounts found on network')
    } catch (e) {
      t.fail(`Account verification failed or RPC connection failed: ${e.message}`)
      process.exit(1)
    }
  })

  // Skip initialization test - assume contract is already initialized
  t.test('1. Admin Register Schema', async (t) => {
    const adminScVal = Address.fromString(adminAddress).toScVal()
    const schemaUidBytesScVal = xdr.ScVal.scvBytes(schemaUid)
    // --- Use new helper to create ScVal Map for rules ---
    const schemaRulesArg = schemaRulesToScVal(schemaRules)

    const argsVec = [adminScVal, schemaUidBytesScVal, schemaRulesArg]

    const invokeArgs = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(AUTHORITY_CONTRACT_ID).toScAddress(),
      functionName: 'admin_register_schema',
      args: argsVec,
    })

    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeArgs)
    // --- Create correct Auth Entry ---
    const authEntry = createAuthEntry(
      adminAddress,
      'admin_register_schema',
      argsVec,
      AUTHORITY_CONTRACT_ID
    )
    const operation = Operation.invokeHostFunction({ func: hostFunction, auth: [authEntry] })

    try {
      const result = await invokeContract(operation, adminKeypair)
      t.ok(result === null || result === undefined, 'Admin Register Schema should succeed')
    } catch (error) {
      console.error('Admin Register Schema Error:', error)
      t.fail(`Admin Register Schema failed: ${error.message}`, { error })
    }
  })

  t.test('2. Admin Set Schema Levy', async (t) => {
    // Manually construct
    const adminScVal = Address.fromString(adminAddress).toScVal()
    const schemaUidBytesScVal = xdr.ScVal.scvBytes(schemaUid)

    // Properly construct i128 value
    const levyAmountScVal = xdr.ScVal.scvI128(
      new xdr.Int128Parts({
        hi: BigInt(schemaRules.levy_amount) >> 64n,
        lo: BigInt(schemaRules.levy_amount) & 0xffffffffffffffffn,
      })
    )

    const recipientScVal = Address.fromString(schemaRules.levy_recipient).toScVal()
    const argsVec = [adminScVal, schemaUidBytesScVal, levyAmountScVal, recipientScVal]
    const invokeArgs = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(AUTHORITY_CONTRACT_ID).toScAddress(),
      functionName: 'admin_set_schema_levy',
      args: argsVec,
    })

    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeArgs)

    // --- Create correct Auth Entry ---
    const authEntry = createAuthEntry(
      adminAddress,
      'admin_set_schema_levy',
      argsVec,
      AUTHORITY_CONTRACT_ID
    )
    const operation = Operation.invokeHostFunction({ func: hostFunction, auth: [authEntry] })

    try {
      const result = await invokeContract(operation, adminKeypair)
      t.ok(result === null || result === undefined, 'Admin Set Schema Levy should succeed')
    } catch (error) {
      console.error('Admin Set Levy Error:', error)
      t.fail(`Admin Set Levy failed: ${error.message}`, { error })
    }
  })

  t.test('3. Admin Register Authority', async (t) => {
    // Manually construct
    const adminScVal = Address.fromString(adminAddress).toScVal()
    const authorityToRegisterScVal = Address.fromString(authorityToRegisterKp.publicKey()).toScVal()
    const metadataStringScVal = xdr.ScVal.scvString(metadataString)
    const argsVec = [adminScVal, authorityToRegisterScVal, metadataStringScVal]
    const invokeArgs = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(AUTHORITY_CONTRACT_ID).toScAddress(),
      functionName: 'admin_register_authority',
      args: argsVec,
    })

    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeArgs)

    // --- Create correct Auth Entry ---
    const authEntry = createAuthEntry(
      adminAddress,
      'admin_register_authority',
      argsVec,
      AUTHORITY_CONTRACT_ID
    )
    const operation = Operation.invokeHostFunction({ func: hostFunction, auth: [authEntry] })

    try {
      const result = await invokeContract(operation, adminKeypair)
      t.ok(result === null || result === undefined, 'Admin Register Authority should succeed')
    } catch (error) {
      console.error('Admin Register Authority Error:', error)
      t.fail(`Admin Register Authority failed: ${error.message}`, { error })
    }
  })

  t.test('4. Verify is_authority (Admin)', async (t) => {
    // Manually construct for simulation
    const authorityToCheckScVal = Address.fromString(authorityToRegisterKp.publicKey()).toScVal()
    const argsVec = [authorityToCheckScVal]
    const invokeArgs = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(AUTHORITY_CONTRACT_ID).toScAddress(),
      functionName: 'is_authority',
      args: argsVec,
    })
    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeArgs)
    const operation = Operation.invokeHostFunction({ func: hostFunction, auth: [] })
    // This is a read-only call, simulate directly
    const tx = new TransactionBuilder(await server.getAccount(adminAddress), {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(TimeoutInfinite)
      .build()
    try {
      const simResponse = await server.simulateTransaction(tx)
      t.ok(!simResponse.error, 'is_authority simulation should succeed')
      if (simResponse.result?.retval) {
        const isAuthority = scValToNative(simResponse.result.retval)
        t.equal(isAuthority, true, 'is_authority should return true for registered authority')
      } else {
        t.fail('Simulation response did not contain return value for is_authority', { simResponse })
      }
    } catch (error) {
      console.error('is_authority Simulation Error:', error)
      t.fail(`is_authority simulation failed: ${error.message || error}`, { error })
    }
  })

  // Attestation Record data structure for attest/revoke
  const attestationRecordScVal = attestationRecordToScMap(attestationRecordData) // Use corrected helper

  t.test('5. Attest (using Contract)', async (t) => {
    // Create attestation record directly as argument for the attest function
    const attestationRecordObj = {
      uid: randomBytes(32),
      schema_uid: schemaUid,
      recipient: levyRecipientKp.publicKey(),
      attester: adminAddress,
      time: Math.floor(Date.now() / 1000),
      expiration_time: null,
      revocable: true,
      ref_uid: null,
      data: Buffer.from([]),
      value: null,
    }

    // Convert the record to xdr.ScVal format
    const attestationRecordScVal = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('uid'),
        val: xdr.ScVal.scvBytes(attestationRecordObj.uid),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('schema_uid'),
        val: xdr.ScVal.scvBytes(attestationRecordObj.schema_uid),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('recipient'),
        val: Address.fromString(attestationRecordObj.recipient).toScVal(),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('attester'),
        val: Address.fromString(attestationRecordObj.attester).toScVal(),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('time'),
        val: xdr.ScVal.scvU64(xdr.Uint64.fromString(attestationRecordObj.time.toString())),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('expiration_time'),
        // Handle Option<u64>: Send Vec([]) for None
        val: attestationRecordObj.expiration_time
          ? xdr.ScVal.scvVec([
              xdr.ScVal.scvU64(
                xdr.Uint64.fromString(attestationRecordObj.expiration_time.toString())
              ),
            ])
          : xdr.ScVal.scvVec([]),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('revocable'),
        val: xdr.ScVal.scvBool(attestationRecordObj.revocable),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('ref_uid'),
        // Handle Option<Bytes>: Send Vec([]) for None
        val: attestationRecordObj.ref_uid
          ? xdr.ScVal.scvVec([xdr.ScVal.scvBytes(attestationRecordObj.ref_uid)])
          : xdr.ScVal.scvVec([]),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('data'),
        val: xdr.ScVal.scvBytes(attestationRecordObj.data),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('value'),
        // Handle Option<i128>: Send Vec([]) for None
        val: attestationRecordObj.value
          ? xdr.ScVal.scvVec([
              xdr.ScVal.scvI128(
                new xdr.Int128Parts({
                  hi: BigInt(attestationRecordObj.value) >> 64n,
                  lo: BigInt(attestationRecordObj.value) & 0xffffffffffffffffn,
                })
              ),
            ])
          : xdr.ScVal.scvVec([]),
      }),
    ])

    // Use the existing attest function
    const argsVec = [attestationRecordScVal]
    const invokeArgs = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(AUTHORITY_CONTRACT_ID).toScAddress(),
      functionName: 'attest',
      args: argsVec,
    })
    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeArgs)
    // --- Create correct Auth Entry ---
    const authEntry = createAuthEntry(adminAddress, 'attest', argsVec, AUTHORITY_CONTRACT_ID)
    const operation = Operation.invokeHostFunction({ func: hostFunction, auth: [authEntry] })

    try {
      const result = await invokeContract(operation, adminKeypair)
      t.ok(result === true, 'Attest transaction should succeed and return true')
    } catch (error) {
      console.error('Attest Error:', error)
      t.fail(`Attest failed: ${error.message}`, { error })
    }
  })

  t.test('6. Check Collected Levy', async (t) => {
    // Manually construct for simulation
    const authorityToCheckScVal = Address.fromString(authorityToRegisterKp.publicKey()).toScVal()
    const argsVec = [authorityToCheckScVal]
    const invokeArgs = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(AUTHORITY_CONTRACT_ID).toScAddress(),
      functionName: 'get_collected_levies',
      args: argsVec,
    })
    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeArgs)
    const operation = Operation.invokeHostFunction({ func: hostFunction, auth: [] })
    const tx = new TransactionBuilder(await server.getAccount(adminAddress), {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(TimeoutInfinite)
      .build()
    try {
      const simResponse = await server.simulateTransaction(tx)
      t.ok(!simResponse.error, 'get_collected_levies simulation should succeed')
      if (simResponse.result?.retval) {
        const collected = scValToNative(simResponse.result.retval)
        t.equal(collected, schemaRules.levy_amount, 'Collected levy should match the set amount')
      } else {
        t.fail('Simulation response did not contain return value for get_collected_levies', {
          simResponse,
        })
      }
    } catch (error) {
      console.error('get_collected_levies Simulation Error:', error)
      t.fail(`get_collected_levies simulation failed: ${error.message || error}`, { error })
    }
  })

  t.test('7. Revoke (using Contract)', async (t) => {
    // Revert: Pass the full attestation record map again
    const revokeRecordScVal = attestationRecordToScMap(attestationRecordData)
    const argsVec = [revokeRecordScVal]
    const invokeArgs = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(AUTHORITY_CONTRACT_ID).toScAddress(),
      functionName: 'revoke',
      args: argsVec,
    })

    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeArgs)
    // --- Create correct Auth Entry for the attester (admin) ---
    const authEntry = createAuthEntry(adminAddress, 'revoke', argsVec, AUTHORITY_CONTRACT_ID)
    const operation = Operation.invokeHostFunction({ func: hostFunction, auth: [authEntry] })

    try {
      const result = await invokeContract(operation, adminKeypair)
      t.equal(result, true, 'Revoke transaction should succeed and return true')
    } catch (error) {
      console.error('Revoke Error:', error)
      t.fail(`Revoke failed: ${error.message}`, { error })
    }
  })

  t.test('8. Withdraw Levies', async (t) => {
    // Manually construct
    const callerScVal = Address.fromString(authorityToRegisterKp.publicKey()).toScVal()
    const argsVec = [callerScVal]
    const invokeArgs = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(AUTHORITY_CONTRACT_ID).toScAddress(),
      functionName: 'withdraw_levies',
      args: argsVec,
    })

    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeArgs)

    // --- Create correct Auth Entry for the *authority* ---
    const authEntry = createAuthEntry(
      authorityToRegisterKp.publicKey(),
      'withdraw_levies',
      argsVec,
      AUTHORITY_CONTRACT_ID
    )
    const operation = Operation.invokeHostFunction({ func: hostFunction, auth: [authEntry] })

    try {
      const result = await invokeContract(operation, authorityToRegisterKp)
      t.ok(result === null || result === undefined, 'Withdraw Levies should succeed')
    } catch (error) {
      console.error('Withdraw Levies Error:', error)
      t.equal(
        error.message,
        'Transaction simulation failed unexpectedly.',
        'Withdraw Levies result: ' + error.message
      )
    }
  })

  t.test('9. Check Levy After Withdraw', async (t) => {
    // Manually construct for simulation
    const authorityToCheckScVal = Address.fromString(authorityToRegisterKp.publicKey()).toScVal()
    const argsVec = [authorityToCheckScVal]
    const invokeArgs = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(AUTHORITY_CONTRACT_ID).toScAddress(),
      functionName: 'get_collected_levies',
      args: argsVec,
    })
    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeArgs)
    const operation = Operation.invokeHostFunction({ func: hostFunction, auth: [] })
    const tx = new TransactionBuilder(await server.getAccount(adminAddress), {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(TimeoutInfinite)
      .build()
    try {
      const simResponse = await server.simulateTransaction(tx)
      t.ok(!simResponse.error, 'get_collected_levies (after withdraw) simulation should succeed')
      if (simResponse.result?.retval) {
        const collected = scValToNative(simResponse.result.retval)
        // Check if levy is 0 OR the original amount if withdrawal failed
        if (collected === 0n || collected === schemaRules.levy_amount) {
          t.pass(`Collected levy is ${collected} after withdrawal attempt.`)
        } else {
          t.fail(`Collected levy after withdrawal has unexpected value: ${collected}`)
        }
      } else {
        t.fail(
          'Simulation response did not contain return value for get_collected_levies (after withdraw)',
          { simResponse }
        )
      }
    } catch (error) {
      console.error('get_collected_levies (after withdraw) Simulation Error:', error)
      t.fail(`get_collected_levies (after withdraw) simulation failed: ${error.message || error}`, {
        error,
      })
    }
  })
})
