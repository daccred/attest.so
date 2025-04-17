#!/usr/bin/env node
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
  BASE_FEE
} from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { program } from 'commander';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Environment Variable Loading ---

function loadEnv(envPath) {
  try {
    const env = fs.readFileSync(envPath, { encoding: 'utf8' });
    return parseEnv(env);
  } catch (err) {
    console.error(`Error loading environment file at ${envPath}:`, err);
    return {};
  }
}
function parseEnv(content) {
    const env = {};
    content.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const match = line.match(/^export\s+([^=]+)=(.*)$/);
            if (match) {
                let key = match[1];
                let value = match[2];
                // Remove surrounding quotes
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.substring(1, value.length - 1);
                }
                env[key] = value;
            }
        }
    });
    return env;
}

const envPath = path.join(__dirname, '..', 'env.sh');
const envConfig = loadEnv(envPath);

// --- Configuration ---

const ADMIN_SECRET_KEY = envConfig.ADMIN_SECRET_KEY || process.env.ADMIN_SECRET_KEY;
// TODO: Replace with actual latest deployed protocol contract ID or allow override
const PROTOCOL_CONTRACT_ID = envConfig.PROTOCOL_CONTRACT_ID || 'CAF5SWYR7B7V5FYUXTGYXCRUNRQEIWEUZRDCARNMX456LRD64RX76BNN'; 
const ADMIN_ADDRESS = envConfig.ADMIN_ADDRESS || (ADMIN_SECRET_KEY ? Keypair.fromSecret(ADMIN_SECRET_KEY).publicKey() : null);

if (!ADMIN_SECRET_KEY) {
    console.warn("Warning: ADMIN_SECRET_KEY is not set in env.sh or environment variables. Operations requiring admin privileges will fail.");
}
if (!ADMIN_ADDRESS) {
    console.warn("Warning: ADMIN_ADDRESS could not be derived. Please set ADMIN_SECRET_KEY or ADMIN_ADDRESS.");
}
if (PROTOCOL_CONTRACT_ID === 'CAF5SWYR7B7V5FYUXTGYXCRUNRQEIWEUZRDCARNMX456LRD64RX76BNN') {
    console.warn("Warning: PROTOCOL_CONTRACT_ID is using a placeholder. Please set it in env.sh or environment variables.");
}


const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const networkPassphrase = process.env.SOROBAN_NETWORK_PASSPHRASE || Networks.TESTNET;

console.log('-------------------------------------------------------');
console.log('Configuration:');
console.log('RPC URL:', rpcUrl);
console.log('Network Passphrase: [REDACTED]');
console.log('Protocol Contract ID:', PROTOCOL_CONTRACT_ID);
console.log('Admin Address:', ADMIN_ADDRESS || 'Not Set');
console.log('-------------------------------------------------------');


// --- Soroban Client Setup ---

const server = new SorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
const contract = new Contract(PROTOCOL_CONTRACT_ID);

async function getConfig() {
  if (!ADMIN_SECRET_KEY) {
    throw new Error("ADMIN_SECRET_KEY is required for configuration.");
  }
  const adminKeypair = Keypair.fromSecret(ADMIN_SECRET_KEY);
  const source = new Account(adminKeypair.publicKey(), "0"); // Sequence doesn't matter for reads

  return {
    server,
    contract,
    sourceAccount: source,
    sourceKeypair: adminKeypair,
    networkPassphrase,
    contractId: PROTOCOL_CONTRACT_ID,
  };
}

// --- Helper Functions (Placeholder for invoke) ---

async function invoke({ func, args, fee = BASE_FEE }) {
    console.log(`\nInvoking ${func} on ${PROTOCOL_CONTRACT_ID}`);
    console.log('Args:', args);
    console.log('Fee:', fee);

    if (!ADMIN_SECRET_KEY) {
        throw new Error("ADMIN_SECRET_KEY is required to sign transactions.");
    }

    const config = await getConfig();
    const account = await server.getAccount(config.sourceKeypair.publicKey());
    const source = new Account(account.id, account.sequence);

    const operation = contract.call(func, ...args);

    const tx = new TransactionBuilder(source, { fee: fee.toString(), networkPassphrase })
      .addOperation(operation)
      .setTimeout(TimeoutInfinite)
      .build();

    console.log(`\nSimulating transaction...`);
    let simulateResponse;
    try {
        simulateResponse = await server.simulateTransaction(tx);
        console.log('Simulation successful:');
        // console.log(JSON.stringify(simulateResponse, null, 2)); // Very verbose

        if (simulateResponse.result?.retval) {
             console.log('Return Value (Raw):', simulateResponse.result.retval);
             try {
                const nativeValue = scValToNative(simulateResponse.result.retval);
                console.log('Return Value (Native):', nativeValue);
             } catch (e) {
                console.warn("Could not convert return value to native:", e);
             }
        } else if (simulateResponse.error) {
            console.error('Simulation returned an error:', simulateResponse.error);
        } else {
            console.log('Simulation completed without errors or return value.');
        }

    } catch (error) {
        console.error('Simulation failed:');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        if (error.result && error.result.results) {
           console.error('Result XDR:', error.result.results[0]?.result?.result?.result().value().toString());
        } else {
           console.error('Full Error:', JSON.stringify(error, null, 2));
        }
        throw new Error("Transaction simulation failed.");
    }

    // Check if simulation indicates an error that would cause submission failure
     if (SorobanRpc.Api.isSimulationError(simulateResponse)) {
       console.error("Simulation indicates an error, aborting submission.");
       throw new Error("Simulation error: " + JSON.stringify(simulateResponse));
     }
    // If simulation succeeded but has error status or failed result
     if (simulateResponse.status === SorobanRpc.Api.GetTransactionStatus.ERROR || simulateResponse.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        console.error("Simulation status indicates an error, aborting submission.");
        throw new Error("Simulation failed with status: " + simulateResponse.status);
     }


    console.log("\nSigning transaction...");
    tx.sign(config.sourceKeypair);

    console.log("Submitting transaction...");
    let sendResponse;
    try {
        sendResponse = await server.sendTransaction(tx);
        console.log('Transaction submitted:', sendResponse.hash);
        // console.log(JSON.stringify(sendResponse, null, 2)); // Verbose

        if (sendResponse.status === 'PENDING') {
            console.log('Waiting for transaction confirmation...');
            let txResponse = await server.getTransaction(sendResponse.hash);
            const start = new Date().getTime();
            const TIMEOUT_MS = 60000; // 60 seconds timeout

            while (txResponse.status === SorobanRpc.Api.GetTransactionStatus.PENDING && (new Date().getTime() - start < TIMEOUT_MS)) {
                // Wait a bit before polling again
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds delay
                console.log('Polling for status...');
                txResponse = await server.getTransaction(sendResponse.hash);
            }

             console.log('Final Transaction Status:', txResponse.status);
             // console.log('Final Response:', JSON.stringify(txResponse, null, 2));

            if (txResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
                console.log('Transaction successful!');
                if (txResponse.resultMetaXdr) {
                    const result = xdr.TransactionMeta.fromXDR(txResponse.resultMetaXdr, 'base64');
                     // console.log("Result Meta XDR:", JSON.stringify(result, null, 2)); // Very verbose
                    if (result?.v3()?.sorobanMeta()?.returnValue()) {
                        const nativeValue = scValToNative(result.v3().sorobanMeta().returnValue());
                        console.log("Returned Value (from Meta):", nativeValue);
                        return nativeValue;
                    } else {
                        console.log("No return value in transaction meta.");
                    }
                } else {
                    console.log("No result meta XDR found in the response.");
                }
                return txResponse; // Return the full response on success

            } else if (txResponse.status === SorobanRpc.Api.GetTransactionStatus.PENDING) {
                 console.error('Transaction timed out while pending.');
                 throw new Error(`Transaction ${sendResponse.hash} timed out.`);
            } else {
                console.error('Transaction failed or status unknown.');
                if (txResponse.resultXdr) {
                   const resultXdr = xdr.TransactionResult.fromXDR(txResponse.resultXdr, 'base64');
                   console.error("Transaction Result XDR:", JSON.stringify(resultXdr.result().results()[0], null, 2));
                }
                throw new Error(`Transaction failed with status: ${txResponse.status}`);
            }
        } else {
             console.error('Submission status not PENDING:', sendResponse.status);
             throw new Error(`Transaction submission failed with status: ${sendResponse.status}`);
        }

    } catch (error) {
        console.error("Error sending transaction or processing response:", error);
        // Attempt to decode Soroban diagnostic events if available
         if (error.getSorobanDiagnostics) {
             try {
                const diagnostics = await error.getSorobanDiagnostics(server);
                console.error("Soroban Diagnostics:", JSON.stringify(diagnostics, null, 2));
             } catch (diagError) {
                console.error("Failed to get Soroban diagnostics:", diagError);
             }
         } else {
             console.error("Raw error object:", JSON.stringify(error, null, 2));
         }
        throw error;
    }
}

// --- Helper Functions ---

// Helper for Read-Only Contract Calls
async function readContract({ func, args }) {
    console.log(`\nReading ${func} on ${PROTOCOL_CONTRACT_ID}`);
    console.log('Args:', args);
    try {
        const resultScVal = await server.call(PROTOCOL_CONTRACT_ID, func, ...args);
        console.log('Read successful:');
        if (resultScVal) {
            console.log('Return Value (Raw):', resultScVal);
            try {
                const nativeValue = scValToNative(resultScVal);
                console.log('Return Value (Native):', nativeValue);
                return nativeValue;
            } catch (e) {
                console.warn("Could not convert return value to native:", e);
                return resultScVal; // Return raw value if conversion fails
            }
        } else {
            console.log('Read completed without return value.');
            return null;
        }
    } catch (error) {
        console.error('Read failed:');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        // Attempt to decode Soroban diagnostic events if available
         if (error.getSorobanDiagnostics) {
             try {
                const diagnostics = await error.getSorobanDiagnostics(server);
                console.error("Soroban Diagnostics:", JSON.stringify(diagnostics, null, 2));
             } catch (diagError) {
                console.error("Failed to get Soroban diagnostics:", diagError);
             }
         } else if (error.result?.result?.results?.[0]?.result?.result?.result?.value?.().toString()) {
             // Check if error object structure contains result XDR
             console.error('Result XDR:', error.result.results[0].result.result.result.value().toString());
         } else {
             console.error('Raw error object:', JSON.stringify(error, null, 2));
         }
        throw new Error(`Contract read failed for function ${func}.`);
    }
}

// --- CLI Command Definitions ---

program
  .version('0.0.1')
  .description('CLI utility to interact with the Attestation Protocol Soroban contract on the Stellar network.');

// Initialize command
program
  .command('initialize')
  .description('Initialize the protocol contract with an admin address. Can only be run once.')
  .option('-a, --admin <address>', 'Admin Stellar address (G...) for initialization. Defaults to ADMIN_ADDRESS from env.')
  .action(async (options) => {
    /**
     * Handles the 'initialize' command.
     * Initializes the smart contract by setting the admin address.
     * Requires ADMIN_SECRET_KEY in the environment to sign the transaction.
     * @param {object} options - Command line options.
     * @param {string} [options.admin] - The admin address provided via CLI option.
     */
    try {
        const adminAddress = options.admin || ADMIN_ADDRESS;
        if (!adminAddress) {
            throw new Error("Admin address is required via --admin option or ADMIN_ADDRESS/ADMIN_SECRET_KEY in env.");
        }
        console.log(`Initializing contract ${PROTOCOL_CONTRACT_ID} with admin: ${adminAddress}`);
        // Convert the address string to an ScVal for the contract call
        const adminScVal = new Address(adminAddress).toScVal();
        const result = await invoke({
            func: 'initialize',
            args: [adminScVal]
        });
        console.log('\nInitialize Result:', result ? JSON.stringify(result, null, 2) : 'Success (No return value)');
    } catch (e) {
        console.error('\nError during initialize:', e.message);
        process.exit(1); // Exit with error for critical operations like initialize
    }
  });

// Register Schema command
program
  .command('register')
  .description('Register a new attestation schema definition.')
  .requiredOption('-c, --caller <address>', 'Stellar address (G...) of the account performing the registration and signing the transaction. Must match ADMIN_SECRET_KEY.')
  .requiredOption('-s, --schema <string>', 'Schema definition string (e.g., "Email(string), Age(u32)").')
  .option('-r, --resolver <address>', 'Optional Stellar address (G...) of a resolver contract.')
  .option('--revocable', 'Flag indicating if attestations using this schema can be revoked (defaults to false).', false)
  .action(async (options) => {
    /**
     * Handles the 'register' command.
     * Registers a new schema definition on the smart contract.
     * Requires ADMIN_SECRET_KEY in the environment to sign the transaction.
     * @param {object} options - Command line options.
     * @param {string} options.caller - The caller's Stellar address.
     * @param {string} options.schema - The schema definition string.
     * @param {string} [options.resolver] - Optional resolver contract address.
     * @param {boolean} options.revocable - Whether the schema is revocable.
     */
    try {
        console.log('Registering schema with options:', options);
        // Validate caller matches signer for clarity, although signing itself enforces this
        if (options.caller !== ADMIN_ADDRESS) {
            console.warn(`Warning: Caller address ${options.caller} provided via --caller does not match ADMIN_ADDRESS ${ADMIN_ADDRESS} derived from ADMIN_SECRET_KEY. The transaction will be signed by ADMIN_SECRET_KEY.`);
        }
        const caller = new Address(options.caller).toScVal();
        const schemaDefinition = xdr.ScVal.scvString(options.schema);
        // soroban-client/stellar-sdk handles JS null mapping to Option::None/Vec([]) automatically for contract calls
        const resolver = options.resolver ? new Address(options.resolver).toScVal() : null;
        const revocable = xdr.ScVal.scvBool(!!options.revocable); // Ensure boolean

        const result = await invoke({
            func: 'register',
            args: [caller, schemaDefinition, resolver, revocable]
        });
        // The actual schema UID is in the transaction metadata return value
        console.log('\nRegister Result (Schema UID is in TxMeta):', result ? JSON.stringify(result, null, 2) : 'Success (Check transaction meta for return value)');
    } catch (e) {
        console.error('\nError during register:', e.message);
        process.exit(1);
    }
  });

// Attest command
program
  .command('attest')
  .description('Create a new attestation based on a registered schema.')
  .requiredOption('-c, --caller <address>', 'Stellar address (G...) of the account performing the attestation and signing the transaction. Must match ADMIN_SECRET_KEY.')
  .requiredOption('--schema-uid <hex_string>', 'Schema UID (as a 64-character hex string) obtained from registration.')
  .requiredOption('--subject <address>', 'Stellar address (G...) of the subject receiving the attestation.')
  .requiredOption('-v, --value <string>', 'Attestation value (string). Should match the schema definition format.')
  .option('--reference <string>', 'Optional reference string to uniquely identify this attestation if multiple attestations for the same subject/schema exist.')
  .action(async (options) => {
    /**
     * Handles the 'attest' command.
     * Creates a new attestation on the smart contract.
     * Requires ADMIN_SECRET_KEY in the environment to sign the transaction.
     * @param {object} options - Command line options.
     * @param {string} options.caller - The caller's Stellar address.
     * @param {string} options.schemaUid - The schema UID (hex string).
     * @param {string} options.subject - The subject's Stellar address.
     * @param {string} options.value - The attestation value string.
     * @param {string} [options.reference] - Optional reference string.
     */
    try {
        console.log('Attesting with options:', options);
         if (options.caller !== ADMIN_ADDRESS) {
            console.warn(`Warning: Caller address ${options.caller} provided via --caller does not match ADMIN_ADDRESS ${ADMIN_ADDRESS} derived from ADMIN_SECRET_KEY. The transaction will be signed by ADMIN_SECRET_KEY.`);
        }
        if (options.schemaUid.length !== 64 || !/^[0-9a-fA-F]+$/.test(options.schemaUid)) {
            throw new Error("Invalid schema-uid format. Must be a 64-character hex string.");
        }

        const caller = new Address(options.caller).toScVal();
        const schemaUid = xdr.ScVal.scvBytes(Buffer.from(options.schemaUid, 'hex'));
        const subject = new Address(options.subject).toScVal();
        const value = xdr.ScVal.scvString(options.value);
        const reference = options.reference ? xdr.ScVal.scvString(options.reference) : null;

        const result = await invoke({
            func: 'attest',
            args: [caller, schemaUid, subject, value, reference]
        });
        console.log('\nAttest Result:', result ? JSON.stringify(result, null, 2) : 'Success (No return value)');
    } catch (e) {
        console.error('\nError during attest:', e.message);
        process.exit(1);
    }
  });

// Revoke Attestation command
program
  .command('revoke')
  .description('Revoke an existing attestation (if the schema allows it).')
  .requiredOption('-c, --caller <address>', 'Stellar address (G...) of the account performing the revocation and signing the transaction. Must match ADMIN_SECRET_KEY.')
  .requiredOption('--schema-uid <hex_string>', 'Schema UID (as a 64-character hex string) of the attestation to revoke.')
  .requiredOption('--subject <address>', 'Stellar address (G...) of the subject whose attestation is being revoked.')
  .option('--reference <string>', 'Optional reference string to identify the specific attestation if multiple exist.')
  .action(async (options) => {
    /**
     * Handles the 'revoke' command.
     * Revokes an existing attestation on the smart contract.
     * Requires ADMIN_SECRET_KEY in the environment to sign the transaction.
     * @param {object} options - Command line options.
     * @param {string} options.caller - The caller's Stellar address.
     * @param {string} options.schemaUid - The schema UID (hex string).
     * @param {string} options.subject - The subject's Stellar address.
     * @param {string} [options.reference] - Optional reference string.
     */
    try {
        console.log('Revoking attestation with options:', options);
         if (options.caller !== ADMIN_ADDRESS) {
            console.warn(`Warning: Caller address ${options.caller} provided via --caller does not match ADMIN_ADDRESS ${ADMIN_ADDRESS} derived from ADMIN_SECRET_KEY. The transaction will be signed by ADMIN_SECRET_KEY.`);
        }
         if (options.schemaUid.length !== 64 || !/^[0-9a-fA-F]+$/.test(options.schemaUid)) {
            throw new Error("Invalid schema-uid format. Must be a 64-character hex string.");
        }

        const caller = new Address(options.caller).toScVal();
        const schemaUid = xdr.ScVal.scvBytes(Buffer.from(options.schemaUid, 'hex'));
        const subject = new Address(options.subject).toScVal();
        const reference = options.reference ? xdr.ScVal.scvString(options.reference) : null;

        const result = await invoke({
            func: 'revoke_attestation',
            args: [caller, schemaUid, subject, reference]
        });
        console.log('\nRevoke Result:', result ? JSON.stringify(result, null, 2) : 'Success (No return value)');
    } catch (e) {
        console.error('\nError during revoke:', e.message);
        process.exit(1);
    }
  });

// Get Attestation command
program
  .command('get')
  .description('Retrieve an existing attestation record from the contract.')
  .requiredOption('--schema-uid <hex_string>', 'Schema UID (as a 64-character hex string) of the attestation.')
  .requiredOption('--subject <address>', 'Stellar address (G...) of the subject whose attestation is being retrieved.')
  .option('--reference <string>', 'Optional reference string to identify the specific attestation if multiple exist.')
  .action(async (options) => {
    /**
     * Handles the 'get' command.
     * Retrieves an existing attestation record from the smart contract.
     * This is a read-only operation and does not require signing.
     * @param {object} options - Command line options.
     * @param {string} options.schemaUid - The schema UID (hex string).
     * @param {string} options.subject - The subject's Stellar address.
     * @param {string} [options.reference] - Optional reference string.
     */
    try {
        console.log('Getting attestation with options:', options);
         if (options.schemaUid.length !== 64 || !/^[0-9a-fA-F]+$/.test(options.schemaUid)) {
            throw new Error("Invalid schema-uid format. Must be a 64-character hex string.");
        }

        const schemaUid = xdr.ScVal.scvBytes(Buffer.from(options.schemaUid, 'hex'));
        const subject = new Address(options.subject).toScVal();
        const reference = options.reference ? xdr.ScVal.scvString(options.reference) : null;

        // Use readContract for read-only calls
        const result = await readContract({
            func: 'get_attestation',
            args: [schemaUid, subject, reference]
        });
        console.log('\nGet Attestation Result:', result ? JSON.stringify(result, null, 2) : 'Not Found or Error');
    } catch (e) {
        console.error('\nError during get:', e.message);
        // Don't exit process for read operations, just log the error.
    }
  });

// --- Parse CLI Arguments ---

program.parse(process.argv);

// If no command is specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
