/**
 * Effects repository for blockchain operation effects.
 * 
 * Manages operation effects which represent state changes resulting
 * from blockchain operations. Tracks account balance changes, trustline
 * modifications, and other ledger state transitions.
 * 
 * @module repository/effects
 * @requires common/constants
 * @requires common/db
 */

import { getHorizonBaseUrl } from '../common/constants'
import { getDB } from '../common/db'

/**
 * Fetches operation effects from Stellar Horizon API.
 * 
 * Retrieves effect records representing state changes from operations.
 * Supports filtering by operation, transaction, account, and pagination
 * for comprehensive effect tracking and analysis.
 * 
 * @async
 * @function fetchEffectsFromHorizon
 * @param {Object} params - Query parameters
 * @param {string} [params.operationId] - Filter by operation ID
 * @param {string} [params.transactionHash] - Filter by transaction hash
 * @param {string} [params.accountId] - Filter by affected account
 * @param {string} [params.cursor] - Pagination cursor
 * @param {number} [params.limit=100] - Maximum results to fetch
 * @returns {Promise<Array>} Effect records from Horizon
 */
export async function fetchEffectsFromHorizon(params: {
  operationId?: string
  transactionHash?: string
  accountId?: string
  cursor?: string
  limit?: number
}): Promise<any[]> {
  const { operationId, transactionHash, accountId, cursor, limit = 100 } = params

  try {
    const baseParams: any = {
      limit,
      order: 'desc',
    }

    if (cursor) baseParams.cursor = cursor
    if (operationId) baseParams.for_operation = operationId
    if (transactionHash) baseParams.for_transaction = transactionHash
    if (accountId) baseParams.for_account = accountId

    console.log('Fetching effects from Horizon with params:', baseParams)

    // Use Stellar Horizon API for effects (not Soroban RPC)
    const horizonUrl = getHorizonBaseUrl()
    const queryString = new URLSearchParams(baseParams).toString()
    const url = `${horizonUrl}/effects?${queryString}`

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`Effects request failed: ${response.status}`)
    }

    const data = await response.json()
    return data._embedded?.records || []
  } catch (error: any) {
    console.error('Error fetching effects:', error.message)
    return []
  }
}

/**
 * Stores operation effects in database with comprehensive metadata.
 * 
 * Persists effect records representing state changes from operations,
 * including account credits/debits, trustline changes, and contract
 * state modifications. Links effects to parent operations and transactions.
 * 
 * @async
 * @function storeEffectsInDB
 * @param {Array} effects - Effect records to store
 * @returns {Promise<void>} Completes when storage is done
 */
export async function storeEffectsInDB(effects: any[]) {
  const db = await getDB()
  if (!db || effects.length === 0) return

  try {
    const results = await db.$transaction(async (prismaTx) => {
      const effs = effects.map(async (effect) => {
        const effectData = {
          effectId: effect.id,
          operationId: effect.operation_id,
          transactionHash: effect.transaction_hash,
          type: effect.type,
          typeI: effect.type_i || 0,
          details: effect,
          account: effect.account,
        }

        return prismaTx.horizonEffect.upsert({
          where: { effectId: effect.id },
          update: effectData,
          create: effectData,
        })
      })

      return Promise.all(effs)
    })

    console.log(`Stored ${results.length} effects.`)
  } catch (error) {
    console.error('Error storing effects:', error)
  }
}
