/**
 * Contract Transactions repository for registry action tracking.
 *
 * Provides data access layer for storing and retrieving contract transactions
 * from the database. This is a rollup table that tracks all registry actions
 * including schema registrations, attestation creation/revocation, and BLS key
 * registrations.
 *
 * Table: transactions (mapped from Transaction model in Prisma)
 * 
 * @module repository/contract-transactions
 * @requires common/db
 */

import { getDB } from '../common/db'

// TypeScript interface for contract transaction API response
export interface ContractTransaction {
  id: string
  action: string
  transactionHash: string
  timestamp: string
  sourceAccount: string
  contractId: string
  operationId?: string | null
  ledger?: number | null
  eventId?: string | null
  metadata?: any
  createdAt: string
  updatedAt: string
}

export interface ContractTransactionFilters {
  action?: string
  sourceAccount?: string
  contractId?: string
  ledger?: number
  startTime?: Date
  endTime?: Date
  limit?: number
  offset?: number
}

/**
 * Retrieves contract transactions with filtering and pagination.
 *
 * Queries the contract transactions rollup table with support for multiple
 * filter criteria and pagination. This provides a unified view of all
 * registry actions.
 */
export async function getContractTransactions(filters: ContractTransactionFilters = {}) {
  const db = await getDB()
  if (!db) {
    console.error('Database not available for getContractTransactions')
    return { transactions: [], total: 0 }
  }

  try {
    const {
      action,
      sourceAccount,
      contractId,
      ledger,
      startTime,
      endTime,
      limit = 50,
      offset = 0,
    } = filters

    // Build where clause
    const where: any = {}
    
    if (action) where.action = action
    if (sourceAccount) where.sourceAccount = sourceAccount
    if (contractId) where.contractId = contractId
    if (ledger !== undefined) where.ledger = ledger
    
    // Time range filtering
    if (startTime || endTime) {
      where.timestamp = {}
      if (startTime) where.timestamp.gte = startTime
      if (endTime) where.timestamp.lte = endTime
    }

    // Execute queries in parallel
    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: Math.min(limit, 200), // Enforce max limit
        skip: offset,
      }),
      db.transaction.count({ where }),
    ])

    console.log(`📋 Retrieved ${transactions.length} contract transactions (${total} total)`)
    return { transactions, total }
  } catch (error: any) {
    console.error('Error retrieving contract transactions:', error.message)
    return { transactions: [], total: 0 }
  }
}

/**
 * Retrieves a single contract transaction by event ID.
 *
 * Fetches specific transaction with full metadata.
 */
export async function getContractTransactionByEventId(eventId: string) {
  const db = await getDB()
  if (!db) {
    console.error('Database not available for getContractTransactionByEventId')
    return null
  }

  try {
    const transaction = await db.transaction.findUnique({
      where: { eventId },
    })

    if (transaction) {
      console.log(`📋 Retrieved contract transaction for event: ${eventId}`)
    } else {
      console.log(`❌ Contract transaction not found for event: ${eventId}`)
    }

    return transaction
  } catch (error: any) {
    console.error(`Error retrieving contract transaction for event ${eventId}:`, error.message)
    return null
  }
}

/**
 * Retrieves contract transactions by action type.
 *
 * Gets all transactions of a specific action type (e.g., SCHEMA:REGISTER).
 */
export async function getContractTransactionsByAction(action: string, limit: number = 100) {
  const db = await getDB()
  if (!db) {
    console.error('Database not available for getContractTransactionsByAction')
    return []
  }

  try {
    const transactions = await db.transaction.findMany({
      where: { action },
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 200),
    })

    console.log(`📋 Retrieved ${transactions.length} contract transactions for action: ${action}`)
    return transactions
  } catch (error: any) {
    console.error(`Error retrieving contract transactions for action ${action}:`, error.message)
    return []
  }
}

/**
 * Get contract transaction statistics by action type.
 *
 * Provides aggregated counts for each action type.
 */
export async function getContractTransactionStats() {
  const db = await getDB()
  if (!db) {
    console.error('Database not available for getContractTransactionStats')
    return []
  }

  try {
    const stats = await db.transaction.groupBy({
      by: ['action'],
      _count: {
        action: true,
      },
      orderBy: {
        _count: {
          action: 'desc',
        },
      },
    })

    const formattedStats = stats.map(stat => ({
      action: stat.action,
      count: stat._count.action,
    }))

    console.log(`📊 Contract transaction statistics:`, formattedStats)
    return formattedStats
  } catch (error: any) {
    console.error('Error retrieving contract transaction statistics:', error.message)
    return []
  }
}

/**
 * Get contract transactions for a specific account.
 *
 * Retrieves all registry actions performed by a specific account.
 */
export async function getContractTransactionsByAccount(
  sourceAccount: string,
  limit: number = 100
) {
  const db = await getDB()
  if (!db) {
    console.error('Database not available for getContractTransactionsByAccount')
    return []
  }

  try {
    const transactions = await db.transaction.findMany({
      where: { sourceAccount },
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 200),
    })

    console.log(`📋 Retrieved ${transactions.length} contract transactions for account: ${sourceAccount}`)
    return transactions
  } catch (error: any) {
    console.error(`Error retrieving contract transactions for account ${sourceAccount}:`, error.message)
    return []
  }
}

/**
 * Get recent contract transactions.
 *
 * Retrieves the most recent registry actions across all types.
 */
export async function getRecentContractTransactions(limit: number = 50) {
  const db = await getDB()
  if (!db) {
    console.error('Database not available for getRecentContractTransactions')
    return []
  }

  try {
    const transactions = await db.transaction.findMany({
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 200),
    })

    console.log(`📋 Retrieved ${transactions.length} recent contract transactions`)
    return transactions
  } catch (error: any) {
    console.error('Error retrieving recent contract transactions:', error.message)
    return []
  }
}

/**
 * Upsert contract transaction entry.
 *
 * Creates or updates a contract transaction record.
 */
export async function upsertContractTransaction(data: {
  eventId: string
  action: string
  transactionHash: string
  timestamp: Date
  sourceAccount: string
  contractId: string
  operationId?: string | null
  ledger?: number | null
  metadata?: any
}) {
  const db = await getDB()
  if (!db) {
    console.error('Database not available for upsertContractTransaction')
    return null
  }

  try {
    const transaction = await db.transaction.upsert({
      where: { eventId: data.eventId },
      update: {
        action: data.action,
        transactionHash: data.transactionHash,
        timestamp: data.timestamp,
        sourceAccount: data.sourceAccount,
        contractId: data.contractId,
        operationId: data.operationId,
        ledger: data.ledger,
        metadata: data.metadata,
        updatedAt: new Date(),
      },
      create: {
        eventId: data.eventId,
        action: data.action,
        transactionHash: data.transactionHash,
        timestamp: data.timestamp,
        sourceAccount: data.sourceAccount,
        contractId: data.contractId,
        operationId: data.operationId,
        ledger: data.ledger,
        metadata: data.metadata,
      },
    })

    console.log(`✅ Upserted contract transaction for ${data.action}: ${data.eventId}`)
    return transaction
  } catch (error: any) {
    console.error('Error upserting contract transaction:', error.message)
    return null
  }
}