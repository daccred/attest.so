/**
 * System management router for application health and configuration.
 *
 * Provides endpoints for system health checks, configuration management,
 * and operational status monitoring. Essential for deployment health
 * monitoring and debugging production issues.
 *
 * @module router/system
 * @requires express
 * @requires common/queue
 * @requires repository/rpc
 * @requires common/db
 * @requires common/prisma
 * @requires common/constants
 */

import { Router, Request, Response } from 'express'
import { ingestQueue } from '../common/queue'
import { getRpcHealth, getLatestRPCLedgerIndex } from '../repository/rpc.repository'
import { getLastProcessedLedgerFromDB, getDB } from '../common/db'
import { connectToPostgreSQL } from '../common/prisma'
import { STELLAR_NETWORK, CONTRACT_IDS_TO_INDEX, CONTRACT_ID_TO_INDEX } from '../common/constants'

// Route constants for system endpoints
const SYSTEM_QUEUE_STATUS_ROUTE = '/queue/status'
const SYSTEM_HEALTH_ROUTE = '/health'

const router = Router()

/**
 * GET /system/queue/status - Retrieve ingestion queue status.
 *
 * Provides current queue state including pending job count, processing
 * status, and details of upcoming jobs. Useful for monitoring queue
 * health and debugging ingestion issues.
 *
 * @route GET /system/queue/status
 * @returns {Object} Queue status response
 * @returns {boolean} response.success - Operation success indicator
 * @returns {Object} response.queue - Queue state details
 * @returns {number} response.queue.size - Pending job count
 * @returns {boolean} response.queue.running - Queue active status
 * @returns {Array} response.queue.nextJobs - Upcoming job details
 * @status 200 - Status retrieved successfully
 * @status 500 - Failed to get status
 */
router.get(SYSTEM_QUEUE_STATUS_ROUTE, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, queue: ingestQueue.getStatus() })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /system/health - Application health check endpoint.
 *
 * Performs comprehensive health assessment including database connectivity,
 * RPC endpoint status, and configuration validation. Provides detailed status
 * information for monitoring and alerting systems with automatic reconnection
 * attempts for degraded services.
 *
 * @route GET /system/health
 * @returns {Object} Health status response
 * @returns {string} response.status - Overall health: 'ok' or 'error'
 * @returns {string} response.database_status - Database connection status
 * @returns {string} response.soroban_rpc_status - RPC endpoint status
 * @returns {string} response.network - Stellar network identifier
 * @returns {string|number} response.latest_rpc_ledger - Latest RPC ledger or 'Not Available'
 * @returns {string} response.indexing_contract - Contract being indexed or 'Not Set'
 * @returns {number} response.last_processed_ledger_in_db - Last processed ledger
 * @returns {boolean} response.db_connection_explicitly_attempted_in_health_check - Reconnection attempted
 * @status 200 - System healthy (may include warnings)
 * @status 500 - System unhealthy with errors
 */
router.get(SYSTEM_HEALTH_ROUTE, async (req: Request, res: Response) => {
  console.log('---------------- HEALTH CHECK REQUEST (system.router.ts) ----------------')
  let dbStatus = 'disconnected'
  let rpcStatus = 'unknown'
  let lastLedgerDb = 0
  let dbConnectionAttempted = false

  try {
    let db = await getDB()
    if (db) {
      try {
        await db.$queryRaw`SELECT 1`
        dbStatus = 'connected'
        lastLedgerDb = await getLastProcessedLedgerFromDB()
      } catch (dbPingErr: any) {
        console.warn(
          'Health check: PostgreSQL ping failed after DB instance succeeded.',
          dbPingErr.message
        )
        dbStatus = 'ping_failed'
      }
    } else {
      console.warn('Health check: DB instance undefined. Attempting explicit connect.')
      dbConnectionAttempted = true
      const connected = await connectToPostgreSQL()
      if (connected) {
        db = await getDB() // try getting it again
        if (db) {
          try {
            await db.$queryRaw`SELECT 1`
            dbStatus = 'connected_after_retry'
            lastLedgerDb = await getLastProcessedLedgerFromDB()
          } catch (dbPingRetryErr: any) {
            console.warn(
              'Health check: PostgreSQL ping failed after explicit reconnect attempt.',
              dbPingRetryErr.message
            )
            dbStatus = 'ping_failed_after_retry'
          }
        } else {
          console.warn('Health check: DB still undefined after explicit reconnect attempt.')
          dbStatus = 'reconnect_attempt_db_undefined'
        }
      } else {
        console.warn('Health check: Explicit connectToPostgreSQL call failed.')
        dbStatus = 'reconnect_failed'
      }
    }

    rpcStatus = await getRpcHealth()
    const latestRPCLedger = await getLatestRPCLedgerIndex()
    res.status(200).json({
      status: 'ok',
      database_status: dbStatus,
      soroban_rpc_status: rpcStatus,
      network: STELLAR_NETWORK,
      latest_rpc_ledger: latestRPCLedger || 'Not Available',
      indexing_contracts: CONTRACT_IDS_TO_INDEX,
      indexing_contract_legacy: CONTRACT_ID_TO_INDEX || 'Not Set',
      last_processed_ledger_in_db: lastLedgerDb,
      db_connection_explicitly_attempted_in_health_check: dbConnectionAttempted,
    })
  } catch (error: any) {
    console.error('Health check critical error:', error.message)
    res.status(500).json({
      status: 'error',
      database_status: dbStatus,
      soroban_rpc_status: rpcStatus,
      error: error.message,
      db_connection_explicitly_attempted_in_health_check: dbConnectionAttempted,
    })
  }
  console.log('------------------------------------------------------')
})

export default router
