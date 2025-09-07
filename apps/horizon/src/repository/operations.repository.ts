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

import { getDB } from '../common/db'
import { getHorizonBaseUrl, CONTRACT_IDS_TO_INDEX, MAX_OPERATIONS_PER_FETCH } from '../common/constants'
import { IndexerHostError, PerformanceMonitor, RateLimiter } from '../common/errors'
import { fetchTransactionDetails, storeTransactionsInDB } from './transactions.repository'

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
      IndexerHostError.logWarning('Rate limit reached for operations API')
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

      IndexerHostError.logInfo('Fetching operations from Horizon', baseParams)

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

      IndexerHostError.logSuccess(`Fetched ${operations.length} operations`)
      return operations
    } catch (error: any) {
      IndexerHostError.handleRpcError(error, 'fetchOperationsFromHorizon')
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
 * @function storeOperationsInDB
 * @param {Array} operations - Operations with contract mapping
 * @param {string[]} [contractIds] - Associated contract identifiers
 * @returns {Promise<number>} Count of stored operations
 */
export async function storeOperationsInDB(operations: any[], contractIds: string[] = []): Promise<number> {
  const db = await getDB()
  if (!db || operations.length === 0) return 0

  try {
    const BATCH_SIZE = 100
    let totalCreated = 0

    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const batch = operations.slice(i, i + BATCH_SIZE)

      for (const operation of batch) {
        try {
          // Determine which contract this operation is for
          const targetContractId =
            operation._contractId ||
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

          await db.horizonOperation.upsert({
            where: { operationId: operation.id },
            update: operationData,
            create: operationData,
          })
          totalCreated++
        } catch (opErr: any) {
          console.error('Error storing single contract operation:', opErr?.message || opErr)
          // continue with next operation
        }
      }
    }

    console.log(`✅ Created ${totalCreated} new contract operations.`)
    return totalCreated
  } catch (error) {
    console.error('❌ Error storing contract operations:', error)
    return 0
  }
}

/**
 * Fetches and stores contract operations from Horizon.
 *
 * Retrieves all operations for specified contracts using Horizon's
 * account-based queries. Fetches associated transaction details and
 * stores both operations and transactions in the database with proper
 * foreign key relationships.
 *
 * @async
 * @function fetchContractOperations
 * @param {string[]} [contractIds] - Target contract IDs (defaults to config)
 * @param {number} [startLedger] - Starting ledger for filtering
 * @param {boolean} [includeFailedTx] - Include failed transactions
 * @returns {Promise<Object>} Operation fetch results
 * @returns {Array} result.operations - Fetched operation records
 * @returns {Array} result.transactions - Associated transactions
 * @returns {Set} result.accounts - Unique account identifiers
 * @returns {Array} result.failedOperations - Failed operation records
 * @returns {number} result.operationsFetched - Total operations count
 * @returns {number} result.transactionsFetched - Total transactions count
 */
export async function fetchContractOperations(
  contractIds: string[] = CONTRACT_IDS_TO_INDEX,
  startLedger?: number,
  includeFailedTx?: boolean
): Promise<{
  operations: any[]
  transactions: any[]
  accounts: Set<string>
  failedOperations: any[]
  operationsFetched: number
  transactionsFetched: number
}> {
  const operations: any[] = []
  const accountsSet = new Set<string>()
  const failedOperations: any[] = []

  console.log(
    `🔍 Fetching contract operations for ${contractIds.length} contracts from ledger ${
      startLedger || 'latest'
    }`
  )

  // For each contract, fetch all operations using account-based queries
  // In Stellar, contracts are accounts, so we can fetch operations by account
  for (const contractId of contractIds) {
    try {
      console.log(`📋 Fetching operations for contract: ${contractId}`)

      const contractOps = await fetchOperationsFromHorizon({
        accountId: contractId, // Use accountId instead of contractId
        limit: MAX_OPERATIONS_PER_FETCH,
      })

      console.log(`✅ Found ${contractOps.length} operations for contract ${contractId}`)

      // Filter operations and extract accounts
      for (const op of contractOps) {
        if (op.source_account) {
          accountsSet.add(op.source_account)
        }

        // Check if operation was in a failed transaction
        const isFailedOp = !op.successful || op.transaction_successful === false
        if (isFailedOp) {
          failedOperations.push(op)
          // Only include failed operations in results if explicitly requested
          if (includeFailedTx) {
            operations.push(op)
          }
        } else {
          // Always include successful operations
          operations.push(op)
        }
      }
    } catch (error: any) {
      console.error(`❌ Error fetching operations for contract ${contractId}:`, error.message)
    }
  }

  // Get unique transaction hashes and fetch full transaction details
  const txHashes = [...new Set(operations.map((op) => op.transaction_hash).filter(Boolean))]
  console.log(`📦 Fetching ${txHashes.length} unique transactions for operations`)

  const txDetailsList: any[] = []
  for (const txHash of txHashes) {
    try {
      const txDetails = await fetchTransactionDetails(txHash as string)
      if (txDetails) {
        txDetailsList.push(txDetails)
      }
    } catch (error: any) {
      console.error(`❌ Error fetching transaction ${txHash}:`, error.message)
    }
  }

  // Ensure transactions are stored before operations (satisfy FK)
  if (txDetailsList.length > 0) {
    await storeTransactionsInDB(txDetailsList)
  }

  // Store contract operations in database with proper contract mapping
  if (operations.length > 0) {
    console.log(`💾 Storing ${operations.length} contract operations in database...`)

    // Add contract ID mapping to each operation before storing
    const operationsWithContract = operations.map((op) => ({
      ...op,
      _contractId:
        contractIds.find(
          (id) =>
            // The operation belongs to whichever contract account we fetched it from
            op.source_account === id || op.account === id || JSON.stringify(op).includes(id)
        ) || contractIds[0],
    }))

    const storedCount = await storeOperationsInDB(operationsWithContract, contractIds)
    console.log(`✅ Stored ${storedCount} contract operations successfully`)
  }

  // Use the original transactions array for return (operationsResult.transactions expected)
  const transactions = txDetailsList

  return {
    operations,
    transactions,
    accounts: accountsSet,
    failedOperations,
    operationsFetched: operations.length,
    transactionsFetched: transactions.length,
  }
}
