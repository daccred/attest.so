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
import {
  fetchContractComprehensiveData,
  fetchContractOperations,
} from '../repository/contracts.repository'
import { CONTRACT_IDS } from '../common/constants'

const router = Router()

/**
 * POST /ingest/events - Enqueue event ingestion job.
 *
 * Adds an event fetching job to the processing queue for asynchronous
 * execution. Supports configuration of retry attempts and initial delay.
 * Returns the job ID for tracking purposes.
 *
 * @route POST /ingest/events
 * @param {number} [startLedger] - Starting ledger sequence
 * @returns {Object} Queue job response
 * @returns {boolean} response.success - Operation success indicator
 * @returns {string} response.jobId - Unique job identifier
 * @returns {string} response.message - Status message
 * @status 202 - Job enqueued successfully
 * @status 400 - Invalid parameters
 * @status 500 - Failed to enqueue job
 */
router.post('/events', async (req: Request, res: Response) => {
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
 * POST /ingest/comprehensive - Trigger comprehensive data collection.
 *
 * Initiates a complete data synchronization process that fetches events,
 * operations, and transactions for specified contracts. Runs asynchronously
 * and provides status updates via server logs.
 *
 * @route POST /ingest/comprehensive
 * @param {number} [startLedger] - Starting ledger sequence
 * @returns {Object} Ingestion initiation response
 * @returns {boolean} response.success - Operation success indicator
 * @returns {string} response.message - Status message with tracking info
 * @status 202 - Collection initiated successfully
 * @status 400 - Invalid parameters
 * @status 500 - Failed to initiate collection
 */
router.post('/comprehensive', async (req: Request, res: Response) => {
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
      message: `Comprehensive data ingestion initiated. Requested start ledger: ${
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
      error: error.message || 'Failed to initiate comprehensive data ingestion',
    })
  }
})

/**
 * POST /ingest/contracts/operations - Enqueue contract operations ingestion.
 *
 * Queues a job to fetch operations for specified contracts with support
 * for failed transaction inclusion and custom starting ledger. Returns
 * job ID for tracking and monitoring purposes.
 *
 * @route POST /ingest/contracts/operations
 * @param {number} [startLedger] - Starting ledger sequence
 * @param {string[]} [contractIds] - Target contract IDs (defaults to config)
 * @param {boolean} [includeFailedTx=true] - Include failed transactions
 * @returns {Object} Operation ingestion job response
 * @returns {boolean} response.success - Operation success indicator
 * @returns {string} response.jobId - Unique job identifier
 * @returns {string} response.message - Status message
 * @returns {string[]} response.contractIds - Target contracts
 * @status 202 - Job enqueued successfully
 * @status 400 - Invalid parameters
 * @status 500 - Failed to enqueue job
 */
router.post('/contracts/operations', async (req: Request, res: Response) => {
  try {
    const { startLedger, contractIds, includeFailedTx = true } = req.body

    const targetContractIds = contractIds || CONTRACT_IDS
    let startLedgerFromRequest: number | undefined = undefined

    if (startLedger !== undefined) {
      startLedgerFromRequest = parseInt(startLedger)
      if (isNaN(startLedgerFromRequest)) {
        return res.status(400).json({ error: 'Invalid startLedger parameter. Must be a number.' })
      }
    }

    const jobId = ingestQueue.enqueueContractOperations(targetContractIds, startLedgerFromRequest, {
      includeFailedTx,
    })

    res.status(202).json({
      success: true,
      message: `Contract operations ingestion job enqueued for ${
        targetContractIds.length
      } contracts. Start ledger: ${startLedgerFromRequest || 'latest'}.`,
      jobId,
      contractIds: targetContractIds,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to enqueue contract operations ingestion',
    })
  }
})

/**
 * POST /ingest/contracts/comprehensive - Enqueue comprehensive contract data job.
 *
 * Queues a comprehensive data collection job that fetches events, operations,
 * transactions, and account data for specified contracts. Provides detailed
 * tracking information and strategy confirmation.
 *
 * @route POST /ingest/contracts/comprehensive
 * @param {number} [startLedger] - Starting ledger sequence
 * @param {string[]} [contractIds] - Target contract IDs (defaults to config)
 * @returns {Object} Comprehensive ingestion job response
 * @returns {boolean} response.success - Operation success indicator
 * @returns {string} response.jobId - Unique job identifier
 * @returns {string} response.message - Status message
 * @returns {string[]} response.contractIds - Target contracts
 * @returns {string} response.strategy - Collection strategy description
 * @status 202 - Job enqueued successfully
 * @status 400 - Invalid parameters
 * @status 500 - Failed to enqueue job
 */
router.post('/contracts/comprehensive', async (req: Request, res: Response) => {
  try {
    const { startLedger, contractIds } = req.body

    const targetContractIds = contractIds || CONTRACT_IDS
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
      message: `Comprehensive contract data ingestion job enqueued for ${
        targetContractIds.length
      } contracts. Start ledger: ${startLedgerFromRequest || 'latest'}.`,
      jobId,
      contractIds: targetContractIds,
      strategy: 'events + operations + transactions + accounts',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to enqueue comprehensive contract data ingestion',
    })
  }
})

export default router
