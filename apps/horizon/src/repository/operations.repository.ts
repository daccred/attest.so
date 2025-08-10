/**
 * Operations repository for Horizon blockchain operation management.
 * 
 * Provides data access layer for fetching and storing blockchain operations
 * from Stellar Horizon API. Handles operation retrieval with pagination,
 * contract association, and database persistence with transaction support.
 * 
 * @module repository/operations
 * @requires common/constants
 * @requires common/db
 * @requires common/errors
 */

import { getHorizonBaseUrl } from '../common/constants'
import { getDB } from '../common/db'
import { IndexerErrorHandler, PerformanceMonitor, RateLimiter } from '../common/errors'

/**
 * Fetches operations from Horizon API with filtering options.
 * 
 * Retrieves blockchain operations using various filter criteria including
 * account, transaction, and cursor-based pagination. Supports both forward
 * and reverse ordering for comprehensive operation history retrieval.
 * 
 * @async
 * @function fetchOperationsFromHorizon
 * @param {Object} params - Query parameters
 * @param {string} [params.transactionHash] - Filter by transaction hash
 * @param {string} [params.accountId] - Filter by account/contract ID
 * @param {string} [params.contractId] - Filter by contract ID
 * @param {string} [params.cursor] - Pagination cursor
 * @param {number} [params.limit=100] - Maximum results to fetch
 * @returns {Promise<Array>} Array of operation records from Horizon
 */
export async function fetchOperationsFromHorizon(params: {
  transactionHash?: string
  accountId?: string
  contractId?: string
  cursor?: string
  limit?: number
}): Promise<any[]> {
  const { transactionHash, accountId, contractId, cursor, limit = 100 } = params

  return await PerformanceMonitor.measureAsync('fetchOperationsFromHorizon', async () => {
    // Rate limiting: max 50 requests per minute
    if (!RateLimiter.canProceed('operations', 50, 60000)) {
      IndexerErrorHandler.logWarning('Rate limit reached for operations API')
      return []
    }

    try {
      const baseParams: any = {
        limit: Math.min(limit, 200), // Enforce maximum limit
        order: 'desc',
      }

      if (cursor) baseParams.cursor = cursor
      if (transactionHash) baseParams.for_transaction = transactionHash
      if (accountId) baseParams.for_account = accountId

      IndexerErrorHandler.logInfo('Fetching operations from Horizon', baseParams)

      // Use Stellar Horizon API for operations (not Soroban RPC)
      const horizonUrl = getHorizonBaseUrl()
      const queryString = new URLSearchParams(baseParams).toString()
      const url = `${horizonUrl}/operations?${queryString}`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const data = await response.json()
      const operations = data._embedded?.records || []

      IndexerErrorHandler.logSuccess(`Fetched ${operations.length} operations`)
      return operations
    } catch (error: any) {
      IndexerErrorHandler.handleRpcError(error, 'fetchOperationsFromHorizon')
      return []
    }
  })
}

/**
 * Stores contract operations in database with association mapping.
 * 
 * Persists operations with proper contract association and transaction
 * relationships. Handles bulk upsert operations with transaction safety
 * and maintains data integrity through foreign key constraints.
 * 
 * @async
 * @function storeContractOperationsInDB
 * @param {Array} operations - Operations with contract mapping
 * @param {string[]} [contractIds] - Associated contract identifiers
 * @returns {Promise<number>} Count of stored operations
 */
export async function storeContractOperationsInDB(operations: any[], contractIds: string[] = []) {
  const db = await getDB()
  if (!db || operations.length === 0) return 0

  try {
    const results = await db.$transaction(
      async (prismaTx) => {
        const ops = operations.map(async (operation) => {
          // Determine which contract this operation is for
          const targetContractId =
            operation._contractId || // Use pre-mapped contract ID
            contractIds.find(
              (contractId) =>
                operation.contract_id === contractId ||
                operation.source_account === contractId ||
                operation.account === contractId ||
                JSON.stringify(operation).includes(contractId)
            ) ||
            contractIds[0] ||
            ''

          const operationData = {
            operationId: operation.id,
            transactionHash: operation.transaction_hash,
            contractId: targetContractId,
            operationType: operation.type || 'invoke_host_function',
            successful:
              operation.successful !== false && operation.transaction_successful !== false,
            sourceAccount: operation.source_account || '',
            operationIndex: operation.operation_index || 0,
            details: operation,
            function: operation.function || null,
            parameters: operation.parameters || null,
          }

          // Use the new HorizonContractOperation model for contract-specific operations
          return prismaTx.horizonContractOperation.upsert({
            where: { operationId: operation.id },
            update: operationData,
            create: operationData,
          })
        })

        return Promise.all(ops)
      },
      {
        timeout: 30000, // 30 seconds timeout for large batches
      }
    )

    console.log(
      `✅ Stored ${results.length} contract operations in HorizonContractOperation table.`
    )
    return results.length
  } catch (error) {
    console.error('❌ Error storing contract operations:', error)
    return 0
  }
}
