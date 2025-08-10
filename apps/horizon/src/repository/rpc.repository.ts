/**
 * RPC repository for direct blockchain RPC interactions.
 * 
 * Provides low-level RPC communication layer for Soroban endpoints.
 * Handles RPC method calls, response parsing, and error handling
 * for reliable blockchain data access.
 * 
 * @module repository/rpc
 * @requires @stellar/stellar-sdk
 * @requires common/constants
 */

import { rpc } from '@stellar/stellar-sdk'
import { sorobanRpcUrl } from '../common/constants'

const sorobanServer = new rpc.Server(sorobanRpcUrl, {
  allowHttp: sorobanRpcUrl.startsWith('http://'),
})

/**
 * Retrieves the latest ledger sequence from Soroban RPC.
 * 
 * Fetches the most recent ledger sequence number from the RPC endpoint
 * with comprehensive logging for debugging. Essential for synchronization
 * and determining the current blockchain height.
 * 
 * @async
 * @function getLatestRPCLedgerIndex
 * @returns {Promise<number>} Latest ledger sequence number
 * @throws {Error} RPC connection errors or invalid response
 */
export async function getLatestRPCLedgerIndex(): Promise<number> {
  console.log('--------------- Attempting to call sorobanServer.getLatestLedger() --------------- ')
  const latestLedgerOnRpcData = await sorobanServer.getLatestLedger()
  console.log('--------------- sorobanServer.getLatestLedger() RAW RESPONSE: ---------------')
  console.log(JSON.stringify(latestLedgerOnRpcData, null, 2))
  console.log('----------------------------------------------------------------------------')
  if (!latestLedgerOnRpcData || typeof latestLedgerOnRpcData.sequence !== 'number') {
    throw new Error('Invalid response from getLatestLedger or sequence number missing.')
  }
  return latestLedgerOnRpcData.sequence
}

/**
 * Checks the health status of the Soroban RPC endpoint.
 * 
 * Performs a health check against the RPC endpoint to determine
 * service availability and status. Returns standardized status
 * strings for monitoring and alerting purposes.
 * 
 * @async
 * @function getRpcHealth
 * @returns {Promise<string>} RPC health status string
 * @returns {'healthy'} RPC is operational
 * @returns {'error_invalid_response'} RPC returned invalid response
 */
export async function getRpcHealth(): Promise<string> {
  console.log('--------------- Attempting to call sorobanServer.getHealth() --------------- ')
  const rpcHealth = await sorobanServer.getHealth()
  console.log('--------------- sorobanServer.getHealth() RAW RESPONSE: ------------------')
  console.log(JSON.stringify(rpcHealth, null, 2))
  console.log('--------------------------------------------------------------------------')

  if (!rpcHealth || typeof rpcHealth.status !== 'string') {
    console.warn('RPC health response invalid or status missing.')
    return 'error_invalid_response'
  }
  return rpcHealth.status
}
