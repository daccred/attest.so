/**
 * Data access router providing direct database query endpoints.
 *
 * Implements RESTful endpoints for accessing blockchain data stored in the
 * database. Provides paginated access to events, transactions, operations,
 * effects, contract data, accounts, and payments with flexible filtering options.
 *
 * @module router/data
 * @requires express
 * @requires common/db
 */

import { Router, Request, Response } from 'express'
import { getDB } from '../common/db'

const router = Router()

/**
 * GET /data/events - Query contract events with filtering and pagination.
 *
 * Retrieves stored contract events with support for filtering by contract,
 * event type, and ledger range. Results include associated transaction data
 * and are paginated for efficient data transfer.
 *
 * @route GET /data/events
 * @param {string} [contractId] - Filter events by contract ID
 * @param {string} [eventType] - Filter by specific event type
 * @param {string} [limit='50'] - Results per page (max: 200)
 * @param {string} [offset='0'] - Pagination offset
 * @param {string} [ledgerStart] - Minimum ledger sequence number
 * @param {string} [ledgerEnd] - Maximum ledger sequence number
 * @param {string} [cursor] - Pagination cursor (future use)
 * @returns {Object} Paginated event response
 * @returns {boolean} response.success - Operation success indicator
 * @returns {Array} response.data - Event records with transaction details
 * @returns {Object} response.pagination - Pagination metadata
 * @returns {number} response.pagination.total - Total matching records
 * @returns {number} response.pagination.limit - Applied page size
 * @returns {number} response.pagination.offset - Current offset
 * @returns {boolean} response.pagination.hasMore - More pages available
 * @status 200 - Success with event data
 * @status 503 - Database unavailable
 * @status 500 - Internal server error
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const db = await getDB()
    if (!db) {
      return res.status(503).json({ error: 'Database not available' })
    }

    const {
      contractId,
      eventType,
      limit = '50',
      offset = '0',
      ledgerStart,
      ledgerEnd,
      cursor,
    } = req.query

    const where: any = {}
    if (contractId) where.contractId = contractId as string
    if (eventType) where.eventType = eventType as string
    if (ledgerStart) where.ledger = { gte: parseInt(ledgerStart as string) }
    if (ledgerEnd) where.ledger = { ...where.ledger, lte: parseInt(ledgerEnd as string) }

    const events = await db.horizonEvent.findMany({
      where,
      include: {
        transaction: true,
      },
      orderBy: { timestamp: 'asc' as const },
      take: Math.min(parseInt(limit as string), 200),
      skip: parseInt(offset as string),
    })

    const total = await db.horizonEvent.count({ where })

    res.json({
      success: true,
      data: events,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + events.length,
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /data/transactions - Query blockchain transactions.
 *
 * Provides access to transaction records with comprehensive filtering options
 * including hash lookup, account filtering, and success status. Returns full
 * transaction details including associated events, effects, and payments.
 *
 * @route GET /data/transactions
 * @param {string} [hash] - Filter by transaction hash
 * @param {string} [sourceAccount] - Filter by source account
 * @param {string} [successful] - Filter by success status ('true'/'false')
 * @param {string} [limit='50'] - Results per page (max: 200)
 * @param {string} [offset='0'] - Pagination offset
 * @param {string} [ledgerStart] - Minimum ledger sequence
 * @param {string} [ledgerEnd] - Maximum ledger sequence
 * @returns {Object} Paginated transaction response with full details
 * @status 200 - Success with transaction data
 * @status 503 - Database unavailable
 * @status 500 - Internal server error
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const db = await getDB()
    if (!db) {
      return res.status(503).json({ error: 'Database not available' })
    }

    const {
      hash,
      sourceAccount,
      successful,
      limit = '50',
      offset = '0',
      ledgerStart,
      ledgerEnd,
    } = req.query

    const where: any = {}
    if (hash) where.hash = hash as string
    if (sourceAccount) where.sourceAccount = sourceAccount as string
    if (successful !== undefined) where.successful = successful === 'true'
    if (ledgerStart) where.ledger = { gte: parseInt(ledgerStart as string) }
    if (ledgerEnd) where.ledger = { ...where.ledger, lte: parseInt(ledgerEnd as string) }

    const transactions = await db.horizonTransaction.findMany({
      where,
      include: {
        events: true,
        effects: true,
        payments: true,
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(parseInt(limit as string), 200),
      skip: parseInt(offset as string),
    })

    const total = await db.horizonTransaction.count({ where })

    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + transactions.length,
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /data/operations - Query contract operations.
 *
 * Retrieves contract operation records with filtering by transaction,
 * contract, operation type, and source account. Includes related transaction
 * and event data for comprehensive operation context.
 *
 * @route GET /data/operations
 * @param {string} [transactionHash] - Filter by parent transaction
 * @param {string} [contractId] - Filter by contract ID
 * @param {string} [type] - Filter by operation type
 * @param {string} [sourceAccount] - Filter by source account
 * @param {string} [limit='50'] - Results per page (max: 200)
 * @param {string} [offset='0'] - Pagination offset
 * @returns {Object} Paginated operations response
 * @status 200 - Success with operation data
 * @status 503 - Database unavailable
 * @status 500 - Internal server error
 */
router.get('/operations', async (req: Request, res: Response) => {
  try {
    const db = await getDB()
    if (!db) {
      return res.status(503).json({ error: 'Database not available' })
    }

    const {
      transactionHash,
      contractId,
      type,
      sourceAccount,
      limit = '50',
      offset = '0',
    } = req.query

    const where: any = {}
    if (transactionHash) where.transactionHash = transactionHash as string
    if (contractId) where.contractId = contractId as string
    if (type) where.type = type as string
    if (sourceAccount) where.sourceAccount = sourceAccount as string

    const operations = await db.horizonContractOperation.findMany({
      where,
      include: {
        transaction: true,
        events: true,
      },
      orderBy: { ingestedAt: 'desc' },
      take: Math.min(parseInt(limit as string), 200),
      skip: parseInt(offset as string),
    })

    const total = await db.horizonContractOperation.count({ where })

    res.json({
      success: true,
      data: operations,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + operations.length,
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /data/effects - Query operation effects.
 *
 * Retrieves operation effects representing state changes from blockchain
 * operations. Includes balance changes, trustline modifications, and
 * other ledger state transitions with transaction context.
 *
 * @route GET /data/effects
 * @param {string} [operationId] - Filter by parent operation
 * @param {string} [transactionHash] - Filter by transaction
 * @param {string} [account] - Filter by affected account
 * @param {string} [type] - Filter by effect type
 * @param {string} [limit='50'] - Results per page (max: 200)
 * @param {string} [offset='0'] - Pagination offset
 * @returns {Object} Paginated effects response
 * @status 200 - Success with effect data
 * @status 503 - Database unavailable
 * @status 500 - Internal server error
 */
router.get('/effects', async (req: Request, res: Response) => {
  try {
    const db = await getDB()
    if (!db) {
      return res.status(503).json({ error: 'Database not available' })
    }

    const { operationId, transactionHash, account, type, limit = '50', offset = '0' } = req.query

    const where: any = {}
    if (operationId) where.operationId = operationId as string
    if (transactionHash) where.transactionHash = transactionHash as string
    if (account) where.account = account as string
    if (type) where.type = type as string

    const effects = await db.horizonEffect.findMany({
      where,
      include: {
        transaction: true,
      },
      orderBy: { ingestedAt: 'desc' },
      take: Math.min(parseInt(limit as string), 200),
      skip: parseInt(offset as string),
    })

    const total = await db.horizonEffect.count({ where })

    res.json({
      success: true,
      data: effects,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + effects.length,
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /data/contract-data - Query contract storage data.
 *
 * Accesses contract storage entries with support for key-based queries,
 * durability filtering, and historical data retrieval. Can return either
 * the latest state or full historical versions of contract data.
 *
 * @route GET /data/contract-data
 * @param {string} [contractId] - Filter by contract ID
 * @param {string} [key] - Filter by storage key
 * @param {string} [durability] - Filter by durability type
 * @param {string} [latest='true'] - Return only latest values
 * @param {string} [limit='50'] - Results per page (max: 200)
 * @param {string} [offset='0'] - Pagination offset
 * @returns {Object} Contract data response with storage entries
 * @status 200 - Success with contract data
 * @status 503 - Database unavailable
 * @status 500 - Internal server error
 */
router.get('/contract-data', async (req: Request, res: Response) => {
  try {
    const db = await getDB()
    if (!db) {
      return res.status(503).json({ error: 'Database not available' })
    }

    const { contractId, key, durability, latest = 'true', limit = '50', offset = '0' } = req.query

    const where: any = {}
    if (contractId) where.contractId = contractId as string
    if (key) where.key = key as string
    if (durability) where.durability = durability as string
    if (latest === 'true') where.isDeleted = false

    let contractData
    if (latest === 'true') {
      // Get latest version of each key
      contractData = await db.horizonContractData.findMany({
        where,
        orderBy: { ledger: 'asc' as const },
        take: Math.min(parseInt(limit as string), 200),
        skip: parseInt(offset as string),
        distinct: ['contractId', 'key'],
      })
    } else {
      // Get all historical versions
      contractData = await db.horizonContractData.findMany({
        where,
        orderBy: { ledger: 'desc' },
        take: Math.min(parseInt(limit as string), 200),
        skip: parseInt(offset as string),
      })
    }

    const total = await db.horizonContractData.count({ where })

    res.json({
      success: true,
      data: contractData,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + contractData.length,
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /data/accounts - Query blockchain accounts.
 *
 * Retrieves account records including regular accounts and contract accounts.
 * Tracks account activity, contract associations, and last activity timestamps
 * for account lifecycle monitoring.
 *
 * @route GET /data/accounts
 * @param {string} [accountId] - Filter by account ID
 * @param {string} [isContract] - Filter by contract status ('true'/'false')
 * @param {string} [limit='50'] - Results per page (max: 200)
 * @param {string} [offset='0'] - Pagination offset
 * @returns {Object} Paginated accounts response
 * @status 200 - Success with account data
 * @status 503 - Database unavailable
 * @status 500 - Internal server error
 */
router.get('/accounts', async (req: Request, res: Response) => {
  try {
    const db = await getDB()
    if (!db) {
      return res.status(503).json({ error: 'Database not available' })
    }

    const { accountId, isContract, limit = '50', offset = '0' } = req.query

    const where: any = {}
    if (accountId) where.accountId = accountId as string
    if (isContract !== undefined) where.isContract = isContract === 'true'

    const accounts = await db.horizonAccount.findMany({
      where,
      orderBy: { lastActivity: 'desc' },
      take: Math.min(parseInt(limit as string), 200),
      skip: parseInt(offset as string),
    })

    const total = await db.horizonAccount.count({ where })

    res.json({
      success: true,
      data: accounts,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + accounts.length,
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /data/payments - Query payment operations.
 *
 * Retrieves payment records including transfers between accounts with
 * asset details, amounts, and transaction associations. Supports filtering
 * by sender, receiver, and transaction for payment tracking.
 *
 * @route GET /data/payments
 * @param {string} [from] - Filter by sender account
 * @param {string} [to] - Filter by receiver account
 * @param {string} [transactionHash] - Filter by transaction
 * @param {string} [limit='50'] - Results per page (max: 200)
 * @param {string} [offset='0'] - Pagination offset
 * @returns {Object} Paginated payments response
 * @status 200 - Success with payment data
 * @status 503 - Database unavailable
 * @status 500 - Internal server error
 */
router.get('/payments', async (req: Request, res: Response) => {
  try {
    const db = await getDB()
    if (!db) {
      return res.status(503).json({ error: 'Database not available' })
    }

    const { from, to, transactionHash, limit = '50', offset = '0' } = req.query

    const where: any = {}
    if (from) where.from = from as string
    if (to) where.to = to as string
    if (transactionHash) where.transactionHash = transactionHash as string

    const payments = await db.horizonPayment.findMany({
      where,
      include: {
        transaction: true,
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(parseInt(limit as string), 200),
      skip: parseInt(offset as string),
    })

    const total = await db.horizonPayment.count({ where })

    res.json({
      success: true,
      data: payments,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + payments.length,
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
