/**
 * Event repository for Soroban contract event synchronization.
 *
 * Implements event fetching from Soroban RPC with pagination support,
 * transaction enrichment, and database persistence. Handles ledger-based
 * synchronization with automatic progress tracking and retry logic for
 * resilient event ingestion.
 *
 * @module repository/events
 * @requires @stellar/stellar-sdk
 * @requires common/constants
 * @requires common/db
 */

import { rpc } from '@stellar/stellar-sdk'
import {
  sorobanRpcUrl,
  CONTRACT_IDS_TO_INDEX,
  MAX_EVENTS_PER_FETCH,
  LEDGER_HISTORY_LIMIT_DAYS,
} from '../common/constants'
import { getDB, getLastProcessedLedgerFromDB, updateLastProcessedLedgerInDB } from '../common/db'
import { singleUpsertSchema } from './schemas.repository'
import { singleUpsertAttestation } from './attestations.repository'
import { parseSchemaDefinition } from '../common/schemaParser'

const sorobanServer = new rpc.Server(sorobanRpcUrl, {
  allowHttp: sorobanRpcUrl.startsWith('http://'),
})

/**
 * Result interface for event fetching operations.
 *
 * Provides detailed information about the event synchronization process
 * including counts, progress tracking, and RPC status information.
 */
export interface FetchEventsResult {
  message: string
  eventsFetched: number
  processedUpToLedger: number
  lastRpcLedger: number
}

/**
 * Fetches and stores contract events from Soroban RPC.
 *
 * Performs incremental event synchronization starting from the specified
 * or last processed ledger. Implements pagination handling, transaction
 * detail enrichment, and atomic database storage. Tracks synchronization
 * progress and handles empty ledger ranges gracefully.
 *
 * @async
 * @function fetchAndStoreEvents
 * @param {number} [startLedgerFromRequest] - Override starting ledger
 * @returns {Promise<FetchEventsResult>} Event fetch results
 * @returns {string} result.message - Human-readable status message
 * @returns {number} result.eventsFetched - Total events retrieved
 * @returns {number} result.processedUpToLedger - Last processed ledger
 * @returns {number} result.lastRpcLedger - Current RPC ledger height
 * @throws {Error} Database connection errors or RPC failures
 */
export async function fetchAndStoreEvents(
  startLedgerFromRequest?: number
): Promise<FetchEventsResult> {
  console.log(`---------------- FETCH AND STORE EVENTS CYCLE (events.repository.ts) ----------------`)
  console.log(
    `Requested start ledger: ${
      startLedgerFromRequest === undefined ? 'latest from DB/default' : startLedgerFromRequest
    }`
  )

  const db = await getDB()
  if (!db) {
    const errMsg = 'Database not connected (checked in fetchAndStoreEvents). Aborting event fetch.'
    console.error(errMsg)
    console.log(`------------------------------------------------------`)
    throw new Error(errMsg)
  }
  if (!CONTRACT_IDS_TO_INDEX || CONTRACT_IDS_TO_INDEX.length === 0) {
    const errMsg = 'CONTRACT_IDS_TO_INDEX is empty or not defined. Aborting event fetch.'
    console.error(errMsg)
    console.log(`------------------------------------------------------`)
    throw new Error(errMsg)
  }

  try {
    let latestLedgerOnRpcData
    try {
      console.log(
        '--------------- Attempting to call sorobanServer.getLatestLedger() --------------- '
      )
      latestLedgerOnRpcData = await sorobanServer.getLatestLedger()
      console.log('--------------- sorobanServer.getLatestLedger() RAW RESPONSE: ---------------')
      console.log(JSON.stringify(latestLedgerOnRpcData, null, 2))
      console.log('----------------------------------------------------------------------------')
      if (!latestLedgerOnRpcData || typeof latestLedgerOnRpcData.sequence !== 'number') {
        throw new Error('Invalid response from getLatestLedger or sequence number missing.')
      }
    } catch (rpcError: any) {
      console.error('Error fetching latest ledger from RPC (SDK):', rpcError.message)
      console.log(`------------------------------------------------------`)
      throw new Error(`Failed to fetch latest ledger from RPC (SDK): ${rpcError.message}`)
    }
    const latestLedgerSequenceOnRpc = latestLedgerOnRpcData.sequence

    let lastProcessedLedgerDb = await getLastProcessedLedgerFromDB()
    let currentLedgerToQuery: number

    if (typeof startLedgerFromRequest === 'number' && startLedgerFromRequest >= 0) {
      currentLedgerToQuery = startLedgerFromRequest
      if (currentLedgerToQuery === 0) currentLedgerToQuery = 1
      console.log(
        `Using startLedger from request (adjusted to min 1 if 0): ${currentLedgerToQuery}`
      )
    } else {
      currentLedgerToQuery = lastProcessedLedgerDb > 0 ? lastProcessedLedgerDb + 1 : 0
      if (currentLedgerToQuery === 0) {
        const maxLookBackLedgers = LEDGER_HISTORY_LIMIT_DAYS * 24 * 60 * 10 // ~10 ledgers per minute
        currentLedgerToQuery = Math.max(1, latestLedgerSequenceOnRpc - maxLookBackLedgers)
        console.log(
          `No specific startLedger. Starting query from calculated historical ledger (min 1): ${currentLedgerToQuery}`
        )
      } else {
        console.log(`Using startLedger from DB (last processed + 1): ${currentLedgerToQuery}`)
      }
    }

    console.log(`Last processed ledger in DB (for reference): ${lastProcessedLedgerDb}`)
    console.log(`Latest ledger on RPC: ${latestLedgerSequenceOnRpc}`)

    if (currentLedgerToQuery > latestLedgerSequenceOnRpc && latestLedgerSequenceOnRpc > 0) {
      const message = 'Start ledger is ahead of the latest RPC ledger. No new events to process.'
      console.log(message)
      console.log(`------------------------------------------------------`)
      return {
        message,
        eventsFetched: 0,
        processedUpToLedger: currentLedgerToQuery - 1,
        lastRpcLedger: latestLedgerSequenceOnRpc,
      }
    }

    let nextCursor: string | undefined = undefined
    let lastLedgerProcessedInCycle = lastProcessedLedgerDb
    let totalEventsFetchedThisRun = 0
    let processedItemsForStorage: any[] = []
    let iteration = 0
    let prevCursor: string | undefined = undefined
    let staleCursorCount = 0

    do {
      iteration++
      console.log(
        `Loop iteration. Current target start ledger: ${currentLedgerToQuery}, Cursor: ${
          nextCursor || 'none'
        }`
      )

      const eventsRequestParams: any = {
        filters: [{ type: 'contract', contractIds: CONTRACT_IDS_TO_INDEX, topics: [] }],
        pagination: {
          limit: MAX_EVENTS_PER_FETCH,
        },
      }

      if (nextCursor) {
        eventsRequestParams.pagination.cursor = nextCursor
        console.log(`Using cursor: ${nextCursor} for this request.`)
      } else {
        eventsRequestParams.startLedger = Math.max(1, currentLedgerToQuery)
        console.log(
          `No cursor. Using startLedger: ${eventsRequestParams.startLedger} for this request.`
        )
      }

      const rpcPayload = {
        jsonrpc: '2.0',
        id: `getEvents-${iteration}-${Date.now()}`,
        method: 'getEvents',
        params: eventsRequestParams,
      }

      console.log(
        '--------------- Attempting to call getEvents via fetch with payload: --------------- '
      )
      console.log(JSON.stringify(rpcPayload, null, 2))

      let rpcResponse
      try {
        const rawResponse = await fetch(sorobanRpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rpcPayload),
        })

        if (!rawResponse.ok) {
          const errorBody = await rawResponse.text()
          throw new Error(`RPC request failed with status ${rawResponse.status}: ${errorBody}`)
        }
        rpcResponse = await rawResponse.json()
      } catch (fetchError: any) {
        console.error('Error fetching events via fetch:', fetchError.message)
        throw new Error(`Failed to fetch events via fetch: ${fetchError.message}`)
      }

      console.log('--------------- getEvents via fetch RAW RESPONSE: --------------- ')
      console.log(JSON.stringify(rpcResponse, null, 2))
      console.log('---------------------------------------------------------------------')

      if (rpcResponse.error) {
        console.error('RPC error in getEvents response:', rpcResponse.error)
        throw new Error(
          `RPC error for getEvents: ${rpcResponse.error.message} (Code: ${rpcResponse.error.code})`
        )
      }

      const eventsResponse = rpcResponse.result

      if (eventsResponse && eventsResponse.events && eventsResponse.events.length > 0) {
        totalEventsFetchedThisRun += eventsResponse.events.length
        console.log(`Fetched ${eventsResponse.events.length} events.`)

        const batchItems: any[] = []
        for (const event of eventsResponse.events) {
          let transactionDetails: any = null
          if (event.txHash) {
            try {
              console.log(`----------- Fetching tx: ${event.txHash} for event ${event.id} -----------`)
              const txRpcPayload = {
                jsonrpc: '2.0',
                id: `getTx-${event.txHash}-${Date.now()}`,
                method: 'getTransaction',
                params: { hash: event.txHash },
              }
              const rawTxResponse = await fetch(sorobanRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(txRpcPayload),
              })
              if (!rawTxResponse.ok) {
                const errorBody = await rawTxResponse.text()
                throw new Error(
                  `getTransaction RPC request failed for ${event.txHash} with status ${rawTxResponse.status}: ${errorBody}`
                )
              }
              const txRpcResponse = await rawTxResponse.json()
              if (txRpcResponse.error) {
                console.error(
                  `RPC error fetching transaction ${event.txHash}:`,
                  txRpcResponse.error
                )
                throw new Error(
                  `RPC error for getTransaction ${event.txHash}: ${txRpcResponse.error.message} (Code: ${txRpcResponse.error.code})`
                )
              }
              transactionDetails = txRpcResponse.result
              console.log(`----------- Fetched tx: ${event.txHash} RAW RESPONSE: -----------`)
              console.log(JSON.stringify(transactionDetails, null, 2))
              console.log(`-------------------------------------------------------------------`)
            } catch (txError: any) {
              console.error(
                `Error fetching transaction ${event.txHash} for event ${event.id} (fetch):`,
                txError.message
              )
            }
          }
          batchItems.push({ event, transactionDetails, eventId: event.id })
        }

        const lastEventInBatch = eventsResponse.events[eventsResponse.events.length - 1]
        const ledgerOfLastEventInBatch =
          typeof lastEventInBatch.ledger === 'string'
            ? parseInt(lastEventInBatch.ledger, 10)
            : lastEventInBatch.ledger

        lastLedgerProcessedInCycle = Math.max(lastLedgerProcessedInCycle, ledgerOfLastEventInBatch)

        // Flush this batch immediately to avoid losing progress if we later get stuck on a stale cursor
        try {
          await storeEventsAndTransactionsInDB(batchItems)
          // Reset any accumulated items since we flush per batch now
          processedItemsForStorage = []
        } catch (storeErr) {
          console.error('Error flushing batch to DB:', (storeErr as any)?.message || storeErr)
        }

        staleCursorCount = 0 // reset on progress
      } else {
        console.log('No events found for this request (or empty events array in response.result).')
        // If RPC keeps returning the same cursor with no events, break to avoid an infinite loop
        if (eventsResponse?.cursor) {
          if (prevCursor === eventsResponse.cursor) {
            staleCursorCount++
            console.log(`Cursor unchanged with empty events. Repeat count: ${staleCursorCount}`)
            if (staleCursorCount >= 3) {
              console.log(
                'Breaking fetch loop due to repeated empty responses with unchanged cursor.'
              )
              nextCursor = undefined
              break
            }
          } else {
            staleCursorCount = 0
          }
        }
      }

      nextCursor = eventsResponse?.cursor
      if (nextCursor) {
        console.log(`Next page cursor: ${nextCursor}. Will continue fetching.`)
      } else {
        console.log(
          'No cursor returned. This was the last page for the current range or no events found.'
        )
        currentLedgerToQuery = lastLedgerProcessedInCycle + 1
        console.log(
          `Advancing currentLedgerToQuery to: ${currentLedgerToQuery} for next potential cycle/iteration.`
        )
        if (currentLedgerToQuery > latestLedgerSequenceOnRpc) {
          console.log('Advanced currentLedgerToQuery is beyond latest RPC ledger. Will break loop.')
          break
        }
      }

      prevCursor = nextCursor

      if (currentLedgerToQuery > latestLedgerSequenceOnRpc + 1 && !nextCursor) {
        console.warn(
          'Safety break: currentLedgerToQuery advanced beyond latest RPC ledger without a new cursor. Stopping cycle.'
        )
        break
      }
      if (iteration > 1000) {
        console.error('Safety break: Exceeded 1000 iterations. Aborting.')
        throw new Error('Exceeded maximum fetch iterations.')
      }
    } while (nextCursor)

    if (processedItemsForStorage.length > 0) {
      await storeEventsAndTransactionsInDB(processedItemsForStorage)
    }

    if (lastLedgerProcessedInCycle > lastProcessedLedgerDb) {
      await updateLastProcessedLedgerInDB(lastLedgerProcessedInCycle)
    } else if (
      totalEventsFetchedThisRun === 0 &&
      currentLedgerToQuery > lastProcessedLedgerDb &&
      currentLedgerToQuery <= latestLedgerSequenceOnRpc + 1
    ) {
      const ledgerToUpdateTo = Math.min(currentLedgerToQuery - 1, latestLedgerSequenceOnRpc)
      if (ledgerToUpdateTo > lastProcessedLedgerDb) {
        console.log(
          `No events found, but updating lastProcessedLedger in DB to ${ledgerToUpdateTo} to reflect scanned empty range.`
        )
        await updateLastProcessedLedgerInDB(ledgerToUpdateTo)
      }
    }

    const resultMessage = `Event ingestion cycle finished. Fetched ${totalEventsFetchedThisRun} events. Processed up to ledger ${lastLedgerProcessedInCycle}.`
    console.log(resultMessage)
    console.log(`------------------------------------------------------`)
    return {
      message: resultMessage,
      eventsFetched: totalEventsFetchedThisRun,
      processedUpToLedger: lastLedgerProcessedInCycle,
      lastRpcLedger: latestLedgerSequenceOnRpc,
    }
  } catch (error: any) {
    const errorMessage = `Error in fetchAndStoreEvents (events.repository.ts): ${
      error.message || error
    }`
    console.error(errorMessage)
    // Removed: if (error.response && error.response.data) { ... } as error might not be an axios-like error
    console.log(`------------------------------------------------------`)
    throw new Error(errorMessage)
  }
}

/**
 * Stores events and associated transactions atomically.
 *
 * Persists event and transaction data in a database transaction to ensure
 * consistency. Handles transaction storage before events to maintain
 * foreign key integrity. Supports batch processing with configurable
 * transaction timeout.
 *
 * @async
 * @function storeEventsAndTransactionsInDB
 * @private
 * @param {Array} eventsWithTransactions - Events with transaction details
 * @returns {Promise<void>} Completes when storage successful
 */
async function storeEventsAndTransactionsInDB(eventsWithTransactions: any[]): Promise<void> {
  const db = await getDB()
  if (!db) {
    console.error('Cannot store events, database not initialized.')
    return
  }

  if (eventsWithTransactions.length === 0) return

  try {
    // Process events in a transaction for consistency (increase timeout for transaction fetching)
    const results = await db.$transaction(
      async (prismaTx) => {
        const operations = eventsWithTransactions.map(async (item) => {
          const ev: any = item.event || {}
          const txDetails: any = item.transactionDetails || item.transaction || {}

          const ledgerNumber = typeof ev.ledger === 'string' ? parseInt(ev.ledger, 10) : ev.ledger
          const eventTimestamp = ev.timestamp || ev.ledgerClosedAt
          const txHash = ev.txHash || txDetails.txHash || txDetails.hash

          // Store transaction FIRST (before event that references it)
          if (txDetails && (txDetails.hash || txDetails.txHash)) {
            const transactionData = {
              hash: txDetails.hash || txDetails.txHash,
              ledger: ledgerNumber,
              timestamp: eventTimestamp ? new Date(eventTimestamp) : new Date(),
              sourceAccount: txDetails.sourceAccount || '',
              fee: txDetails.fee?.toString() || '0',
              operationCount: txDetails.operationCount || 0,
              envelope: txDetails.envelopeXdr || txDetails.envelope || {},
              result: txDetails.resultXdr || txDetails.result || {},
              meta: txDetails.resultMetaXdr || txDetails.meta || {},
              feeBump: Boolean(txDetails.feeBump),
              successful: txDetails.successful !== false,
              memo: txDetails.memo,
              memoType: txDetails.memoType,
              inclusionFee: txDetails.inclusionFee?.toString(),
              resourceFee: txDetails.resourceFee?.toString(),
              sorobanResourceUsage: txDetails.sorobanResourceUsage || null,
            }

            await prismaTx.horizonTransaction.upsert({
              where: { hash: txDetails.hash || txDetails.txHash },
              update: transactionData,
              create: transactionData,
            })
          }

          // Store event AFTER transaction exists
          const horizonEventData = {
            eventId: ev.id,
            ledger: Number.isFinite(ledgerNumber) ? ledgerNumber : 0,
            timestamp: eventTimestamp ? new Date(eventTimestamp) : new Date(),
            contractId: ev.contractId || '',
            eventType: ev.type || 'unknown',
            eventData: ev.data ?? {
              topic: ev.topic ?? null,
              value: ev.value ?? null,
              pagingToken: ev.pagingToken ?? null,
              inSuccessfulContractCall: ev.inSuccessfulContractCall ?? null,
            },

            // Transaction details - only set txHash if transaction was actually stored
            txHash: txDetails && (txDetails.hash || txDetails.txHash) ? txHash : null,
            txEnvelope: txDetails.envelopeXdr || txDetails.envelope || '',
            txResult: txDetails.resultXdr || txDetails.result || '',
            txMeta: txDetails.resultMetaXdr || txDetails.meta || '',
            txFeeBump: Boolean(txDetails.feeBump),
            txStatus: txDetails.status || 'unknown',
            txCreatedAt: eventTimestamp ? new Date(eventTimestamp) : new Date(),
          }

          return prismaTx.horizonEvent.upsert({
            where: { eventId: ev.id },
            update: horizonEventData,
            create: horizonEventData,
          })
        })

        return Promise.all(operations)
      },
      {
        timeout: 30000, // 30 seconds timeout instead of default 5 seconds
      }
    )

    console.log(`Stored ${results.length} event-transaction pairs.`)

    // After storing, project registry entities (schemas, attestations) using individual operations
    for (const item of eventsWithTransactions) {
      const ev: any = item.event || {}
      const txDetails: any = item.transactionDetails || item.transaction || {}
      const eventType: string = ev.type || ev.eventType || 'unknown'
      const evData: any = Array.isArray(ev.data)
        ? ev.data
        : Array.isArray(ev.value)
        ? ev.value
        : undefined

      try {
        // SCHEMA register events
        if (eventType === 'SCHEMA:REGISTER' && Array.isArray(evData)) {
          const schemaUid: string | undefined = typeof evData[0] === 'string' ? evData[0] : undefined
          const schemaObj: any = typeof evData[1] === 'object' ? evData[1] : undefined
          if (schemaUid && schemaObj) {
            const defString = typeof schemaObj.definition === 'string'
              ? schemaObj.definition
              : JSON.stringify(schemaObj.definition ?? {})

            await singleUpsertSchema({
              uid: schemaUid,
              ledger: typeof ev.ledger === 'number' ? ev.ledger : parseInt(ev.ledger || '0', 10) || 0,
              schemaDefinition: defString,
              parsedSchemaDefinition: parseSchemaDefinition(defString),
              resolverAddress: schemaObj.resolver ?? null,
              revocable: schemaObj.revocable !== false,
              deployerAddress: schemaObj.authority || txDetails.sourceAccount || '',
              type: 'default',
              transactionHash: ev.txHash || txDetails.hash || txDetails.txHash || '',
            })
          }
        }

        // ATTEST create events
        if (eventType === 'ATTEST:CREATE' && Array.isArray(evData)) {
          const attestationUid: string | undefined = typeof evData[0] === 'string' ? evData[0] : undefined
          const schemaUid: string | undefined = typeof evData[1] === 'string' ? evData[1] : undefined
          const attesterAddress: string | undefined = typeof evData[2] === 'string' ? evData[2] : undefined
          const subjectAddress: string | undefined = typeof evData[3] === 'string' ? evData[3] : undefined
          const messageRaw: any = evData[4]

          let message: string = typeof messageRaw === 'string' ? messageRaw : typeof messageRaw === 'object' ? JSON.stringify(messageRaw) : String(messageRaw ?? '')
          let value: any = undefined
          try {
            if (typeof messageRaw === 'string' && messageRaw.trim().startsWith('{')) {
              value = JSON.parse(messageRaw)
            }
          } catch {}

          if (attestationUid && schemaUid && attesterAddress) {
            await singleUpsertAttestation({
              attestationUid,
              ledger: typeof ev.ledger === 'number' ? ev.ledger : parseInt(ev.ledger || '0', 10) || 0,
              schemaUid,
              attesterAddress,
              subjectAddress: subjectAddress || undefined,
              transactionHash: ev.txHash || txDetails.hash || txDetails.txHash || '',
              schemaEncoding: 'JSON',
              message,
              value,
              revoked: false,
            })
          }
        }

        // ATTEST revoke events
        if (eventType && eventType.toUpperCase().includes('ATTEST') && eventType.toUpperCase().includes('REVOKE') && Array.isArray(evData)) {
          const attestationUid: string | undefined = typeof evData[0] === 'string' ? evData[0] : undefined
          const revokedFlag = evData[4] === true
          const revokedAtRaw = evData[5]
          let revokedAt: Date | null = null
          if (typeof revokedAtRaw === 'string' || typeof revokedAtRaw === 'number') {
            const num = typeof revokedAtRaw === 'number' ? revokedAtRaw : parseInt(revokedAtRaw, 10)
            if (!Number.isNaN(num)) {
              // seconds epoch
              revokedAt = new Date(num * 1000)
            }
          }
          if (!revokedAt) {
            revokedAt = ev.timestamp ? new Date(ev.timestamp) : new Date()
          }
          if (attestationUid) {
            await singleUpsertAttestation({
              attestationUid,
              ledger: typeof ev.ledger === 'number' ? ev.ledger : parseInt(ev.ledger || '0', 10) || 0,
              schemaUid: (typeof evData[1] === 'string' ? evData[1] : '') || '',
              attesterAddress: (typeof evData[2] === 'string' ? evData[2] : '') || '',
              subjectAddress: (typeof evData[3] === 'string' ? evData[3] : undefined) || undefined,
              transactionHash: ev.txHash || txDetails.hash || txDetails.txHash || '',
              schemaEncoding: 'JSON',
              message: '',
              value: undefined,
              revoked: true,
              revokedAt: revokedAt ?? undefined,
            })
          }
        }
      } catch (projErr: any) {
        console.warn('Registry projection warning for event', ev?.id, '-', projErr?.message || projErr)
      }
    }
  } catch (error) {
    console.error('Error storing event-transaction pairs in PostgreSQL:', error)
  }
}
