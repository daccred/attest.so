// Import necessary stellar SDK modules
const { SorobanRpc, Address, Contract, TransactionBuilder, Keypair, Networks, xdr } = require('@stellar/stellar-sdk');
const fs = require('fs');
const path = require('path');

// Function to parse .sh-style env file
function parseShEnv(filePath) {
    const env = {};
    try {
        const content = fs.readFileSync(filePath, { encoding: 'utf8' });
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
    } catch (e) {
        console.error(`Error reading or parsing env file ${filePath}:`, e);
    }
    return env;
}

// Load environment variables from env.sh
const envPath = path.resolve(__dirname, '../env.sh');
const envConfig = parseShEnv(envPath);

// Configuration
const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const ADMIN_SECRET_KEY = envConfig.ADMIN_SECRET_KEY;
const AUTHORITY_RESOLVER_CONTRACT_ID = envConfig.AUTHORITY_RESOLVER_CONTRACT_ID || 'CBUVVPJQXLVHOA73Z6ZZR55RDHRON3OIFAECZG456XSDVRZSIGDPN4BA'; // Use latest contract ID
const ADMIN_ADDRESS = envConfig.ADMIN_ADDRESS;
const TOKEN_CONTRACT_ID = envConfig.TOKEN_CONTRACT_ID;

console.log('Environment configuration loaded:');
console.log(`Contract ID: ${AUTHORITY_RESOLVER_CONTRACT_ID}`);
console.log(`Admin Address: ${ADMIN_ADDRESS}`);
console.log(`Token Contract ID: ${TOKEN_CONTRACT_ID}`);

if (!ADMIN_SECRET_KEY) {
    console.error("Error: ADMIN_SECRET_KEY is required in env.sh");
    process.exit(1);
}

// Initialize Soroban RPC client
const server = new SorobanRpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });
const sourceKeypair = Keypair.fromSecret(ADMIN_SECRET_KEY);
const sourceAccountId = sourceKeypair.publicKey();

// Convert string address to contract Address
function createContractAddress(contractId) {
    return new Address(contractId);
}

// Convert account string to account Address
function createAccountAddress(accountId) {
    return Address.fromString(accountId);
}

async function initializeContract() {
    console.log(`Initializing contract: ${AUTHORITY_RESOLVER_CONTRACT_ID}`);
    console.log(`Using admin address: ${ADMIN_ADDRESS}`);
    console.log(`Using token contract: ${TOKEN_CONTRACT_ID}`);
    console.log(`Using source account: ${sourceAccountId}`);

    try {
        // Get source account
        console.log('Fetching source account...');
        const account = await server.getAccount(sourceAccountId);
        console.log('Account found');

        // Creating the contract instance
        console.log('Creating contract instance...');
        const contractId = createContractAddress(AUTHORITY_RESOLVER_CONTRACT_ID);
        
        // Prepare parameters
        const adminAddr = createAccountAddress(ADMIN_ADDRESS);
        const tokenAddr = createContractAddress(TOKEN_CONTRACT_ID);
        
        // Build transaction
        const tx = new TransactionBuilder(account, {
            fee: "100000", // 0.01 XLM
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation({
                type: 'invokeHostFunction',
                func: xdr.HostFunction.hostFunctionTypeInvokeContract(),
                parameters: [
                    contractId.toScVal(),
                    xdr.ScVal.scvSymbol("initialize"),
                    adminAddr.toScVal(),
                    tokenAddr.toScVal()
                ]
            })
            .setTimeout(30)
            .build();

        // Simulate transaction
        console.log('Simulating transaction...');
        try {
            const sim = await server.simulateTransaction(tx);
            console.log('Simulation response:', JSON.stringify(sim, null, 2));

            if (sim.error) {
                console.error('Simulation failed:', sim.error);
                return;
            }

            // If simulation succeeds, prepare and sign the transaction
            console.log('Preparing transaction...');
            const preparedTx = SorobanRpc.assembleTransaction(tx, sim);
            
            // Sign the transaction
            console.log('Signing transaction...');
            preparedTx.sign(sourceKeypair);
            
            // Submit transaction
            console.log('Submitting transaction...');
            const response = await server.sendTransaction(preparedTx);
            console.log('Transaction submitted:', response);
            
            if (response.status === 'PENDING') {
                console.log('Transaction is pending. Waiting for confirmation...');
                
                // Wait for transaction to complete (simple polling approach)
                let status = response.status;
                let attempts = 10;
                let txResponse;
                
                while (status === 'PENDING' && attempts > 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                    txResponse = await server.getTransaction(response.hash);
                    status = txResponse.status;
                    console.log(`Transaction status check (${11-attempts}/10): ${status}`);
                    attempts--;
                }
                
                if (status === 'SUCCESS') {
                    console.log('Transaction was successful!');
                    console.log('Result:', txResponse.resultXdr);
                } else {
                    console.error('Transaction failed or timed out:', status);
                }
            } else {
                console.error('Transaction submission failed:', response.status);
                if (response.errorResultXdr) {
                    console.error('Error XDR:', response.errorResultXdr);
                }
            }
        } catch (error) {
            console.error('Simulation error:', error.message);
            if (error.response && error.response.data) {
                console.error('Error details:', JSON.stringify(error.response.data, null, 2));
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response && error.response.data) {
            console.error('Error details:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Main function
async function main() {
    try {
        await initializeContract();
    } catch (error) {
        console.error('Unhandled error:', error);
    }
}

// Run the main function
main(); 