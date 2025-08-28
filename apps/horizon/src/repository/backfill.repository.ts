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
  getHorizonBaseUrl,
} from '../common/constants'
import { getDB, updateLastProcessedLedgerInDB } from '../common/db'
import { fetchTransactionDetails } from './transactions.repository'
import { fetchOperationsFromHorizon } from './operations.repository'
import { singleUpsertSchema } from './schemas.repository'
import { singleUpsertAttestation } from './attestations.repository'
import { upsertContractTransaction } from './contract-transactions.repository'

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
  inSuccessfulContractCall?: string
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

      // Process each event individually, but in correct order
      // Priority events we want to track: schemas first, then attestations, then BLS keys, then others
      const parsedEvents = events.map((event: any) => parseEventData(event))
      
      // Debug: Log all event types found
      const eventTypeCounts: Record<string, number> = {}
      parsedEvents.forEach((e: any) => {
        eventTypeCounts[e.eventType] = (eventTypeCounts[e.eventType] || 0) + 1
      })
      console.log('📊 Event types found:', eventTypeCounts)
      
      // Specific event types in priority order
      const schemaEvents = parsedEvents.filter((e: any) => 
        e.eventType === 'SCHEMA:REGISTER' || e.eventType === 'SCHEMA:CREATE'
      )
      const attestationEvents = parsedEvents.filter((e: any) => 
        e.eventType === 'ATTEST:CREATE' || e.eventType === 'ATTEST:REVOKE'
      )
      const blsKeyEvents = parsedEvents.filter((e: any) => 
        e.eventType === 'BLS_KEY:REGISTER' || e.eventType.includes('BLS_KEY')
      )
      const otherEvents = parsedEvents.filter((e: any) => 
        e.eventType !== 'SCHEMA:REGISTER' && e.eventType !== 'SCHEMA:CREATE' &&
        e.eventType !== 'ATTEST:CREATE' && e.eventType !== 'ATTEST:REVOKE' &&
        !e.eventType.includes('BLS_KEY')
      )

      console.log(`📋 Event filtering results: schemas=${schemaEvents.length}, attestations=${attestationEvents.length}, blsKeys=${blsKeyEvents.length}, others=${otherEvents.length}`)

      // Process in order: schemas first, then attestations, then BLS keys, then others
      const orderedEvents = [...schemaEvents, ...attestationEvents, ...blsKeyEvents, ...otherEvents]

      for (const eventData of orderedEvents) {
        try {
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
          errors.push(`Error processing event ${eventData.eventId}: ${error.message}`)
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

  console.log('=============== Raw event ===============')
  console.log({rawEvent})
  console.log('=============== Raw event ===============')
 
  return {
    eventId: rawEvent.id,
    ledger: rawEvent.ledger,
    contractId: rawEvent.contractId,
    /** @example ATTEST:CREATE we are using the colon as a separator for the event type */
    eventType: Array.from(rawEvent.topic).map((t: any) => scValToNative(xdr.ScVal.fromXDR(t, 'base64'))).join(':'),
    // eventTopic: rawEvent.topic?.[0] || 'unknown',
    inSuccessfulContractCall: rawEvent.inSuccessfulContractCall,
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

  // Registry projection based on decoded eventType and eventData
  try {
    const type = eventData.eventType || ''
    const val = eventData.eventData

    // Create ContractTransaction entry for tracking registry actions
    try {
      // Get operation details for source account
      const operations = await db.horizonOperation.findMany({
        where: { transactionHash: eventData.transactionHash },
        orderBy: { operationIndex: 'asc' },
        take: 1,
      })
      
      const sourceAccount = operations[0]?.sourceAccount || txDetails?.sourceAccount || ''
      const operationId = operations[0]?.operationId || null

      // Create ContractTransaction rollup entry using the repository function
      await upsertContractTransaction({
        eventId: eventData.eventId,
        action: type,
        transactionHash: eventData.transactionHash,
        timestamp: new Date(eventData.timestamp),
        sourceAccount,
        contractId: eventData.contractId,
        operationId,
        ledger: eventData.ledger,
        metadata: val,
      })
      console.log(`📊 Created ContractTransaction for ${type} - ${eventData.eventId}`)
    } catch (txnError: any) {
      console.warn(`Warning: Could not create ContractTransaction for ${eventData.eventId}:`, txnError.message)
    }

    // Helper: normalize bytes (Buffer | Uint8Array | JSON {type:'Buffer',data:number[]}| string) to base64 string
    const toBase64 = (input: any): string | undefined => {
      try {
        if (!input) return undefined
        if (typeof input === 'string') return input
        if (typeof Buffer !== 'undefined') {
          if (Buffer.isBuffer(input)) return Buffer.from(input).toString('base64')
          if (input?.type === 'Buffer' && Array.isArray(input?.data)) {
            return Buffer.from(input.data).toString('base64')
          }
          if (input instanceof Uint8Array) return Buffer.from(input).toString('base64')
        }
      } catch {}
      return undefined
    }

    // Helper: decode a base64 XDR ScVal to native
    const decodeScVal = (b64: string): any => {
      try { return scValToNative(xdr.ScVal.fromXDR(b64, 'base64')) } catch { return null }
    }

    // Helper: fetch and decode operation parameters for this tx
    const getDecodedOpParamsForTx = async () => {
      const ops = await db.horizonOperation.findMany({
        where: { transactionHash: eventData.transactionHash },
        orderBy: { operationIndex: 'asc' },
      })
      let params: any[] = []
      if (ops && ops.length > 0) {
        const first = ops[0]
        params = Array.isArray(first.parameters) ? (first.parameters as any[]) : []
        return params.map((p: any) => ({
          type: p?.type,
          raw: p?.value,
          decoded: typeof p?.value === 'string' ? decodeScVal(p.value) : p?.value,
        }))
      }
      // Fallback to Horizon HTTP
      try {
        const httpOps = await fetchOperationsForTransaction(eventData.transactionHash)
        if (httpOps && httpOps.length > 0) {
          const firstHttp = httpOps[0]
          params = Array.isArray(firstHttp.parameters) ? firstHttp.parameters : []
          return params.map((p: any) => ({
            type: p?.type,
            raw: p?.value,
            decoded: typeof p?.value === 'string' ? decodeScVal(p.value) : p?.value,
          }))
        }
      } catch {}
      return [] as any[]
    }

    // SCHEMA register
    if (type === 'SCHEMA:REGISTER' && Array.isArray(val)) {
      console.log('🧩 [Projection] SCHEMA register event', { eventId: eventData.eventId, type, sample: typeof val[0], hasObj: typeof val[1] })
      // schemaUid is published in event value (first element). It may be a base64 XDR bytes or Buffer-like
      let schemaUid = typeof val[0] === 'string' ? val[0] : toBase64(val[0])
      const schemaObj = typeof val[1] === 'object' ? val[1] : undefined
      if (!schemaUid) {
        // Fallback: derive from op params if present
        const params = await getDecodedOpParamsForTx()
        // For schema register, the Str definition is in params[3], authority in params[2]
        // Some chains may include schema_uid in params Map; ignore unless present
        const mapParam = params.find((p) => p.type === 'Map')
        const maybeUid = toBase64(mapParam?.decoded?.schema_uid)
        if (maybeUid) schemaUid = maybeUid
      }
      if (schemaUid && schemaObj) {
        const defString = typeof schemaObj.definition === 'string'
          ? schemaObj.definition
          : JSON.stringify(schemaObj.definition ?? {})
        await singleUpsertSchema({
          uid: schemaUid,
          ledger: eventData.ledger,
          schemaDefinition: defString,
          parsedSchemaDefinition: (() => { try { return JSON.parse(defString) } catch { return undefined } })(),
          resolverAddress: schemaObj.resolver ?? null,
          revocable: schemaObj.revocable !== false,
          deployerAddress: schemaObj.authority || txDetails?.sourceAccount || '',
          type: 'default',
          transactionHash: eventData.transactionHash,
        })
      } else {
        console.log('⚠️ [Projection] SCHEMA missing expected fields', { schemaUidType: typeof val[0], objType: typeof val[1] })
      }
    }

    // ATTEST create
    if (type === 'ATTEST:CREATE' && Array.isArray(val)) {
      console.log('🧩 [Projection] ATTEST create event', { eventId: eventData.eventId, type })
      // Get operation parameters - they're individual typed parameters, not a Map
      const params = await getDecodedOpParamsForTx()
      console.log('📋 [Debug] Operation parameters:', JSON.stringify(params, null, 2))

      // Helper to convert Buffer to hex string for schema UID
      const bufferToHex = (buffer: any): string => {
        if (buffer?.type === 'Buffer' && Array.isArray(buffer.data)) {
          return Buffer.from(buffer.data).toString('hex')
        }
        if (Buffer.isBuffer(buffer)) {
          return buffer.toString('hex')
        }
        return buffer
      }

      // Extract data from individual parameters based on contract call structure
      // Based on the debug output: [contractId, function, attester, schemaUid, subject, message, ...]
      const schemaUidParam = params[3]?.decoded // Bytes parameter containing schema UID
      const attesterParam = params[2]?.decoded  // Address parameter for attester
      const subjectParam = params[4]?.decoded   // Address parameter for subject
      const messageParam = params[5]?.decoded   // String parameter for message

      const attestationUid = typeof val[0] === 'string' ? val[0] : toBase64(val[0]) // event contains UID
      const schemaUid = bufferToHex(schemaUidParam)
      const attesterAddress = attesterParam
      const subjectAddress = subjectParam
      const message = messageParam || ''
      const value = (() => { try { return typeof messageParam === 'string' ? JSON.parse(messageParam) : undefined } catch { return undefined } })()
      
      console.log('📋 [Debug] Attestation record being processed:', {
        attestationUid,
        schemaUid,
        attesterAddress,
        subjectAddress,
        message,
        value,
        ledger: eventData.ledger,
        transactionHash: eventData.transactionHash
      })
      
      if (attestationUid && schemaUid && attesterAddress) {
        await singleUpsertAttestation({
          attestationUid,
          ledger: eventData.ledger,
          schemaUid,
          attesterAddress,
          subjectAddress: subjectAddress || undefined,
          transactionHash: eventData.transactionHash,
          schemaEncoding: 'JSON',
          message,
          value,
          revoked: false,
        })
      } else {
        console.log('⚠️ [Projection] ATTEST create missing ids', { attestationUid: !!attestationUid, schemaUid: !!schemaUid, attester: !!attesterAddress })
      }
    }

    // ATTEST revoke
    if (type === 'ATTEST:REVOKE' && Array.isArray(val)) {
      console.log('🧩 [Projection] ATTEST revoke event', { eventId: eventData.eventId, type })
      
      // Extract data directly from event value array
      // Based on the event data: [attestationUid, schemaUid, attester, subject, revokedFlag, timestamp]
      const attestationUid = typeof val[0] === 'string' ? val[0] : toBase64(val[0])
      const schemaUidBuffer = val[1]  // This is a Buffer
      const attesterAddress = val[2]  // Address string
      const subjectAddress = val[3]   // Address string
      const revokedFlag = val[4] === true
      const revokedAtRaw = val[5]
      
      // Convert schema UID Buffer to hex string
      const schemaUid = bufferToHex(schemaUidBuffer)
      
      let revokedAt: Date | undefined = undefined
      if (typeof revokedAtRaw === 'bigint') {
        revokedAt = new Date(Number(revokedAtRaw) * 1000)
      } else if (typeof revokedAtRaw === 'string' || typeof revokedAtRaw === 'number') {
        const num = typeof revokedAtRaw === 'number' ? revokedAtRaw : parseInt(revokedAtRaw, 10)
        if (!Number.isNaN(num)) revokedAt = new Date(num * 1000)
      }
      if (!revokedAt) revokedAt = new Date(eventData.timestamp)
      
      console.log('📋 [Debug] ATTEST:REVOKE data:', {
        attestationUid,
        schemaUid,
        attesterAddress,
        subjectAddress,
        revoked: revokedFlag,
        revokedAt
      })
      
      if (attestationUid && schemaUid && attesterAddress) {
        await singleUpsertAttestation({
          attestationUid,
          ledger: eventData.ledger,
          schemaUid,
          attesterAddress,
          subjectAddress: subjectAddress || undefined,
          transactionHash: eventData.transactionHash,
          schemaEncoding: 'JSON',
          message: '',
          value: undefined,
          revoked: revokedFlag === true,
          revokedAt,
        })
      } else {
        console.log('⚠️ [Projection] ATTEST revoke missing required fields', { 
          attestationUid: !!attestationUid, 
          schemaUid: !!schemaUid, 
          attester: !!attesterAddress 
        })
      }
    }
  } catch (projErr: any) {
    console.warn('Registry projection warning for event', eventData?.eventId, '-', projErr?.message || projErr)
  }
}

/**
 * Process and upsert transaction for an event.
 */
async function processTransactionForEvent(db: any, transactionHash: string): Promise<boolean> {
  try {
    const txDetails = await fetchTransactionDetails(transactionHash)
    if (!txDetails) return false

    console.log(`=============== Processing transaction ===============`)
    // console.log({txDetails})
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
        envelope: envelope,
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
 * Optimized to make direct Horizon API calls for specific transaction hash and contract ID.
 */
async function processOperationsForEvent(db: any, transactionHash: string): Promise<number> {
  let count = 0
  
  try {
    console.log(`🔍 Fetching operations for transaction: ${transactionHash}`)
    
    // Make direct Horizon API call for this specific transaction
    const operations = await fetchOperationsForTransaction(transactionHash)
    
    if (operations.length === 0) {
      console.log(`📭 No operations found for transaction: ${transactionHash}`)
      return 0
    }
    
    console.log(`📋 Found ${operations.length} operations for transaction: ${transactionHash}`)
    
    // Process each operation and associate with relevant contracts
    for (const operation of operations) {
      try {
        // Determine which contract this operation belongs to
        const contractId = determineContractId(operation)
        
        if (!contractId) {
          console.log(`⚠️ Could not determine contract ID for operation ${operation.id}`)
          continue
        }
        
        // Extract operation details
        const operationData = {
          operationId: operation.id,
          transactionHash: operation.transaction_hash,
          contractId: contractId,
          operationType: operation.type_i?.toString() || 'unknown',
          successful: operation.successful !== false,
          sourceAccount: operation.source_account || '',
          operationIndex: operation.index || 0,
          function: extractFunctionName(operation),
          parameters: extractParameters(operation),
          details: operation, // Store full operation details
        }
        
        // Upsert operation
        await db.horizonOperation.upsert({
          where: { operationId: operation.id },
          update: {
            ...operationData,
          },
          create: {
            ...operationData,
          },
        })
        
        count++
        console.log(`✅ Stored operation ${operation.id} for contract ${contractId}`)
      } catch (error: any) {
        console.error(`❌ Error processing operation ${operation.id}:`, error.message)
      }
    }
    
    console.log(`🎯 Successfully processed ${count} operations for transaction: ${transactionHash}`)
    return count
    
  } catch (error: any) {
    console.error(`❌ Error processing operations for transaction ${transactionHash}:`, error.message)
    return count
  }
}

/**
 * Fetch operations for a specific transaction from Horizon API.
 * Optimized to use transaction-specific query for better performance.
 */
async function fetchOperationsForTransaction(transactionHash: string): Promise<any[]> {
  try {
    const horizonUrl = getHorizonBaseUrl()
    const url = `${horizonUrl}/transactions/${transactionHash}/operations?limit=200&order=asc`
    
    console.log(`🌐 Fetching operations from: ${url}`)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Transaction ${transactionHash} not found in Horizon`)
        return []
      }
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }
    
    const data = await response.json()
    const operations = data._embedded?.records || []
    
    console.log(`📊 Fetched ${operations.length} operations for transaction ${transactionHash}`)
    return operations
    
  } catch (error: any) {
    console.error(`❌ Error fetching operations for transaction ${transactionHash}:`, error.message)
    return []
  }
}

/**
 * Determine which contract an operation belongs to based on operation details.
 * This is a heuristic approach since Horizon doesn't directly associate operations with contracts.
 */
function determineContractId(operation: any): string | null {
  // Check if operation involves any of our target contracts
  for (const contractId of CONTRACT_IDS_TO_INDEX) {
    // Check various fields where contract ID might appear
    if (
      operation.to === contractId ||
      operation.from === contractId ||
      operation.account === contractId ||
      operation.contract_id === contractId ||
      (operation.function && operation.function.includes(contractId)) ||
      (operation.parameters && JSON.stringify(operation.parameters).includes(contractId))
    ) {
      return contractId
    }
  }
  
  // For invoke_host_function operations (type 24), check the function details
  if (operation.type_i === 24) { // invoke_host_function
    try {
      const functionDetails = operation.function || operation.details?.function
      if (functionDetails) {
        // Check if any of our contract IDs are mentioned in the function details
        for (const contractId of CONTRACT_IDS_TO_INDEX) {
          if (functionDetails.includes(contractId)) {
            return contractId
          }
        }
      }
      
      // Check host function details for contract invocation
      const hostFunction = operation.host_function
      if (hostFunction) {
        // For contract invocation, check the contract address
        if (hostFunction.type === 'invoke_contract') {
          const contractAddress = hostFunction.invoke_contract?.contract_address
          if (contractAddress && CONTRACT_IDS_TO_INDEX.includes(contractAddress)) {
            return contractAddress
          }
        }
      }
    } catch (error) {
      console.warn('Error parsing function details:', error)
    }
  }
  
  // For restore_footprint operations (type 25), check the contract address
  if (operation.type_i === 25) { // restore_footprint
    try {
      const contractAddress = operation.contract_id || operation.contract_address
      if (contractAddress && CONTRACT_IDS_TO_INDEX.includes(contractAddress)) {
        return contractAddress
      }
    } catch (error) {
      console.warn('Error parsing restore_footprint details:', error)
    }
  }
  
  // Check operation effects for contract interactions
  if (operation.effects) {
    for (const effect of operation.effects) {
      if (effect.type === 'contract_credited' || effect.type === 'contract_debited') {
        const contractAddress = effect.contract
        if (contractAddress && CONTRACT_IDS_TO_INDEX.includes(contractAddress)) {
          return contractAddress
        }
      }
    }
  }
  
  // If we can't determine, return the first contract ID as fallback
  return CONTRACT_IDS_TO_INDEX[0] || null
}

/**
 * Extract function name from operation details.
 */
function extractFunctionName(operation: any): string | null {
  try {
    if (operation.type_i === 24) { // invoke_host_function
      return operation.function || operation.details?.function || null
    }
    return operation.type || `operation_${operation.type_i}` || null
  } catch (error) {
    console.warn('Error extracting function name:', error)
    return null
  }
}

/**
 * Extract parameters from operation details.
 */
function extractParameters(operation: any): any | null {
  try {
    if (operation.type_i === 24) { // invoke_host_function
      return operation.parameters || operation.details?.parameters || null
    }
    const params: any = {}
    const paramFields = ['amount', 'asset', 'from', 'to', 'account', 'trustor', 'trustee']
    for (const field of paramFields) {
      if (operation[field] !== undefined) {
        params[field] = operation[field]
      }
    }
    return Object.keys(params).length > 0 ? params : null
  } catch (error) {
    console.warn('Error extracting parameters:', error)
    return null
  }
}

/**
 * Fetch operations for a specific transaction and contract combination.
 * This is the most optimized approach when you know both transaction and contract.
 */
export async function fetchOperationsForTransactionAndContract(transactionHash: string, contractId: string): Promise<any[]> {
  try {
    // First get all operations for the transaction
    const allOperations = await fetchOperationsForTransaction(transactionHash)
    
    // Then filter for operations related to the specific contract
    const contractOperations = allOperations.filter(operation => {
      const operationContractId = determineContractId(operation)
      return operationContractId === contractId
    })
    
    console.log(`🎯 Found ${contractOperations.length} operations for transaction ${transactionHash} and contract ${contractId}`)
    return contractOperations
    
  } catch (error: any) {
    console.error(`❌ Error fetching operations for transaction ${transactionHash} and contract ${contractId}:`, error.message)
    return []
  }
}