/**
 * Contract data repository for Soroban smart contract interactions.
 * 
 * Provides data access layer for contract-related operations including
 * fetching contract data from Soroban RPC, retrieving contract operations
 * from Horizon, and comprehensive data synchronization. Handles both
 * real-time and historical data collection with database persistence.
 * 
 * @module repository/contracts
 * @requires common/constants
 * @requires common/db
 * @requires repository/operations
 * @requires repository/events
 * @requires repository/transactions
 */

import { sorobanRpcUrl, CONTRACT_IDS, MAX_OPERATIONS_PER_FETCH } from '../common/constants'
import { getDB } from '../common/db'
import { fetchOperationsFromHorizon, storeContractOperationsInDB } from './operations.repository'
import { fetchAndStoreEvents } from './events.repository'
import { fetchTransactionDetails, storeTransactionsInDB } from './transactions.repository'

/**
 * Fetches contract storage data directly from Soroban RPC.
 * 
 * Retrieves specific contract data entries using the Soroban RPC
 * getLedgerEntries method. Supports both persistent and temporary
 * storage durability types. Returns null if data not found or on error.
 * 
 * @async
 * @function fetchContractDataFromSoroban
 * @param {Object} params - Query parameters
 * @param {string} params.contractId - Target contract ID
 * @param {string} params.key - Storage key to retrieve
 * @param {string} [params.durability='persistent'] - Storage durability type
 * @returns {Promise<Object|null>} Contract data entry or null
 */
export async function fetchContractDataFromSoroban(params: {
  contractId: string
  key: string
  durability?: 'persistent' | 'temporary'
}): Promise<any | null> {
  const { contractId, key, durability = 'persistent' } = params

  try {
    const rpcPayload = {
      jsonrpc: '2.0',
      id: `getContractData-${Date.now()}`,
      method: 'getLedgerEntries',
      params: {
        keys: [
          {
            type: 'contractData',
            contractId,
            key,
            durability,
          },
        ],
      },
    }

    console.log(
      `Fetching contract data for ${contractId}/${key}:`,
      JSON.stringify(rpcPayload, null, 2)
    )

    const response = await fetch(sorobanRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcPayload),
    })

    if (!response.ok) {
      throw new Error(`Contract data request failed: ${response.status}`)
    }

    const data = await response.json()
    if (data.error) {
      console.error('RPC error fetching contract data:', data.error)
      return null
    }

    return data.result?.entries?.[0] || null
  } catch (error: any) {
    console.error(`Error fetching contract data for ${contractId}/${key}:`, error.message)
    return null
  }
}

/**
 * Stores contract data entries in the database.
 * 
 * Persists contract storage data with support for versioning and
 * change tracking. Uses database transactions for consistency and
 * handles updates for existing entries.
 * 
 * @async
 * @function storeContractDataInDB
 * @param {Array} contractData - Array of contract data entries
 * @returns {Promise<void>} Completes when storage is done
 */
export async function storeContractDataInDB(contractData: any[]) {
  const db = await getDB()
  if (!db || contractData.length === 0) return

  try {
    const results = await db.$transaction(async (prismaTx) => {
      const data = contractData.map(async (item) => {
        const dataEntry = {
          contractId: item.contract_id,
          key: item.key,
          value: item.val,
          durability: item.durability || 'persistent',
          ledger: item.ledger || 0,
          timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
          previousValue: item.previous_val || null,
          isDeleted: Boolean(item.deleted),
        }

        return prismaTx.horizonContractData.upsert({
          where: {
            contractId_key_ledger: {
              contractId: item.contract_id,
              key: item.key,
              ledger: item.ledger || 0,
            },
          },
          update: dataEntry,
          create: dataEntry,
        })
      })

      return Promise.all(data)
    })

    console.log(`Stored ${results.length} contract data entries.`)
  } catch (error) {
    console.error('Error storing contract data:', error)
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
  contractIds: string[] = CONTRACT_IDS,
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

      operations.push(...contractOps)

      // Extract unique accounts and track failed operations
      for (const op of contractOps) {
        if (op.source_account) {
          accountsSet.add(op.source_account)
        }

        // Check if operation was in a failed transaction
        if (!op.successful || op.transaction_successful === false) {
          failedOperations.push(op)
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

    const storedCount = await storeContractOperationsInDB(operationsWithContract, contractIds)
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

/**
 * Performs comprehensive data collection for contracts.
 * 
 * Orchestrates complete data synchronization including events, operations,
 * and transactions. Combines multiple data sources and provides detailed
 * statistics about the collection process. Useful for initial sync or
 * comprehensive updates.
 * 
 * @async
 * @function fetchContractComprehensiveData
 * @param {number} [startLedger] - Starting ledger sequence
 * @param {string[]} [contractIds] - Target contracts (defaults to config)
 * @returns {Promise<Object>} Comprehensive collection results
 * @returns {Array} result.events - Collected event records
 * @returns {Array} result.operations - Collected operations
 * @returns {Array} result.transactions - Collected transactions
 * @returns {Set} result.accounts - Involved account set
 * @returns {Array} result.failedOperations - Failed operations
 * @returns {Object} result.summary - Collection statistics
 * @returns {number} result.summary.eventsFetched - Event count
 * @returns {number} result.summary.operationsFetched - Operation count
 * @returns {number} result.summary.transactionsFetched - Transaction count
 * @returns {number} result.summary.accountsInvolved - Unique accounts
 * @returns {number} result.summary.failedOperations - Failed count
 * @returns {number} result.summary.processedUpToLedger - Last ledger
 */
export async function fetchContractComprehensiveData(
  startLedger?: number,
  contractIds: string[] = CONTRACT_IDS
): Promise<{
  events: any[]
  operations: any[]
  transactions: any[]
  accounts: Set<string>
  failedOperations: any[]
  summary: {
    eventsFetched: number
    operationsFetched: number
    transactionsFetched: number
    accountsInvolved: number
    failedOperations: number
    processedUpToLedger: number
  }
}> {
  console.log(
    `🚀 Starting comprehensive contract data collection for ${contractIds.length} contracts`
  )
  console.log(`📋 Contracts: ${contractIds.join(', ')}`)

  // 1. Fetch events using existing event-based approach (for events with data)
  console.log('📅 Step 1: Fetching contract events...')
  const eventsResult = await fetchAndStoreEvents(startLedger)
  const events: any[] = [] // We'll need to query the DB for events to get them in the right format

  // 2. Fetch all contract operations (including those without events)
  console.log('⚙️ Step 2: Fetching contract operations...')
  const operationsResult = await fetchContractOperations(contractIds, startLedger, true)

  // 3. Combine transaction data from both sources
  console.log('🔗 Step 3: Consolidating transaction data...')
  const allTransactionHashes = new Set([
    ...operationsResult.transactions.map((tx) => tx.hash || tx.txHash),
  ])

  // 4. Identify accounts involved in contract interactions
  const allAccounts = new Set([...operationsResult.accounts])

  console.log(`✅ Comprehensive data collection completed:`)
  console.log(`   - Events fetched: ${eventsResult.eventsFetched}`)
  console.log(`   - Operations fetched: ${operationsResult.operationsFetched}`)
  console.log(`   - Transactions processed: ${allTransactionHashes.size}`)
  console.log(`   - Accounts involved: ${allAccounts.size}`)
  console.log(`   - Failed operations: ${operationsResult.failedOperations.length}`)

  return {
    events,
    operations: operationsResult.operations,
    transactions: operationsResult.transactions,
    accounts: allAccounts,
    failedOperations: operationsResult.failedOperations,
    summary: {
      eventsFetched: eventsResult.eventsFetched,
      operationsFetched: operationsResult.operationsFetched,
      transactionsFetched: allTransactionHashes.size,
      accountsInvolved: allAccounts.size,
      failedOperations: operationsResult.failedOperations.length,
      processedUpToLedger: eventsResult.processedUpToLedger,
    },
  }
}
