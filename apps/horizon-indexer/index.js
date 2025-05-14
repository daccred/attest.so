const express = require('express');
const { SorobanRpcServer } = require('@stellar/stellar-sdk'); // Added import
const fs = require('fs');
const path = require('path');

const LAST_LEDGER_FILE_PATH = path.join(__dirname, 'lastLedger.json');

const app = express();
const port = process.env.PORT || 3000;

// Placeholder for the last processed ledger, replace with your logic
let lastProcessedLedger = 0; // This will be loaded from a file

// Placeholder for your contract ID, replace with your actual contract ID
const YOUR_CONTRACT_ID = "YOUR_CONTRACT_ID_HERE";

// Placeholder for the function to store events in the database
// You need to implement this function based on your database setup
async function storeEventInDatabase(event) {
  console.log("Received event:", JSON.stringify(event, null, 2));
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
      const data = fs.readFileSync(LAST_LEDGER_FILE_PATH, 'utf8');
      const jsonData = JSON.parse(data);
      if (jsonData && typeof jsonData.lastProcessedLedger === 'number') {
        lastProcessedLedger = jsonData.lastProcessedLedger;
        console.log(`Loaded lastProcessedLedger from file: ${lastProcessedLedger}`);
      } else {
        console.log('Invalid data in lastLedger.json, starting from 0.');
        lastProcessedLedger = 0;
      }
    } else {
      console.log('lastLedger.json not found, starting from 0.');
      lastProcessedLedger = 0;
    }
  } catch (error) {
    console.error('Error loading lastProcessedLedger:', error);
    lastProcessedLedger = 0; // Default to 0 on error
  }
}

// Function to save the last processed ledger to a file
function saveLastProcessedLedger() {
  try {
    const jsonData = JSON.stringify({ lastProcessedLedger }, null, 2);
    fs.writeFileSync(LAST_LEDGER_FILE_PATH, jsonData, 'utf8');
    console.log(`Saved lastProcessedLedger to file: ${lastProcessedLedger}`);
  } catch (error) {
    console.error('Error saving lastProcessedLedger:', error);
  }
}

// Function to subscribe to Soroban contract events
async function subscribeToSorobanEvents() {
  console.log('Attempting to subscribe to Soroban events...');
  try {
    const sorobanServer = new SorobanRpcServer('https://soroban-testnet.stellar.org');
    const eventListener = sorobanServer.subscribeEvents({
      startLedger: lastProcessedLedger,
      filters: [{ type: "contract", contractIds: [YOUR_CONTRACT_ID] }],
      onMessage: async (event) => {
        console.log(`Processing event for ledger: ${event.ledger}`);
        // Process event and store in Postgres
        await storeEventInDatabase(event);
        // Update lastProcessedLedger, ensure this is persisted if needed
        if (event.ledger > lastProcessedLedger) {
            lastProcessedLedger = event.ledger;
            // Persist lastProcessedLedger if your application restarts
            saveLastProcessedLedger(); // Save to file
            console.log(`Updated lastProcessedLedger to: ${lastProcessedLedger}`);
        }
      },
      onError: (error) => {
        console.error('Soroban event subscription error:', error);
        // Implement reconnection logic or error handling as needed
      }
    });
    console.log('Successfully subscribed to Soroban events.');
    // Keep the process alive, or handle listener closure appropriately
    // eventListener.close(); // Call this when you want to stop listening
  } catch (error) {
    console.error('Failed to subscribe to Soroban events:', error);
  }
}

app.get('/', (req, res) => {
  res.send('Horizon Indexer is running!');
});

app.listen(port, () => {
  console.log(`Horizon Indexer listening at http://localhost:${port}`);
  // Load the last processed ledger and then start listening to Soroban events
  loadLastProcessedLedger();
  subscribeToSorobanEvents();
});