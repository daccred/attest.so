/**
 * Dedicated backfill repository for efficient historical data synchronization.
 *
 * Provides isolated backfill logic that processes events, transactions, and operations
 * in a sequential manner to avoid database transaction timeouts. Uses individual upserts
 * for each entry rather than large batched transactions, ensuring progress is maintained
 * even if individual operations fail.
 *
 * @module repository/backfill
 * @requires @stellar/stellar-sdk
 * @requires common/constants
 * @requires common/db
 */

import { rpc, scValToNative, xdr } from '@stellar/stellar-sdk'
import {
  sorobanRpcUrl,
  CONTRACT_IDS_TO_INDEX,
  MAX_EVENTS_PER_FETCH,
} from '../common/constants'
import { getDB, updateLastProcessedLedgerInDB } from '../common/db'
import { fetchTransactionDetails } from './transactions.repository'
import { fetchOperationsFromHorizon } from './operations.repository'

const sorobanServer = new rpc.Server(sorobanRpcUrl, {
  allowHttp: sorobanRpcUrl.startsWith('http://'),
})

/**
 * Result interface for backfill operations.
 */
interface BackfillResult {
  success: boolean
  message: string
  eventsProcessed: number
  transactionsProcessed: number
  operationsProcessed: number
  processedUpToLedger: number
  errors: string[]
}

/**
 * Individual event data structure for processing.
 */
interface EventData {
  eventId: string
  ledger: number
  contractId: string
  eventType: string
  eventData: any
  timestamp: string
  transactionHash: string
}

/**
 * Performs isolated backfill with individual upserts to avoid transaction timeouts.
 * 
 * This approach processes events sequentially:
 * 1. Fetch events from RPC in batches
 * 2. For each event, immediately upsert to database
 * 3. Fetch and upsert corresponding transaction
 * 4. Fetch and upsert corresponding operations
 * 5. Update ledger checkpoint after each successful batch
 *
 * @async
 * @function performBackfill
 * @param {number} [startLedger] - Starting ledger sequence
 * @param {number} [endLedger] - Ending ledger sequence (optional)
 * @returns {Promise<BackfillResult>} Backfill results with statistics
 */
export async function performBackfill(
  startLedger?: number,
  endLedger?: number
): Promise<BackfillResult> {
  console.log('🚀 Starting isolated backfill process...')
  
  const db = await getDB()
  if (!db) {
    return {
      success: false,
      message: 'Database connection failed',
      eventsProcessed: 0,
      transactionsProcessed: 0,
      operationsProcessed: 0,
      processedUpToLedger: 0,
      errors: ['Failed to connect to database']
    }
  }

  if (!CONTRACT_IDS_TO_INDEX || CONTRACT_IDS_TO_INDEX.length === 0) {
    return {
      success: false,
      message: 'No contracts configured for indexing',
      eventsProcessed: 0,
      transactionsProcessed: 0,
      operationsProcessed: 0,
      processedUpToLedger: 0,
      errors: ['CONTRACT_IDS_TO_INDEX is empty']
    }
  }

  let eventsProcessed = 0
  let transactionsProcessed = 0
  let operationsProcessed = 0
  let processedUpToLedger = startLedger || 0
  const errors: string[] = []

  try {
    // Get RPC ledger info
    const latestLedger = await sorobanServer.getLatestLedger()
    if (!latestLedger || typeof latestLedger.sequence !== 'number') {
      throw new Error('Failed to get latest ledger from RPC')
    }

    const targetEndLedger = endLedger || latestLedger.sequence
    console.log(`📋 Backfilling from ledger ${startLedger} to ${targetEndLedger}`)

    // Fetch events in batches
    let currentStartLedger = startLedger || 1
    let nextCursor: string | undefined = undefined
    let iterationCount = 0

    while (currentStartLedger <= targetEndLedger && iterationCount < 50) { // Safety limit
      iterationCount++
      console.log(`📅 Batch ${iterationCount}: Processing from ledger ${currentStartLedger}`)

      // Prepare RPC request
      const eventsRequestParams: any = {
        filters: [{ type: 'contract', contractIds: CONTRACT_IDS_TO_INDEX, topics: [] }],
        pagination: { limit: MAX_EVENTS_PER_FETCH },
      }

      if (nextCursor) {
        eventsRequestParams.pagination.cursor = nextCursor
      } else {
        eventsRequestParams.startLedger = Math.max(1, currentStartLedger)
      }

      // Fetch events from RPC
      const rpcResponse = await fetch(sorobanRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `backfill-${iterationCount}-${Date.now()}`,
          method: 'getEvents',
          params: eventsRequestParams,
        }),
      })

      const rpcData = await rpcResponse.json()
      if (rpcData.error) {
        errors.push(`RPC error: ${rpcData.error.message}`)
        break
      }

      const eventsResponse = rpcData.result
      const events = eventsResponse.events || []
      nextCursor = eventsResponse.latestLedger ? undefined : eventsResponse.cursor

      if (events.length === 0) {
        console.log('📭 No more events found')
        break
      }

      console.log(`📦 Processing ${events.length} events...`)

      // Process each event individually
      for (const event of events) {

        try {
          const eventData = parseEventData(event)

          console.log(`=============== Event data ===============`)
          console.log({eventData})
          console.log(`=============== Event data ===============`)
          
          // 1. Fetch and upsert transaction FIRST (required for foreign key)
          if (eventData.transactionHash) {
            const success = await processTransactionForEvent(db, eventData.transactionHash)
            if (success) transactionsProcessed++
          }

          // 2. Upsert event after transaction exists
          await upsertEventIndividually(db, eventData)
          eventsProcessed++

          // 3. Fetch and upsert operations for this transaction
          const opsCount = await processOperationsForEvent(db, eventData.transactionHash)
          operationsProcessed += opsCount

          // Update processed ledger checkpoint
          if (eventData.ledger > processedUpToLedger) {
            processedUpToLedger = eventData.ledger
          }

        } catch (error: any) {
          errors.push(`Error processing event ${event.id}: ${error.message}`)
          console.error(`❌ Error processing event:`, error.message)
        }
      }

      // Update ledger checkpoint after successful batch
      if (processedUpToLedger > 0) {
        await updateLastProcessedLedgerInDB(processedUpToLedger)
        console.log(`✅ Updated ledger checkpoint to ${processedUpToLedger}`)
      }

      // Break if we've reached end ledger
      if (endLedger && processedUpToLedger >= endLedger) {
        break
      }

      // Update current start ledger for next iteration
      if (!nextCursor) {
        currentStartLedger = processedUpToLedger + 1
      }
    }

    const message = `Backfill completed: ${eventsProcessed} events, ${transactionsProcessed} transactions, ${operationsProcessed} operations processed up to ledger ${processedUpToLedger}`
    console.log(`🎉 ${message}`)

    return {
      success: true,
      message,
      eventsProcessed,
      transactionsProcessed,
      operationsProcessed,
      processedUpToLedger,
      errors
    }

  } catch (error: any) {
    const errorMessage = `Backfill failed: ${error.message}`
    console.error(`❌ ${errorMessage}`)
    errors.push(errorMessage)

    return {
      success: false,
      message: errorMessage,
      eventsProcessed,
      transactionsProcessed,
      operationsProcessed,
      processedUpToLedger,
      errors
    }
  }
}

/**
 * Parse raw event data from RPC response into structured format.
 */
function parseEventData(rawEvent: any): EventData {
 
  return {
    eventId: rawEvent.id,
    ledger: rawEvent.ledger,
    contractId: rawEvent.contractId,
    eventType: rawEvent.topic?.[0] || 'unknown',
    // eventTopic: rawEvent.topic?.[0] || 'unknown',
    // inSuccessfulContractCall: rawEvent.inSuccessfulContractCall,
    eventData: scValToNative(xdr.ScVal.fromXDR(rawEvent.value, 'base64')),
    timestamp: rawEvent.ledgerClosedAt,
    transactionHash: rawEvent.txHash,
  }
}

/**
 * Upsert individual event to database with transaction details.
 */
async function upsertEventIndividually(db: any, eventData: EventData): Promise<void> {
  // Fetch transaction details to get envelope data
  let txDetails: any = null
  try {
    if (eventData.transactionHash) {
      txDetails = await fetchTransactionDetails(eventData.transactionHash)
    }
  } catch (error: any) {
    console.warn(`Failed to fetch tx details for ${eventData.transactionHash}:`, error.message)
  }

  const eventRecord = {
    eventId: eventData.eventId,
    ledger: eventData.ledger,
    contractId: eventData.contractId,
    eventType: eventData.eventType,
    eventData: eventData.eventData,
    timestamp: new Date(eventData.timestamp),
    txHash: eventData.transactionHash,
    txEnvelope: txDetails?.envelope_xdr || txDetails?.envelopeXdr || txDetails?.envelope || '',
    txResult: txDetails?.result_xdr || txDetails?.resultXdr || txDetails?.result || '',
    txMeta: txDetails?.result_meta_xdr || txDetails?.resultMetaXdr || txDetails?.meta || '',
    txFeeBump: Boolean(txDetails?.fee_bump || txDetails?.feeBump),
    txStatus: txDetails?.status || 'unknown',
    txCreatedAt: txDetails?.created_at ? new Date(txDetails.created_at) : new Date(eventData.timestamp),
    updatedAt: new Date(),
  }

  await db.horizonEvent.upsert({
    where: { eventId: eventData.eventId },
    update: {
      ledger: eventRecord.ledger,
      contractId: eventRecord.contractId,
      eventType: eventRecord.eventType,
      eventData: eventRecord.eventData,
      timestamp: eventRecord.timestamp,
      txHash: eventRecord.txHash,
      txEnvelope: eventRecord.txEnvelope,
      txResult: eventRecord.txResult,
      txMeta: eventRecord.txMeta,
      txFeeBump: eventRecord.txFeeBump,
      txStatus: eventRecord.txStatus,
      txCreatedAt: eventRecord.txCreatedAt,
    },
    create: {
      eventId: eventRecord.eventId,
      ledger: eventRecord.ledger,
      contractId: eventRecord.contractId,
      eventType: eventRecord.eventType,
      eventData: eventRecord.eventData,
      timestamp: eventRecord.timestamp,
      txHash: eventRecord.txHash,
      txEnvelope: eventRecord.txEnvelope,
      txResult: eventRecord.txResult,
      txMeta: eventRecord.txMeta,
      txFeeBump: eventRecord.txFeeBump,
      txStatus: eventRecord.txStatus,
      txCreatedAt: eventRecord.txCreatedAt,
    },
  })
}

/**
 * Process and upsert transaction for an event.
 */
async function processTransactionForEvent(db: any, transactionHash: string): Promise<boolean> {
  try {
    const txDetails = await fetchTransactionDetails(transactionHash)
    if (!txDetails) return false

    console.log(`=============== Processing transaction ===============`)
    console.log({txDetails})
    console.log(`=============== Processing transaction ===============`)

    // The hash might not be in the response, use the one we passed in
    const hash = transactionHash
    
    // Parse transaction details from RPC response
    const ledger = txDetails.ledger || 0
    const sourceAccount = txDetails.sourceAccount || ''
    const fee = txDetails.feeSoroban || txDetails.fee || '0'
    const operationCount = txDetails.operations?.length || 1
    const envelope = txDetails.envelopeXdr || txDetails.envelope || ''
    const meta = txDetails.resultMetaXdr || txDetails.meta || ''
    // const envelope = scValToNative(xdr.TransactionEnvelope.fromXDR(txDetails.envelopeXdr || txDetails.envelope || '', 'base64')) || ''
    // const meta = scValToNative(xdr.ScVal.fromXDR(txDetails.resultMetaXdr || txDetails.meta || '', 'base64')) || ''
    // const result = JSON.stringify(xdr.TransactionResult.fromXDR(txDetails.resultXdr || txDetails.result || '', 'base64').result().results().values())
    const result = txDetails.resultXdr || txDetails.result || ''
    const successful = txDetails.status === 'SUCCESS' || txDetails.status === 'success'
    // Handle Unix timestamp conversion (both createdAt and ledgerCloseTime are Unix timestamps in seconds)
    const createdAtTimestamp = parseInt(txDetails.createdAt || txDetails.ledgerCloseTime || '0', 10)
    const createdAt = createdAtTimestamp > 0 ? new Date(createdAtTimestamp * 1000) : new Date()

    await db.horizonTransaction.upsert({
      where: { hash: hash },
      update: {
        ledger: ledger,
        sourceAccount: sourceAccount,
        fee: fee,
        operationCount: operationCount,
        envelope: "envelope.toJSON(),",
        result: result,
        meta: meta,
        successful: successful,
        timestamp: createdAt,
      },
      create: {
        hash: hash,
        ledger: ledger,
        sourceAccount: sourceAccount,
        fee: fee,
        operationCount: operationCount,
        envelope: envelope,
        result: result,
        meta: meta,
        successful: successful,
        timestamp: createdAt,
      },
    })

    return true
  } catch (error: any) {
    console.error(`❌ Error processing transaction ${transactionHash}:`, error.message)
    return false
  }
}

/**
 * Process and upsert operations for a transaction.
 */
async function processOperationsForEvent(db: any, transactionHash: string): Promise<number> {
  let count = 0
  
  try {
    // Note: We could optimize this by getting operations directly from transaction details
    // For now, using existing operation fetching logic
    
    for (const contractId of CONTRACT_IDS_TO_INDEX) {
      try {
        const operations = await fetchOperationsFromHorizon({
          accountId: contractId,

          limit: 50, // Smaller batch size
        })

        // Filter operations for this specific transaction
        const txOperations = operations.filter(op => op.transaction_hash === transactionHash)

        for (const operation of txOperations) {
          await db.horizonOperation.upsert({
            where: { operationId: operation.id },
            update: {
              contractId: contractId,
              operationType: operation.type_i,
              transactionHash: operation.transaction_hash,
              sourceAccount: operation.source_account,
              updatedAt: new Date(),
            },
            create: {
              operationId: operation.id,
              contractId: contractId,
              operationType: operation.type_i,
              transactionHash: operation.transaction_hash,
              sourceAccount: operation.source_account,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          })
          count++
        }
      } catch (error: any) {
        console.error(`❌ Error processing operations for contract ${contractId}:`, error.message)
      }
    }

    return count
  } catch (error: any) {
    console.error(`❌ Error processing operations for transaction ${transactionHash}:`, error.message)
    return count
  }
}