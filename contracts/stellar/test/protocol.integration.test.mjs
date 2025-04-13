import t from 'tap';
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
} from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

// --- Test Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Environment Loading ---
function parseEnv(env) {
  const envMap = {};
  for (const line of env.split('\n')) {
    // Skip comments and empty lines
    if (line && !line.trim().startsWith('#')) {
      // Remove potential 'export ' prefix
      const trimmedLine = line.replace(/^\s*export\s+/, '');
      const [key, ...valueParts] = trimmedLine.split('=');
      // Check if key exists after split
      if (key) {
        // Remove potential quotes around the value
        let value = valueParts.join('=').trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
           value = value.substring(1, value.length - 1);
        }
        envMap[key.trim()] = value;
      }
    }
  }
  return envMap;
}

function loadEnv(envPath) {
  try {
    const env = fs.readFileSync(envPath, { encoding: 'utf8' });
    return parseEnv(env);
  } catch (err) {
    console.error(`Error loading environment file at ${envPath}:`, err);
    process.exit(1); // Exit if env loading fails
  }
}

// Update the path to point to env.sh in the parent directory
const envPath = path.join(__dirname, '..', 'env.sh');
const env = loadEnv(envPath);
// Ensure the variable names match those in env.sh
const SECRET_KEY = env.ADMIN_SECRET_KEY || env.SECRET_KEY; // Adjust if needed
const RPC_URL = env.SOROBAN_RPC_URL; // Use the correct variable name from env.sh

if (!SECRET_KEY || !RPC_URL) {
  console.error('Error: SECRET_KEY (or ADMIN_SECRET_KEY) and SOROBAN_RPC_URL must be set in env.sh');
  process.exit(1);
}

// --- Load deployments ---
const deploymentsPath = path.join(__dirname, '..', 'deployments.json');
let deployments;
let PROTOCOL_CONTRACT_ID;
try {
  deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  PROTOCOL_CONTRACT_ID = deployments.testnet.protocol.id;
  if (!PROTOCOL_CONTRACT_ID) throw new Error('Protocol contract ID not found');
} catch (err) {
  console.error('Error loading deployments.json:', err);
  process.exit(1);
}

// --- Stellar SDK Setup ---
const server = new SorobanRpc.Server(RPC_URL, { allowHttp: true });
const source = Keypair.fromSecret(SECRET_KEY);
const sourceAddress = source.publicKey();
const protocolContract = new Contract(PROTOCOL_CONTRACT_ID);

// --- Helper Function ---
async function invokeContract(
  operation,
  sourceKeypair,
  expectSuccess = true
) {
  const account = await server.getAccount(sourceKeypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "1000000", // Keep increased fee
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(TimeoutInfinite)
    .build();

  // Revert to using simulateTransaction first
  let sim;
  try {
    sim = await server.simulateTransaction(tx);
  } catch (error) {
    // Log simulation errors originating from simulateTransaction call itself
    console.error("Transaction simulation failed:", error?.response?.data || error);
    throw error; // Re-throw after logging
  }

  // Check for simulation errors *returned* in the response
  if (!expectSuccess && sim.error) {
    console.log("Expected simulation error occurred:", sim.error);
    return sim; // Return simulation error if expected
  }
  if (sim.error) {
    console.error('Simulation Error: Found error in simulation response:', sim.error);
    if (sim.result?.sorobanDiagnostics) {
        try {
            const diagnostics = xdr.DiagnosticEvent.fromXDR(sim.result.sorobanDiagnostics, 'base64');
            console.error("Soroban Diagnostics:", JSON.stringify(diagnostics, null, 2));
        } catch (diagError) {
            console.error("Failed to decode Soroban diagnostics:", diagError);
        }
    }
    throw new Error('Transaction simulation failed unexpectedly.');
  } else if (!sim.result) {
      // Handle cases where simulation succeeded but has no result (shouldn't usually happen for invokes)
      console.warn('Simulation succeeded but no result found:', sim);
  }
  // Simulation seems successful, proceed to sign and send

  tx.sign(sourceKeypair);

  try {
    const sendResponse = await server.sendTransaction(tx);

    if (sendResponse.status === 'ERROR' || sendResponse.status === 'FAILED') {
        console.error("Transaction submission failed immediately:", sendResponse);
        if (sendResponse.errorResult) {
             try {
                 // Log raw error result string if parsing fails
                 console.error("Raw Error Result:", sendResponse.errorResult);
                 const resultObject = xdr.TransactionResult.fromXDR(sendResponse.errorResult, 'base64');
                 console.error("Submission Error Result XDR:", JSON.stringify(resultObject, null, 2));
             } catch (parseError) {
                  console.error("Failed to parse submission error XDR:", parseError);
             }
        }
        throw new Error(`Transaction submission failed with status: ${sendResponse.status}`);
    }

    // If status is not ERROR/FAILED initially, start polling
    console.log(`Initial submission status: ${sendResponse.status}, hash: ${sendResponse.hash}. Fetching status...`);
    let getResponse = sendResponse;
    const start = Date.now();
    const TIMEOUT_MS = 60000; // 60 seconds timeout

    // Poll while status is PENDING, NOT_FOUND, or TRY_AGAIN_LATER
    // ---> FIX: Fetch inside loop and check response before accessing status <---
    while (true) { 
        if (Date.now() - start > TIMEOUT_MS) {
            console.error("Transaction timed out while polling:", getResponse);
            throw new Error(`Transaction ${sendResponse.hash} timed out after ${TIMEOUT_MS / 1000} seconds.`);
        }
        
        // Fetch status in each iteration
        // eslint-disable-next-line no-await-in-loop
        getResponse = await server.getTransaction(sendResponse.hash);
        console.log(`Polling... Current status: ${getResponse?.status}`);

        // Exit loop if status is no longer pending/transient
        if (getResponse && 
            getResponse.status !== SorobanRpc.GetTransactionStatus.PENDING &&
            getResponse.status !== SorobanRpc.GetTransactionStatus.NOT_FOUND &&
            getResponse.status !== SorobanRpc.GetTransactionStatus.TRY_AGAIN_LATER) {
            break; 
        }

        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before next poll
    }


    // After loop, check final status
    if (getResponse?.status !== SorobanRpc.GetTransactionStatus.SUCCESS) {
        console.error("Transaction failed:", getResponse);
        if (getResponse?.resultMetaXdr) {
            try {
                const resultMeta = xdr.TransactionMeta.fromXDR(getResponse.resultMetaXdr, 'base64');
                console.error("Transaction Result Meta:", JSON.stringify(resultMeta.v3().sorobanMeta(), null, 2));
            } catch (metaError) {
                console.error("Failed to parse resultMetaXdr:", metaError);
            }
        }
        throw new Error(`Transaction failed with status: ${getResponse?.status}`);
    }

     // Transaction Succeeded
     if (getResponse?.resultXdr) {
        const result = xdr.TransactionResult.fromXDR(getResponse.resultXdr, 'base64');
        if (result.result().results()[0]) {
            const opResult = result.result().results()[0].tr().invokeHostFunctionResult();
            if (opResult.switch() === xdr.InvokeHostFunctionResultCode.invokeHostFunctionSuccess()) {
                return scValToNative(opResult.success());
            } else {
                 console.error("Operation failed within successful transaction:", opResult);
                 throw new Error(`Contract operation failed: ${opResult.switch().name}`);
            }
        }
    }
    return getResponse; // Return the full successful response if no specific return value

  } catch (error) {
    // Catch errors during sendTransaction or getTransaction polling
    console.error("Error submitting or polling transaction:", error?.response?.data || error);
    throw error;
  }
}

// --- Test Suite ---
t.test('Protocol Contract Integration Test', async (t) => {
  // Generate unique IDs for this test run
  const testRunId = randomBytes(4).toString('hex');
  // Generate a unique schema definition for this run to avoid collisions
  const schemaDefinitionString = `TestSchema_${testRunId}(field=String)`;
  // Calculate schema UID based on definition and caller - mimics contract logic
  const schemaUid = hash(
      Buffer.concat([
          Buffer.from(schemaDefinitionString),
          Address.fromString(sourceAddress).toBuffer() // Use source address buffer
      ])
  );

  const recipient = Keypair.random().publicKey(); // Generate a random recipient for testing

  // Attestation data
  const attestationValueString = `test_value_${testRunId}`;
  const attestationReferenceString = `ref_${testRunId}`;

  t.before(async () => {
    // Check source account exists and has funds (basic check)
    try {
      await server.getAccount(sourceAddress);
      t.pass('Source account found on network');
    } catch (e) {
      t.fail(`Source account ${sourceAddress} not found or RPC connection failed: ${e.message}`);
      // Cannot proceed without the source account
      process.exit(1);
    }
  });

  t.test('0. Initialize Contract', async (t) => {
    const adminAddress = Address.fromString(sourceAddress);
    const argsVec = [ adminAddress.toScVal() ]; // Only admin arg

    const invokeContractArgs = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(PROTOCOL_CONTRACT_ID).toScAddress(),
      functionName: 'initialize',
      args: argsVec,
    });
    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeContractArgs);
    const operation = Operation.invokeHostFunction({ func: hostFunction, auth: [] });

    try {
        const result = await invokeContract(operation, source);
        t.ok(result === undefined || result === null, 'Initialize transaction should succeed and return void');
    } catch (error) {
        // Handle "Already Initialized" gracefully
        if (error.message && error.message.includes('Error(Contract, #13)')) {
             t.pass('Contract already initialized (Error #13), continuing...');
             console.log('Initialize step skipped: Contract already initialized.');
        } else {
            console.error("Initialize Error:", error);
            t.fail(`Initialize failed: ${error.message}`, { error });
        }
    }
  });

  t.test('1. Register Schema', async (t) => {
    // Match Rust signature: caller, schema_definition, resolver, revocable
    const callerAddress = Address.fromString(sourceAddress);
    const argsVec = [
        callerAddress.toScVal(),                         // caller: Address
        xdr.ScVal.scvString(schemaDefinitionString),    // schema_definition: String
        xdr.ScVal.scvVoid(),                             // resolver: Option<Address> -> None
        xdr.ScVal.scvBool(true),                         // revocable: bool
    ];

    const invokeContractArgs = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(PROTOCOL_CONTRACT_ID).toScAddress(),
      functionName: 'register', // Correct function name
      args: argsVec,
    });
    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeContractArgs);
    const operation = Operation.invokeHostFunction({ func: hostFunction, auth: [] });

    try {
      // register returns BytesN<32> (schema_uid)
      const result = await invokeContract(operation, source);
      t.ok(result, 'Schema registration transaction should succeed');
      t.ok(Buffer.isBuffer(result), 'Registration result should be a buffer (schema UID)');
      t.equal(result.toString('hex'), schemaUid.toString('hex'), 'Returned schema UID should match calculated UID');
    } catch (error) {
      console.error("Register Schema Error:", error);
      t.fail(`Schema registration failed: ${error.message}`, { error });
    }
  });

  t.test('2. Attest to Schema', async (t) => {
    // Match Rust signature: caller, schema_uid, subject, value, reference
    const callerAddress = Address.fromString(sourceAddress);
    const subjectAddress = Address.fromString(recipient); // Use random recipient as subject
    const argsVec = [
        callerAddress.toScVal(),                             // caller: Address
        xdr.ScVal.scvBytes(schemaUid),                       // schema_uid: BytesN<32>
        subjectAddress.toScVal(),                            // subject: Address
        xdr.ScVal.scvString(attestationValueString),         // value: String
        xdr.ScVal.scvString(attestationReferenceString),     // reference: Option<String> -> Some(String)
    ];

    const invokeContractArgs = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(PROTOCOL_CONTRACT_ID).toScAddress(),
      functionName: 'attest', // Correct function name
      args: argsVec,
    });
    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeContractArgs);
    const operation = Operation.invokeHostFunction({ func: hostFunction, auth: [] });

    try {
        // attest returns Result<(), Error> -> void on success
        const result = await invokeContract(operation, source);
        t.ok(result === undefined || result === null, 'Attestation transaction should succeed and return void');
    } catch (error) {
        console.error("Attest Error Details:", error);
        t.fail(`Attestation failed: ${error.message}`, { error });
    }
  });

  t.test('3. Read Attestation', async (t) => {
     // Match Rust signature: schema_uid, subject, reference
     const subjectAddress = Address.fromString(recipient);
     const argsVec = [
        xdr.ScVal.scvBytes(schemaUid),                       // schema_uid: BytesN<32>
        subjectAddress.toScVal(),                            // subject: Address
        xdr.ScVal.scvString(attestationReferenceString),     // reference: Option<String> -> Some(String)
     ];

    const invokeContractArgs = new xdr.InvokeContractArgs({
      contractAddress: Address.fromString(PROTOCOL_CONTRACT_ID).toScAddress(),
      functionName: 'get_attestation', // Correct function name
      args: argsVec,
    });
    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeContractArgs);
    const invokeHostFnOp = Operation.invokeHostFunction({ func: hostFunction, auth: [] });

    // Fetch account fresh for simulation tx building
    const account = await server.getAccount(source.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(invokeHostFnOp)
      .setTimeout(TimeoutInfinite)
      .build();

    try {
        const simResponse = await server.simulateTransaction(tx);
        t.ok(!simResponse.error, 'Read attestation simulation should succeed');
        if (simResponse.result?.retval) {
            const attestationData = scValToNative(simResponse.result.retval);
            t.ok(attestationData, 'Attestation data should be returned');

            // Verify fields based on AttestationRecord struct (adjust if needed)
            t.equal(attestationData.schema_uid.toString('hex'), schemaUid.toString('hex'), 'Schema UID should match');
            t.equal(Address.fromScAddress(attestationData.subject).toString(), recipient, 'Subject should match recipient');
            t.equal(Address.fromScAddress(attestationData.attester).toString(), sourceAddress, 'Attester should match source');
            t.equal(attestationData.value, attestationValueString, 'Value should match');
            t.equal(attestationData.revoked, false, 'Attestation should not be revoked yet');
            // Add more checks if AttestationRecord has more fields (e.g., timestamp)

        } else {
            t.fail('Simulation response did not contain return value for get_attestation', { simResponse });
        }

    } catch (error) {
        console.error("Read Attestation Simulation Error:", error);
        t.fail(`Read attestation simulation failed: ${error.message || error}`, { error });
    }
  });

  t.test('4. Revoke Attestation', async (t) => {
    // Match Rust signature: caller, schema_uid, subject, reference
    const callerAddress = Address.fromString(sourceAddress);
    const subjectAddress = Address.fromString(recipient);
    const argsVec = [
        callerAddress.toScVal(),                            // caller: Address
        xdr.ScVal.scvBytes(schemaUid),                      // schema_uid: BytesN<32>
        subjectAddress.toScVal(),                           // subject: Address
        xdr.ScVal.scvString(attestationReferenceString),    // reference: Option<String> -> Some(String)
    ];

    const invokeContractArgs = new xdr.InvokeContractArgs({
        contractAddress: Address.fromString(PROTOCOL_CONTRACT_ID).toScAddress(),
        functionName: 'revoke_attestation', // Correct function name
        args: argsVec,
    });
    const hostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(invokeContractArgs);
    const operation = Operation.invokeHostFunction({ func: hostFunction, auth: [] });

    try {
      // revoke_attestation returns Result<(), Error> -> void on success
      const result = await invokeContract(operation, source);
      t.ok(result === undefined || result === null, 'Revocation transaction should succeed and return void');

      // --- Verify revocation by reading again ---
       // Match Rust signature: schema_uid, subject, reference
       const readArgsVec = [
           xdr.ScVal.scvBytes(schemaUid),
           subjectAddress.toScVal(),
           xdr.ScVal.scvString(attestationReferenceString),
       ];
       const readInvokeContractArgs = new xdr.InvokeContractArgs({
           contractAddress: Address.fromString(PROTOCOL_CONTRACT_ID).toScAddress(),
           functionName: 'get_attestation', // Correct function name
           args: readArgsVec,
       });
       const readHostFunction = xdr.HostFunction.hostFunctionTypeInvokeContract(readInvokeContractArgs);
       const readOp = Operation.invokeHostFunction({ func: readHostFunction, auth: [] });

       const account = await server.getAccount(source.publicKey());
       const readTx = new TransactionBuilder(account, {
         fee: BASE_FEE,
         networkPassphrase: Networks.TESTNET,
       })
         .addOperation(readOp)
         .setTimeout(TimeoutInfinite)
         .build();
       const simResponse = await server.simulateTransaction(readTx);
       t.ok(!simResponse.error, 'Post-revoke read simulation should succeed');
        if (simResponse.result?.retval) {
             const attestationData = scValToNative(simResponse.result.retval);
             t.equal(attestationData.revoked, true, 'Attestation should now be revoked');
        } else {
            t.fail('Post-revoke simulation response did not contain return value', { simResponse });
        }

    } catch (error) {
      console.error("Revoke Attestation Error:", error);
      t.fail(`Revocation failed: ${error.message}`, { error });
    }
  });

}); 