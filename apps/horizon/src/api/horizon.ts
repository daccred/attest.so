import express, { Request, Response } from 'express'
import { rpc } from '@stellar/stellar-sdk' // Revert to rpc import
import fs from 'fs'
import path from 'path'

const LAST_LEDGER_FILE_PATH = path.join(__dirname, 'lastLedger.json')

const app = express()
const port = process.env.PORT || 3000

// --- Configuration via Environment Variables ---
const STELLAR_NETWORK = process.env.STELLAR_NETWORK || 'testnet' // 'testnet' or 'mainnet'
const CONTRACT_ID_TO_INDEX = process.env.CONTRACT_ID_TO_INDEX || 'YOUR_CONTRACT_ID_HERE'

let sorobanServerUrl: string
if (STELLAR_NETWORK === 'mainnet') {
  sorobanServerUrl = 'https://soroban-rpc.stellar.org' // Mainnet RPC
} else {
  sorobanServerUrl = 'https://soroban-testnet.stellar.org' // Testnet RPC (default)
}

console.log(`Initializing Horizon indexer for network: ${STELLAR_NETWORK}`)
console.log(`Using Soroban RPC URL: ${sorobanServerUrl}`)
console.log(`Indexing contract ID: ${CONTRACT_ID_TO_INDEX}`)

if (CONTRACT_ID_TO_INDEX === 'YOUR_CONTRACT_ID_HERE') {
  console.warn("Warning: CONTRACT_ID_TO_INDEX is not set. Using placeholder value.")
}
// ---------------------------------------------

let lastProcessedLedger = 0

// Placeholder for your contract ID, replace with your actual contract ID
const YOUR_CONTRACT_ID = 'YOUR_CONTRACT_ID_HERE'

// Placeholder for the function to store events in the database
// You need to implement this function based on your database setup
async function storeEventInDatabase(event: any) { // Basic type for event
  console.log('Received event:', JSON.stringify(event, null, 2))
  // Implement your database storage logic here
  // For example, if using PostgreSQL with a 'events' table:
  // const { client } = require('./db'); // Assuming you have a db.js for connection
  // try {
  //   await client.query('INSERT INTO events (data) VALUES ($1)', [event]);
  //   console.log('Event stored in database');
  // } catch (error) {
  //   console.error('Error storing event in database:', error);
  // }
}

// Function to load the last processed ledger from a file
function loadLastProcessedLedger() {
  try {
    if (fs.existsSync(LAST_LEDGER_FILE_PATH)) {
      const data = fs.readFileSync(LAST_LEDGER_FILE_PATH, 'utf8')
      const jsonData = JSON.parse(data)
      if (jsonData && typeof jsonData.lastProcessedLedger === 'number') {
        lastProcessedLedger = jsonData.lastProcessedLedger
        console.log(`Loaded lastProcessedLedger from file: ${lastProcessedLedger}`)
      } else {
        console.log('Invalid data in lastLedger.json, starting from ledger 0 after current.')
        lastProcessedLedger = 0 // Will be set to current ledger + 1 if 0
      }
    } else {
      console.log('lastLedger.json not found, starting from ledger 0 after current.')
      lastProcessedLedger = 0 // Will be set to current ledger + 1 if 0
    }
  } catch (error) {
    console.error('Error loading lastProcessedLedger:', error)
    lastProcessedLedger = 0 // Default to 0 on error
  }
}

// Function to save the last processed ledger to a file
function saveLastProcessedLedger() {
  try {
    const jsonData = JSON.stringify({ lastProcessedLedger }, null, 2)
    fs.writeFileSync(LAST_LEDGER_FILE_PATH, jsonData, 'utf8')
    console.log(`Saved lastProcessedLedger to file: ${lastProcessedLedger}`)
  } catch (error) {
    console.error('Error saving lastProcessedLedger:', error)
  }
}

// Function to subscribe to Soroban contract events
async function subscribeToSorobanEvents() {
  console.log('Attempting to subscribe to Soroban events...')
  try {
    const sorobanServer = new rpc.Server(sorobanServerUrl, { // Use rpc.Server
      allowHttp: sorobanServerUrl.startsWith('http://')
    })

    // If lastProcessedLedger is 0, fetch the latest ledger and start from the next one.
    if (lastProcessedLedger === 0) {
      try {
        const latestLedgerState = await sorobanServer.getLatestLedger()
        lastProcessedLedger = latestLedgerState.sequence + 1
        console.log(`Starting event subscription from ledger: ${lastProcessedLedger}`)
      } catch (error) {
        console.error('Failed to fetch latest ledger state. Will retry subscription shortly:', error)
        setTimeout(subscribeToSorobanEvents, 10000) // Retry after 10 seconds
        return
      }
    }

    // Try using listen() as a common event subscription pattern
    // This is a GUESS because subscribeToEvents/subscribeEvents failed linting.
    // The actual parameters for listen() might be different.
    const eventListener = sorobanServer.listen({
      startLedger: lastProcessedLedger,
      filters: [{ type: 'contract', contractIds: [CONTRACT_ID_TO_INDEX] }],
      onMessage: async (event: any) => {
        console.log(`Processing event for ledger: ${event.ledger}`)
        await storeEventInDatabase(event)
        if (event.ledger > lastProcessedLedger) {
          lastProcessedLedger = event.ledger
          saveLastProcessedLedger()
          console.log(`Updated lastProcessedLedger to: ${lastProcessedLedger}`)
        }
      },
      onError: (error: Error) => {
        console.error('Soroban event subscription error:', error.message)
        console.log('Attempting to resubscribe after 10 seconds...')
        if (typeof (eventListener as any)?.close === 'function') {
          try { (eventListener as any).close() } catch (e) { console.error('Error closing previous listener:', e) }
        }
        setTimeout(subscribeToSorobanEvents, 10000)
      },
    })
    console.log('Successfully subscribed to Soroban events (using listen method attempt).')
  } catch (error: any) {
    console.error('Failed to subscribe to Soroban events initially:', error.message || error)
    console.log('Retrying initial subscription after 10 seconds...')
    setTimeout(subscribeToSorobanEvents, 10000)
  }
}