import dotenv from 'dotenv'
dotenv.config()

/**
 * Module: constants
 *
 * Centralized configuration and network constants for the Horizon indexer.
 * Values are primarily sourced from environment variables with sensible defaults.
 */

/**
 * DATABASE_URL
 *
 * PostgreSQL connection string used by Prisma.
 * Example: postgres://user:password@host:port/dbname
 */
export const DATABASE_URL = process.env.DATABASE_URL as string

/**
 * STELLAR_NETWORK
 *
 * Target Stellar network identifier. Supported values: 'mainnet' | 'testnet'.
 * Defaults to 'testnet' when not specified.
 */
export const STELLAR_NETWORK = process.env.STELLAR_NETWORK || 'testnet'

/**
 * CONTRACT_IDS_TO_INDEX
*
*   'CB3NF4FHZPQOBWSPZNLKU32SK6Z5FR54TN6LWBBY72IDRDRIVWBRRFE5',
*   'CBLCL256WVODZVVGGC3TRV5ZSVLZXQFGX4OHE2YM2P4WUQIT2OFAOUQQ',
 * Array of contract IDs that the indexer will track for events, operations, and transactions.
 * This replaces the legacy CONTRACT_ID_TO_INDEX environment variable approach.
 */
export const CONTRACT_IDS_TO_INDEX = [
  process.env.PROTOCOL_CONTRACT_ID as string,
  process.env.AUTHORITY_CONTRACT_ID as string,
] 


/**
 * MAX_EVENTS_PER_FETCH
 *
 * Upper bound on the number of events requested per Soroban getEvents call.
 */
export const MAX_EVENTS_PER_FETCH = 100

/**
 * MAX_OPERATIONS_PER_FETCH
 *
 * Upper bound on the number of Horizon operations requested per contract query.
 */
export const MAX_OPERATIONS_PER_FETCH = 200

/**
 * LEDGER_HISTORY_LIMIT_DAYS
 *
 * Maximum lookback window (in days) when determining a historical start ledger.
 */
export const LEDGER_HISTORY_LIMIT_DAYS = 7

/**
 * sorobanRpcUrl
 *
 * Soroban JSON-RPC endpoint derived from STELLAR_NETWORK.
 * - mainnet  -> https://soroban-rpc.stellar.org
 * - testnet  -> https://soroban-testnet.stellar.org
 */
export let sorobanRpcUrl: string
if (STELLAR_NETWORK === 'mainnet') {
  sorobanRpcUrl = 'https://rpc.lightsail.network'
} else {
  sorobanRpcUrl = 'https://soroban-testnet.stellar.org'
}

/**
 * getHorizonBaseUrl
 *
 * Resolve the Horizon REST base URL for the configured network.
 * @returns The Horizon base URL for mainnet or testnet.
 */
export function getHorizonBaseUrl(): string {
  return STELLAR_NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org'
}

// Initial console logs for verification (optional to remove for production)
console.log(`---------------- HORIZON CONSTANTS INIT (constants.ts) ----------------`)
console.log(`STELLAR_NETWORK: ${STELLAR_NETWORK}`)
console.log(`Soroban RPC URL: ${sorobanRpcUrl}`)
console.log(`Contract IDs to Index: ${CONTRACT_IDS_TO_INDEX.join(', ')}`)
if (CONTRACT_IDS_TO_INDEX.length === 0 && process.env.NODE_ENV !== 'test') {
  console.warn('Warning: CONTRACT_IDS_TO_INDEX array is empty. Please add contract IDs to track.')
}
console.log(
  `Database URL (first 5 chars): ${DATABASE_URL ? DATABASE_URL.substring(0, 5) : 'NOT SET'}...`
)
console.log(`Max events per fetch: ${MAX_EVENTS_PER_FETCH}`)
console.log(`Ledger history limit days: ${LEDGER_HISTORY_LIMIT_DAYS}`)
console.log(`--------------------------------------------------------------------`)
