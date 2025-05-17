import express, { Request, Response, Router } from 'express'
import { rpc } from '@stellar/stellar-sdk' // Revert to rpc import
import { MongoClient, Db, Collection } from 'mongodb'
// import { MongoMemoryServer } from 'mongodb-memory-server';

// const mongod = await MongoMemoryServer.create();
// const uri = mongod.getUri();


// --- Configuration via Environment Variables ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/horizon_indexer'
const STELLAR_NETWORK = process.env.STELLAR_NETWORK || 'testnet' // 'testnet' or 'mainnet'
const CONTRACT_ID_TO_INDEX = process.env.CONTRACT_ID_TO_INDEX || 'YOUR_CONTRACT_ID_HERE'
const MAX_EVENTS_PER_FETCH = 100 // Max events to fetch in one getEvents call (max 10000 by RPC)
const LEDGER_HISTORY_LIMIT_DAYS = 7 // Max days to look back for events, as per RPC limitations

let sorobanRpcUrl: string
if (STELLAR_NETWORK === 'mainnet') {
  sorobanRpcUrl = 'https://soroban-rpc.stellar.org' // Mainnet RPC
} else {
  sorobanRpcUrl = 'https://soroban-testnet.stellar.org' // Testnet RPC (default)
}

console.log(`Initializing Horizon API module for network: ${STELLAR_NETWORK}`)
console.log(`Using Soroban RPC URL: ${sorobanRpcUrl}`)
console.log(`Indexing contract ID: ${CONTRACT_ID_TO_INDEX}`)

if (CONTRACT_ID_TO_INDEX === 'YOUR_CONTRACT_ID_HERE' && process.env.NODE_ENV !== 'test') {
  console.warn("Warning: CONTRACT_ID_TO_INDEX is not set. Please set this environment variable. Using placeholder.")
}
// ---------------------------------------------

const router = Router()
let db: Db
let metadataCollection: Collection
let eventsCollection: Collection

const sorobanServer = new rpc.Server(sorobanRpcUrl, {
  allowHttp: sorobanRpcUrl.startsWith('http://')
})

async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI)
    await client.connect()
    db = client.db()
    metadataCollection = db.collection('metadata')
    eventsCollection = db.collection('contract_events')
    console.log('Successfully connected to MongoDB for Horizon API.')
  } catch (error) {
    console.error('Failed to connect to MongoDB for Horizon API:', error)
    // Allow app to start but log error, ingestion will fail
  }
}

// Connect to DB when module is loaded
connectToMongoDB()

async function getLastProcessedLedgerFromDB(): Promise<number> {
  if (!metadataCollection) {
    console.error('MongoDB metadataCollection not initialized.')
    return 0
  }
  const metadata = await metadataCollection.findOne({ key: 'lastProcessedLedgerMeta' })
  return metadata ? metadata.value : 0
}

async function updateLastProcessedLedgerInDB(ledgerSequence: number) {
  if (!metadataCollection) {
    console.error('MongoDB metadataCollection not initialized. Cannot update last processed ledger.')
    return
  }
  await metadataCollection.updateOne(
    { key: 'lastProcessedLedgerMeta' },
    { $set: { value: ledgerSequence, key: 'lastProcessedLedgerMeta' } },
    { upsert: true }
  )
  console.log(`Updated lastProcessedLedger in DB to: ${ledgerSequence}`)
}

// TODO: Use a more specific type for events, e.g., rpc.Api.RawLedgerEvent[] or the actual event type from getEvents response
async function storeEventsInDB(events: any[]) {
  if (!eventsCollection) {
    console.error('MongoDB eventsCollection not initialized. Cannot store events.')
    return
  }
  if (events.length === 0) return
  const operations = events.map((event) => ({
    updateOne: {
      filter: { eventId: event.id },
      update: { $set: { ...event, ingestedAt: new Date() } },
      upsert: true,
    },
  }))
  try {
    const result = await eventsCollection.bulkWrite(operations)
    console.log(
      `Stored ${result.upsertedCount + result.modifiedCount} events. New: ${result.upsertedCount}, Updated: ${result.modifiedCount}`
    )
  } catch (error) {
    console.error('Error storing events in MongoDB:', error)
  }
}

async function fetchAndStoreEvents(startLedgerFromRequest?: number) {
  console.log(`Starting event ingestion. Requested start ledger: ${startLedgerFromRequest === undefined ? 'latest from DB/default' : startLedgerFromRequest}`);
  if (!db) {
    const errMsg = 'MongoDB not connected. Aborting event fetch.';
    console.error(errMsg);
    throw new Error(errMsg);
  }
  try {
    let lastProcessedLedgerDb = await getLastProcessedLedgerFromDB()
    const latestLedgerOnRpc = await sorobanServer.getLatestLedger()
    let currentLedgerToQuery: number

    if (typeof startLedgerFromRequest === 'number' && startLedgerFromRequest >= 0) { // Allow 0 to signify earliest
      currentLedgerToQuery = startLedgerFromRequest
      console.log(`Using startLedger from request: ${currentLedgerToQuery}`)
    } else {
      currentLedgerToQuery = lastProcessedLedgerDb > 0 ? lastProcessedLedgerDb + 1 : 0
      if (currentLedgerToQuery === 0) {
        const maxLookBackLedgers = LEDGER_HISTORY_LIMIT_DAYS * 24 * 60 * 10 // Approx ledgers in 7 days (assuming 6s per ledger)
        currentLedgerToQuery = Math.max(1, latestLedgerOnRpc.sequence - maxLookBackLedgers)
        console.log(`No specific startLedger. Starting query from calculated historical ledger: ${currentLedgerToQuery}`)
      } else {
        console.log(`Using startLedger from DB (last processed + 1): ${currentLedgerToQuery}`)
      }
    }
    
    console.log(`Last processed ledger in DB (for reference): ${lastProcessedLedgerDb}`)
    console.log(`Latest ledger on RPC: ${latestLedgerOnRpc.sequence}`)

    if (currentLedgerToQuery > latestLedgerOnRpc.sequence && latestLedgerOnRpc.sequence > 0) {
      const message = 'Start ledger is ahead of the latest RPC ledger. No new events to process.'
      console.log(message)
      return { message, lastRpcLedger: latestLedgerOnRpc.sequence, queriedUpTo: currentLedgerToQuery - 1 }
    }

    let cursor: string | undefined = undefined
    let lastLedgerProcessedInCycle = lastProcessedLedgerDb
    let totalEventsFetchedThisRun = 0

    do {
      console.log(`Fetching events. Effective start ledger for this page/request: ${cursor ? 'cursor-based' : currentLedgerToQuery}, cursor: ${cursor || 'none'}`)
      
      // TODO: Define specific type for eventParams, e.g. rpc.Api.GetEventsRequest
      const eventParams: any = {
        filters: [
          {
            type: 'contract',
            contractIds: [CONTRACT_ID_TO_INDEX],
            // topics: [ ["AAAADwAAAAh0cmFuc2Zlcg==", "*", "*", "*"] ] // Example topic filter
          },
        ],
        pagination: {
          limit: MAX_EVENTS_PER_FETCH,
        },
      }

      if (cursor) {
        eventParams.pagination.cursor = cursor
      } else {
        eventParams.startLedger = currentLedgerToQuery
      }

      const response = await sorobanServer.getEvents(eventParams)

      if (response.events && response.events.length > 0) {
        totalEventsFetchedThisRun += response.events.length
        console.log(`Fetched ${response.events.length} events.`)
        await storeEventsInDB(response.events)
        
        const lastEventInBatch = response.events[response.events.length - 1]
        const ledgerOfLastEventInBatch = typeof lastEventInBatch.ledger === 'string' ? parseInt(lastEventInBatch.ledger) : lastEventInBatch.ledger
        lastLedgerProcessedInCycle = Math.max(lastLedgerProcessedInCycle, ledgerOfLastEventInBatch)
        
        if (!response.cursor) {
          currentLedgerToQuery = lastLedgerProcessedInCycle + 1
        }
      } else {
        console.log('No events found for this request.')
      }

      cursor = response.cursor
      if (cursor) {
        console.log(`Next page cursor: ${cursor}. Will continue fetching.`)
      } else {
        console.log('No cursor returned, this was the last page for the current range.')
      }
      
      // Safety break: if currentLedgerToQuery advanced beyond latest RPC ledger AND there's no cursor AND we received fewer events than limit (meaning we might be at the actual end)
      if (currentLedgerToQuery > latestLedgerOnRpc.sequence + 1 && !cursor && (!response.events || response.events.length < MAX_EVENTS_PER_FETCH)) {
        console.log('Advanced past latest RPC ledger or received partial page without cursor, stopping cycle.')
        break
      }

    } while (cursor)

    // Update the database with the highest ledger sequence number from which events were actually processed in this run.
    if (lastLedgerProcessedInCycle > lastProcessedLedgerDb) {
      await updateLastProcessedLedgerInDB(lastLedgerProcessedInCycle)
    }

    const resultMessage = `Event ingestion triggered. Fetched ${totalEventsFetchedThisRun} events. Processed up to ledger ${lastLedgerProcessedInCycle}.`
    console.log(resultMessage)
    return { 
      message: resultMessage,
      eventsFetched: totalEventsFetchedThisRun,
      processedUpToLedger: lastLedgerProcessedInCycle,
      lastRpcLedger: latestLedgerOnRpc.sequence 
    }
  } catch (error: any) {
    const errorMessage = `Error in fetchAndStoreEvents: ${error.message || error}`
    console.error(errorMessage)
    if (error.response && error.response.data) {
      console.error("RPC Error details:", JSON.stringify(error.response.data, null, 2))
    }
    throw new Error(errorMessage) // Re-throw to be caught by API handler
  }
}

router.post('/events/ingest', async (req: Request, res: Response) => {
  try {
    const startLedgerParam = req.body.startLedger
    let startLedgerFromRequest: number | undefined = undefined

    if (startLedgerParam !== undefined) {
      startLedgerFromRequest = parseInt(startLedgerParam)
      if (isNaN(startLedgerFromRequest)) {
        return res.status(400).json({ error: 'Invalid startLedger parameter. Must be a number.' })
      }
    }
    
    // Non-blocking: Trigger ingestion, don't wait for it to complete for HTTP response.
    fetchAndStoreEvents(startLedgerFromRequest)
      .then(result => console.log("Background event ingestion completed.", result))
      .catch(err => console.error("Background event ingestion failed.", err))

    res.status(202).json({ 
      success: true, 
      message: `Event ingestion process initiated. Requested start ledger: ${startLedgerFromRequest === undefined ? 'latest from DB/default' : startLedgerFromRequest}. Check server logs for progress.` 
    })

  } catch (error: any) { // Catches immediate errors in request handling
    res.status(500).json({ success: false, error: error.message || 'Failed to initiate event ingestion' })
  }
})

router.get('/health', async (req: Request, res: Response) => {
  let mongoStatus = 'disconnected'
  let rpcStatus = 'unknown'
  let lastLedgerDb = 0
  try {
    if (db) {
      await db.command({ ping: 1 })
      mongoStatus = 'connected'
      lastLedgerDb = await getLastProcessedLedgerFromDB()
    } else {
      // Attempt to connect if db object is not there, e.g. first health check before initial connect completes
      // This is a quick check, doesn't replace the main connectToMongoDB robust error handling
      try {
        await connectToMongoDB()
        if (db) mongoStatus = 'connected'
        lastLedgerDb = await getLastProcessedLedgerFromDB()
      } catch (mongoErr) {
        console.warn('Health check: MongoDB connection attempt failed.', mongoErr)
      }
    }
    
    const rpcHealth = await sorobanServer.getHealth()
    rpcStatus = rpcHealth.status
    res.status(200).json({
      status: 'ok',
      mongodb_status: mongoStatus,
      soroban_rpc_status: rpcStatus,
      network: STELLAR_NETWORK,
      indexing_contract: CONTRACT_ID_TO_INDEX,
      last_processed_ledger_in_db: lastLedgerDb
    })
  } catch (error: any) {
    console.error("Health check error:", error.message)
    res.status(500).json({
      status: 'error',
      mongodb_status: mongoStatus, 
      soroban_rpc_status: rpcStatus,
      error: error.message,
    })
  }
})

export default router