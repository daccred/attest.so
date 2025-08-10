import { Router, Request, Response } from 'express'
import { ingestQueue } from '../common/queue'
import {
  fetchContractComprehensiveData,
  fetchContractOperations,
} from '../repository/contracts.repository'
import { CONTRACT_IDS } from '../common/constants'

const router = Router()

// Legacy Event Ingestion API
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

    const jobId = ingestQueue.enqueueFetchEvents(startLedgerFromRequest)
    res.status(202).json({
      success: true,
      message: `Event ingestion job enqueued. Requested start ledger: ${
        startLedgerFromRequest === undefined ? 'latest from DB/default' : startLedgerFromRequest
      }.`,
      jobId,
    })
  } catch (error: any) {
    res
      .status(500)
      .json({ success: false, error: error.message || 'Failed to enqueue event ingestion' })
  }
})

// Comprehensive Data Ingest API
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
      }. Check server logs for progress.`,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate comprehensive data ingestion',
    })
  }
})

// Enhanced Contract-Specific Operations Ingestion
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

// Enhanced Comprehensive Contract Data Ingestion
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

    const jobId = ingestQueue.enqueueComprehensiveData(targetContractIds, startLedgerFromRequest)

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
