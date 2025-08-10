import dotenv from 'dotenv';
dotenv.config(); 

// --- Configuration via Environment Variables ---
export const DATABASE_URL = process.env.DATABASE_URL as string;
export const STELLAR_NETWORK = process.env.STELLAR_NETWORK || 'testnet';
export const CONTRACT_ID_TO_INDEX = process.env.CONTRACT_ID_TO_INDEX;

// Enhanced multi-contract configuration
export const CONTRACT_IDS = [
  "CADB73DZ7QP5BG6MRRL3J3X4WWHBCJ7PMCVZXYG7ZGCPIO2XCDBOM", // protocol contract
  "CAD6YMZCO4Q3L5XZT2FD3MDHP3ZHFMYL24RZYG4YQAL4XQKVGVXYPSQQ"  // authority contract
];

export const MAX_EVENTS_PER_FETCH = 100; // Max events to fetch in one getEvents call
export const MAX_OPERATIONS_PER_FETCH = 200; // Max operations to fetch per contract
export const LEDGER_HISTORY_LIMIT_DAYS = 7; // Max days to look back for events



export let sorobanRpcUrl: string;
if (STELLAR_NETWORK === 'mainnet') {
  sorobanRpcUrl = 'https://soroban-rpc.stellar.org'; // Mainnet RPC
} else {
  sorobanRpcUrl = 'https://soroban-testnet.stellar.org'; // Testnet RPC (default)
}

// Initial console logs for verification (optional to remove for production)
console.log(`---------------- HORIZON CONSTANTS INIT (constants.ts) ----------------`);
console.log(`STELLAR_NETWORK: ${STELLAR_NETWORK}`);
console.log(`Soroban RPC URL: ${sorobanRpcUrl}`);
console.log(`Contract ID to Index (legacy): ${CONTRACT_ID_TO_INDEX}`);
console.log(`Contract IDs (enhanced): ${CONTRACT_IDS.join(', ')}`);
if (!CONTRACT_ID_TO_INDEX && process.env.NODE_ENV !== 'test') {
  console.warn("Warning: CONTRACT_ID_TO_INDEX is not set. Please set this environment variable.");
} else if (CONTRACT_ID_TO_INDEX === 'YOUR_CONTRACT_ID_HERE' && process.env.NODE_ENV !== 'test') {
    console.warn("Warning: CONTRACT_ID_TO_INDEX is set to placeholder 'YOUR_CONTRACT_ID_HERE'");
}
console.log(`Database URL (first 5 chars): ${DATABASE_URL ? DATABASE_URL.substring(0, 5) : 'NOT SET'}...`);
console.log(`Max events per fetch: ${MAX_EVENTS_PER_FETCH}`);
console.log(`Ledger history limit days: ${LEDGER_HISTORY_LIMIT_DAYS}`);
console.log(`--------------------------------------------------------------------`);