import { Router, Request, Response } from 'express'
import { getDB } from '../common/db'
import { CONTRACT_IDS } from '../common/constants'

const router = Router()

// Analytics API
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

// Contract Analytics Dashboard API
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
            db.horizonContractOperation.count({ where: { contractId } }),
            db.horizonContractOperation.count({ where: { contractId, successful: true } }),
            db.horizonContractOperation
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
            db.horizonContractOperation.count({ where: { contractId, successful: false } }),
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

// Real-time Activity Feed API
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
