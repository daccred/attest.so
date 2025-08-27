/**
 * Analytics API router providing aggregated metrics and insights.
 *
 * Offers comprehensive analytics endpoints for monitoring blockchain activity,
 * contract performance, and real-time event feeds. Supports time-based filtering,
 * contract-specific queries, and activity aggregation across multiple dimensions.
 *
 * @module router/analytics
 * @requires express
 * @requires common/db
 * @requires common/constants
 */

import { Router, Request, Response } from 'express'
import { getDB } from '../common/db'
import { CONTRACT_IDS } from '../common/constants'

const router = Router()

/**
 * GET /analytics - General analytics endpoint with time-based aggregation.
 *
 * Retrieves aggregated metrics for blockchain activity within specified timeframes.
 * Calculates event totals, transaction success rates, and event distribution by type.
 * Supports filtering by contract ID and customizable time windows.
 *
 * @route GET /analytics
 * @param {string} [contractId] - Filter metrics to specific contract
 * @param {string} [timeframe='24h'] - Time window: '1h', '24h', '7d', or '30d'
 * @returns {Object} Analytics response object
 * @returns {boolean} response.success - Operation success indicator
 * @returns {string} response.timeframe - Applied timeframe filter
 * @returns {Object} response.data - Analytics data
 * @returns {Object} response.data.summary - Aggregated metrics summary
 * @returns {number} response.data.summary.totalEvents - Total event count
 * @returns {number} response.data.summary.totalTransactions - Total transaction count
 * @returns {number} response.data.summary.successfulTransactions - Successful transaction count
 * @returns {string} response.data.summary.successRate - Calculated success percentage
 * @returns {Array} response.data.eventsByType - Event distribution by type
 * @returns {Object} response.data.fees - Fee analytics (currently null)
 * @status 200 - Success with analytics data
 * @status 503 - Database unavailable
 * @status 500 - Internal server error
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const db = await getDB()
    if (!db) {
      return res.status(503).json({ error: 'Database not available' })
    }

    const { contractId, timeframe = '24h' } = req.query

    // Calculate time range
    const now = new Date()
    const timeRanges: { [key: string]: Date } = {
      '1h': new Date(now.getTime() - 60 * 60 * 1000),
      '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    }

    const startTime = timeRanges[timeframe as string] || timeRanges['24h']

    const where: any = {
      timestamp: { gte: startTime },
    }
    if (contractId) where.contractId = contractId as string

    // Get analytics data
    const [totalEvents, totalTransactions, successfulTxs, eventsByType] = await Promise.all([
      db.horizonEvent.count({ where }),
      db.horizonTransaction.count({
        where: {
          timestamp: { gte: startTime },
          ...(contractId && { events: { some: { contractId: contractId as string } } }),
        },
      }),
      db.horizonTransaction.count({
        where: {
          timestamp: { gte: startTime },
          successful: true,
          ...(contractId && { events: { some: { contractId: contractId as string } } }),
        },
      }),
      db.horizonEvent.groupBy({
        by: ['eventType'],
        where,
        _count: { eventType: true },
      }),
    ])

    res.json({
      success: true,
      timeframe,
      data: {
        summary: {
          totalEvents,
          totalTransactions,
          successfulTransactions: successfulTxs,
          successRate:
            totalTransactions > 0
              ? ((successfulTxs / totalTransactions) * 100).toFixed(2) + '%'
              : '0%',
        },
        eventsByType: eventsByType.map((et: any) => ({
          type: et.eventType,
          count: et._count.eventType,
        })),
        fees: {
          average: null,
          total: null,
        },
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /analytics/contracts - Contract-specific analytics dashboard.
 *
 * Provides detailed analytics for specified contracts including operation counts,
 * success rates, unique user metrics, and recent activity indicators. Supports
 * bulk contract analysis with aggregated summary statistics.
 *
 * @route GET /analytics/contracts
 * @param {string|string[]} [contractIds] - Contract IDs to analyze (defaults to CONFIG)
 * @returns {Object} Contract analytics response
 * @returns {boolean} response.success - Operation success indicator
 * @returns {Array} response.data - Per-contract analytics array
 * @returns {string} response.data[].contractId - Contract identifier
 * @returns {Object} response.data[].operations - Operation metrics
 * @returns {number} response.data[].operations.total - Total operation count
 * @returns {number} response.data[].operations.successful - Successful operations
 * @returns {number} response.data[].operations.failed - Failed operations
 * @returns {string} response.data[].operations.successRate - Success percentage
 * @returns {Object} response.data[].users - User engagement metrics
 * @returns {number} response.data[].users.unique - Unique user count
 * @returns {Object} response.data[].activity - Activity indicators
 * @returns {number} response.data[].activity.eventsLast24h - Recent event count
 * @returns {Object} response.summary - Aggregated summary across all contracts
 * @status 200 - Success with contract analytics
 * @status 503 - Database unavailable
 * @status 500 - Internal server error
 */
router.get('/contracts', async (req: Request, res: Response) => {
  try {
    const db = await getDB()
    if (!db) {
      return res.status(503).json({ error: 'Database not available' })
    }

    const { contractIds = CONTRACT_IDS } = req.query
    const targetContractIds = Array.isArray(contractIds) ? contractIds : [contractIds]

    const analytics = await Promise.all(
      (targetContractIds as string[]).map(async (contractId: string) => {
        const [totalOperations, successfulOperations, uniqueUsers, recentEvents, failedOperations] =
          await Promise.all([
            db.horizonOperation.count({ where: { contractId } }),
            db.horizonOperation.count({ where: { contractId, successful: true } }),
            db.horizonOperation
              .findMany({
                where: { contractId },
                select: { sourceAccount: true },
                distinct: ['sourceAccount'],
              })
              .then((ops: any[]) => ops.length),
            db.horizonEvent.count({
              where: {
                contractId,
                timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
              },
            }),
            db.horizonOperation.count({ where: { contractId, successful: false } }),
          ])

        return {
          contractId,
          operations: {
            total: totalOperations,
            successful: successfulOperations,
            failed: failedOperations,
            successRate:
              totalOperations > 0
                ? ((successfulOperations / totalOperations) * 100).toFixed(2) + '%'
                : '0%',
          },
          users: {
            unique: uniqueUsers,
          },
          activity: {
            eventsLast24h: recentEvents,
          },
        }
      })
    )

    res.json({
      success: true,
      data: analytics,
      summary: {
        totalContracts: targetContractIds.length,
        totalOperations: analytics.reduce((sum: number, a: any) => sum + a.operations.total, 0),
        totalUsers: analytics.reduce((sum: number, a: any) => sum + a.users.unique, 0),
        averageSuccessRate:
          analytics.length > 0
            ? (
                analytics.reduce(
                  (sum: number, a: any) => sum + parseFloat(a.operations.successRate),
                  0
                ) / analytics.length
              ).toFixed(2) + '%'
            : '0%',
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /analytics/activity - Real-time activity feed aggregator.
 *
 * Retrieves and consolidates recent blockchain activity including events,
 * transactions, and payments. Supports filtering by contract, account, and
 * activity type with configurable result limits. Results are sorted by
 * timestamp in descending order for real-time monitoring.
 *
 * @route GET /analytics/activity
 * @param {string} [contractId] - Filter to specific contract
 * @param {string} [accountId] - Filter to specific account
 * @param {string} [limit='20'] - Maximum results to return (max: 50)
 * @param {string} [includeTransactions='true'] - Include transaction records
 * @param {string} [includeEvents='true'] - Include event records
 * @param {string} [includePayments='true'] - Include payment records
 * @returns {Object} Activity feed response
 * @returns {boolean} response.success - Operation success indicator
 * @returns {Array} response.data - Chronologically sorted activity items
 * @returns {string} response.data[].type - Activity type: 'event', 'transaction', 'payment'
 * @returns {string} response.data[].id - Unique activity identifier
 * @returns {Date} response.data[].timestamp - Activity timestamp
 * @returns {number} response.count - Total activities returned
 * @status 200 - Success with activity data
 * @status 503 - Database unavailable
 * @status 500 - Internal server error
 */
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const db = await getDB()
    if (!db) {
      return res.status(503).json({ error: 'Database not available' })
    }

    const {
      contractId,
      accountId,
      limit = '20',
      includeTransactions = 'true',
      includeEvents = 'true',
      includePayments = 'true',
    } = req.query

    const activities: any[] = []

    // Fetch recent events
    if (includeEvents === 'true') {
      const where: any = {}
      if (contractId) where.contractId = contractId as string

      const events = await db.horizonEvent.findMany({
        where,
        include: { transaction: true },
        orderBy: { timestamp: 'desc' },
        take: Math.min(parseInt(limit as string), 50),
      })

      activities.push(
        ...events.map((e: any) => ({
          type: 'event',
          id: e.eventId,
          timestamp: e.timestamp,
          contractId: e.contractId,
          eventType: e.eventType,
          data: e.eventData,
          transaction: e.transaction,
        }))
      )
    }

    // Fetch recent transactions
    if (includeTransactions === 'true') {
      const where: any = {}
      if (contractId) where.events = { some: { contractId: contractId as string } }
      if (accountId) where.sourceAccount = accountId as string

      const transactions = await db.horizonTransaction.findMany({
        where,
        include: { events: true },
        orderBy: { timestamp: 'desc' },
        take: Math.min(parseInt(limit as string), 50),
      })

      activities.push(
        ...transactions.map((t: any) => ({
          type: 'transaction',
          id: t.hash,
          timestamp: t.timestamp,
          sourceAccount: t.sourceAccount,
          successful: t.successful,
          fee: t.fee,
          operationCount: t.operationCount,
          events: t.events,
        }))
      )
    }

    // Fetch recent payments
    if (includePayments === 'true' && accountId) {
      const payments = await db.horizonPayment.findMany({
        where: {
          OR: [{ from: accountId as string }, { to: accountId as string }],
        },
        include: { transaction: true },
        orderBy: { timestamp: 'desc' },
        take: Math.min(parseInt(limit as string), 50),
      })

      activities.push(
        ...payments.map((p: any) => ({
          type: 'payment',
          id: p.paymentId,
          timestamp: p.timestamp,
          from: p.from,
          to: p.to,
          asset: p.asset,
          amount: p.amount,
          transaction: p.transaction,
        }))
      )
    }

    // Sort all activities by timestamp
    activities.sort(
      (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    res.json({
      success: true,
      data: activities.slice(0, parseInt(limit as string)),
      count: activities.length,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
