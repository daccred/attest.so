/**
 * Data ingestion control router for managing blockchain synchronization.
 *
 * Provides endpoints for triggering and monitoring blockchain data ingestion
 * processes. Supports manual triggering, queue management, and comprehensive
 * data collection operations for maintaining database synchronization with
 * the blockchain.
 *
 * @module router/ingest
 * @requires express
 * @requires common/queue
 * @requires repository/contracts
 * @requires common/constants
 */

import { Router, Request, Response } from 'express'
import { ingestQueue } from '../common/queue'
import { fetchContractComprehensiveData } from '../repository/contracts.repository'
import { CONTRACT_IDS_TO_INDEX } from '../common/constants'

// Route constants for ingest endpoints
const INGEST_EVENTS_ROUTE = '/events'
const INGEST_BACKFILL_ROUTE = '/backfill'
const INGEST_FULL_ROUTE = '/full'

const router = Router()

/**
 * POST /ingest/events - Enqueue event-only ingestion job.
 *
 * Fetches only contract events from the blockchain. Lightweight ingestion
 * focused on event data without operations or transaction details.
 * Returns the job ID for tracking purposes.
 *
 * @route POST /ingest/events
 * @param {number} [startLedger] - Starting ledger sequence
 * @param {number} [endLedger] - Ending ledger sequence (optional)
 * @returns {Object} Queue job response
 * @returns {boolean} response.success - Operation success indicator
 * @returns {string} response.jobId - Unique job identifier
 * @returns {string} response.message - Status message
 * @status 202 - Job enqueued successfully
 * @status 400 - Invalid parameters
 * @status 500 - Failed to enqueue job
 */
router.post(INGEST_EVENTS_ROUTE, async (req: Request, res: Response) => {
  try {
    const startLedgerParam = req.body.startLedger
    let startLedgerFromRequest: number | undefined = undefined

    if (startLedgerParam !== undefined) {
      startLedgerFromRequest = parseInt(startLedgerParam)
      if (isNaN(startLedgerFromRequest)) {
        return res.status(400).json({ error: 'Invalid startLedger parameter. Must be a number.' })
      }
    }

    let endLedgerFromRequest: number | undefined = undefined
    if (req.body.endLedger !== undefined) {
      endLedgerFromRequest = parseInt(req.body.endLedger)
      if (isNaN(endLedgerFromRequest)) {
        return res.status(400).json({ error: 'Invalid endLedger parameter. Must be a number.' })
      }
    }

    const jobId = ingestQueue.enqueueFetchEvents(startLedgerFromRequest, {
      endLedger: endLedgerFromRequest,
    })
    res.status(202).json({
      success: true,
      message: `Event ingestion job enqueued. Requested start ledger: ${
        startLedgerFromRequest === undefined ? 'latest from DB/default' : startLedgerFromRequest
      }. ${
        endLedgerFromRequest && endLedgerFromRequest > 0
          ? `End ledger: ${endLedgerFromRequest}.`
          : 'End ledger: unbounded.'
      }`,
      jobId,
    })
  } catch (error: any) {
    res
      .status(500)
      .json({ success: false, error: error.message || 'Failed to enqueue event ingestion' })
  }
})

/**
 * POST /ingest/backfill - Trigger historical data backfill.
 *
 * Initiates a complete historical data synchronization for all contracts.
 * Fetches events, operations, transactions, and accounts. Runs directly
 * (non-queued) for immediate backfill operations.
 *
 * @route POST /ingest/backfill
 * @param {number} [startLedger] - Starting ledger sequence
 * @param {number} [endLedger] - Ending ledger sequence (optional)
 * @returns {Object} Backfill initiation response
 * @returns {boolean} response.success - Operation success indicator
 * @returns {string} response.message - Status message with tracking info
 * @status 202 - Backfill initiated successfully
 * @status 400 - Invalid parameters
 * @status 500 - Failed to initiate backfill
 */
router.post(INGEST_BACKFILL_ROUTE, async (req: Request, res: Response) => {
  try {
    const startLedgerParam = req.body.startLedger
    let startLedgerFromRequest: number | undefined = undefined

    if (startLedgerParam !== undefined) {
      startLedgerFromRequest = parseInt(startLedgerParam)
      if (isNaN(startLedgerFromRequest)) {
        return res.status(400).json({ error: 'Invalid startLedger parameter. Must be a number.' })
      }
    }

    let endLedgerFromRequest: number | undefined = undefined
    if (req.body.endLedger !== undefined) {
      endLedgerFromRequest = parseInt(req.body.endLedger)
      if (isNaN(endLedgerFromRequest)) {
        return res.status(400).json({ error: 'Invalid endLedger parameter. Must be a number.' })
      }
    }

    // Non-blocking: Trigger comprehensive data ingestion
    fetchContractComprehensiveData(startLedgerFromRequest)
      .then(async (result: any) => {
        console.log('Comprehensive data ingestion completed:', {
          events: result.events.length,
          operations: result.operations.length,
          transactions: result.transactions.length,
          accounts: result.accounts.size,
          failedOperations: result.failedOperations.length,
        })
      })
      .catch((err: Error) => console.error('Comprehensive data ingestion failed:', err.message))

    res.status(202).json({
      success: true,
      message: `Historical data backfill initiated. Requested start ledger: ${
        startLedgerFromRequest === undefined ? 'latest from DB/default' : startLedgerFromRequest
      }. ${
        endLedgerFromRequest && endLedgerFromRequest > 0
          ? `End ledger: ${endLedgerFromRequest}.`
          : 'End ledger: unbounded.'
      } Check server logs for progress.`,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate historical data backfill',
    })
  }
})

/**
 * POST /ingest/full - Enqueue full data synchronization job.
 *
 * Queues a comprehensive data collection job that fetches events, operations,
 * transactions, and account data for specified contracts. This is the most
 * complete ingestion option, suitable for ongoing synchronization.
 *
 * @route POST /ingest/full
 * @param {number} [startLedger] - Starting ledger sequence
 * @param {number} [endLedger] - Ending ledger sequence (optional)
 * @param {string[]} [contractIds] - Target contract IDs (defaults to config)
 * @returns {Object} Full sync job response
 * @returns {boolean} response.success - Operation success indicator
 * @returns {string} response.jobId - Unique job identifier
 * @returns {string} response.message - Status message
 * @returns {string[]} response.contractIds - Target contracts
 * @returns {string} response.dataTypes - Data types being collected
 * @status 202 - Job enqueued successfully
 * @status 400 - Invalid parameters
 * @status 500 - Failed to enqueue job
 */
router.post(INGEST_FULL_ROUTE, async (req: Request, res: Response) => {
  try {
    const { startLedger, contractIds } = req.body

    const targetContractIds = contractIds || CONTRACT_IDS_TO_INDEX
    let startLedgerFromRequest: number | undefined = undefined

    if (startLedger !== undefined) {
      startLedgerFromRequest = parseInt(startLedger)
      if (isNaN(startLedgerFromRequest)) {
        return res.status(400).json({ error: 'Invalid startLedger parameter. Must be a number.' })
      }
    }

    let endLedgerFromRequest: number | undefined = undefined
    if (req.body.endLedger !== undefined) {
      endLedgerFromRequest = parseInt(req.body.endLedger)
      if (isNaN(endLedgerFromRequest)) {
        return res.status(400).json({ error: 'Invalid endLedger parameter. Must be a number.' })
      }
    }

    const jobId = ingestQueue.enqueueComprehensiveData(targetContractIds, startLedgerFromRequest, {
      endLedger: endLedgerFromRequest,
    })

    res.status(202).json({
      success: true,
      message: `Full data synchronization job enqueued for ${
        targetContractIds.length
      } contracts. Start ledger: ${startLedgerFromRequest || 'latest'}.`,
      jobId,
      contractIds: targetContractIds,
      dataTypes: 'events, operations, transactions, accounts',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to enqueue full data synchronization',
    })
  }
})

export default router
