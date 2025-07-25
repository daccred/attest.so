import { rpc } from '@stellar/stellar-sdk'; // SDK still used for getLatestLedger and getHealth
import {
  sorobanRpcUrl,
  CONTRACT_ID_TO_INDEX,
  MAX_EVENTS_PER_FETCH,
  LEDGER_HISTORY_LIMIT_DAYS,
} from './constants';
import {
  getLastProcessedLedgerFromDB,
  updateLastProcessedLedgerInDB,
  storeEventsAndTransactionsInDB,
} from './db';

const sorobanServer = new rpc.Server(sorobanRpcUrl, {
  allowHttp: sorobanRpcUrl.startsWith('http://'),
});

export interface FetchEventsResult {
    message: string;
    eventsFetched: number;
    processedUpToLedger: number;
    lastRpcLedger: number;
}

/**
 * @function getLatestRPCLedgerIndex
 * 
 * @description Fetch the latest ledger index from the Soroban RPC server.
 * @returns Latest ledger index from the Soroban RPC server.
 * @throws Error if the response is invalid or sequence number is missing.
 * 
 */
export async function getLatestRPCLedgerIndex(): Promise<number> {
  console.log('--------------- Attempting to call sorobanServer.getLatestLedger() --------------- ');
  const latestLedgerOnRpcData = await sorobanServer.getLatestLedger();
  console.log('--------------- sorobanServer.getLatestLedger() RAW RESPONSE: ---------------');
  console.log(JSON.stringify(latestLedgerOnRpcData, null, 2));
  console.log('----------------------------------------------------------------------------');
  if (!latestLedgerOnRpcData || typeof latestLedgerOnRpcData.sequence !== 'number') {
    throw new Error('Invalid response from getLatestLedger or sequence number missing.');
  }
  return latestLedgerOnRpcData.sequence;
}

/**
 * @function fetchAndStoreEvents
 * 
 * @description Fetches events from the Soroban RPC server and stores them in the database.
 * 
 * @param {number} [startLedgerFromRequest] - Optional starting ledger index to begin fetching events from.
 * If not provided, it will use the last processed ledger from the database or calculate a historical start.
 * 
 * @returns {Promise<FetchEventsResult>} - An object containing the result of the fetch operation.
 * 
 * @throws {Error} - Throws an error if MongoDB is not connected, CONTRACT_ID_TO_INDEX is not defined,
 * or if there are issues with fetching events from the RPC server.
 */
export async function fetchAndStoreEvents(startLedgerFromRequest?: number): Promise<FetchEventsResult> {
  console.log(`---------------- FETCH AND STORE EVENTS CYCLE (ledger.ts) ----------------`);
  console.log(`Requested start ledger: ${startLedgerFromRequest === undefined ? 'latest from DB/default' : startLedgerFromRequest}`);

  if (!CONTRACT_ID_TO_INDEX) {
    const errMsg = 'CONTRACT_ID_TO_INDEX is not defined. Aborting event fetch.';
    console.error(errMsg);
    console.log(`------------------------------------------------------`);
    throw new Error(errMsg);
  }

  try {
    let latestLedgerOnRpcData;
    try {
      console.log('--------------- Attempting to call sorobanServer.getLatestLedger() --------------- ');
      latestLedgerOnRpcData = await sorobanServer.getLatestLedger();
      console.log('--------------- sorobanServer.getLatestLedger() RAW RESPONSE: ---------------');
      console.log(JSON.stringify(latestLedgerOnRpcData, null, 2));
      console.log('----------------------------------------------------------------------------');
      if (!latestLedgerOnRpcData || typeof latestLedgerOnRpcData.sequence !== 'number') {
        throw new Error('Invalid response from getLatestLedger or sequence number missing.');
      }
    } catch (rpcError: any) {
      console.error('Error fetching latest ledger from RPC (SDK):', rpcError.message);
      console.log(`------------------------------------------------------`);
      throw new Error(`Failed to fetch latest ledger from RPC (SDK): ${rpcError.message}`);
    }
    const latestLedgerSequenceOnRpc = latestLedgerOnRpcData.sequence;

    let lastProcessedLedgerDb = await getLastProcessedLedgerFromDB();
    let currentLedgerToQuery: number;

    if (typeof startLedgerFromRequest === 'number' && startLedgerFromRequest >= 0) {
      currentLedgerToQuery = startLedgerFromRequest;
      if (currentLedgerToQuery === 0) currentLedgerToQuery = 1;
      console.log(`Using startLedger from request (adjusted to min 1 if 0): ${currentLedgerToQuery}`);
    } else {
      currentLedgerToQuery = lastProcessedLedgerDb > 0 ? lastProcessedLedgerDb + 1 : 0;
      if (currentLedgerToQuery === 0) {
        const maxLookBackLedgers = LEDGER_HISTORY_LIMIT_DAYS * 24 * 60 * 10; // ~10 ledgers per minute
        currentLedgerToQuery = Math.max(1, latestLedgerSequenceOnRpc - maxLookBackLedgers);
        console.log(`No specific startLedger. Starting query from calculated historical ledger (min 1): ${currentLedgerToQuery}`);
      } else {
        console.log(`Using startLedger from DB (last processed + 1): ${currentLedgerToQuery}`);
      }
    }

    console.log(`Last processed ledger in DB (for reference): ${lastProcessedLedgerDb}`);
    console.log(`Latest ledger on RPC: ${latestLedgerSequenceOnRpc}`);

    if (currentLedgerToQuery > latestLedgerSequenceOnRpc && latestLedgerSequenceOnRpc > 0) {
      const message = 'Start ledger is ahead of the latest RPC ledger. No new events to process.';
      console.log(message);
      console.log(`------------------------------------------------------`);
      return { message, eventsFetched: 0, processedUpToLedger: currentLedgerToQuery - 1, lastRpcLedger: latestLedgerSequenceOnRpc };
    }

    let nextCursor: string | undefined = undefined;
    let lastLedgerProcessedInCycle = lastProcessedLedgerDb;
    let totalEventsFetchedThisRun = 0;
    let processedItemsForStorage: any[] = [];
    let iteration = 0;

    do {
      iteration++;
      console.log(`Loop iteration. Current target start ledger: ${currentLedgerToQuery}, Cursor: ${nextCursor || 'none'}`);

      const eventsRequestParams: any = {
        filters: [{ type: 'contract', contractIds: [CONTRACT_ID_TO_INDEX!], topics: [] }],
        pagination: {
          limit: MAX_EVENTS_PER_FETCH,
        },
      };

      if (nextCursor) {
        eventsRequestParams.pagination.cursor = nextCursor;
        console.log(`Using cursor: ${nextCursor} for this request.`);
      } else {
        eventsRequestParams.startLedger = Math.max(1, currentLedgerToQuery);
        console.log(`No cursor. Using startLedger: ${eventsRequestParams.startLedger} for this request.`);
      }

      const rpcPayload = {
        jsonrpc: "2.0",
        id: `getEvents-${iteration}-${Date.now()}`,
        method: "getEvents",
        params: eventsRequestParams,
      };

      console.log('--------------- Attempting to call getEvents via fetch with payload: --------------- ');
      console.log(JSON.stringify(rpcPayload, null, 2));

      let rpcResponse;
      try {
        const rawResponse = await fetch(sorobanRpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rpcPayload),
        });

        if (!rawResponse.ok) {
          const errorBody = await rawResponse.text();
          throw new Error(`RPC request failed with status ${rawResponse.status}: ${errorBody}`);
        }
        rpcResponse = await rawResponse.json();
      } catch (fetchError: any) {
        console.error('Error fetching events via fetch:', fetchError.message);
        throw new Error(`Failed to fetch events via fetch: ${fetchError.message}`);
      }

      console.log('--------------- getEvents via fetch RAW RESPONSE: --------------- ');
      console.log(JSON.stringify(rpcResponse, null, 2));
      console.log('---------------------------------------------------------------------');

      if (rpcResponse.error) {
        console.error('RPC error in getEvents response:', rpcResponse.error);
        throw new Error(`RPC error for getEvents: ${rpcResponse.error.message} (Code: ${rpcResponse.error.code})`);
      }

      const eventsResponse = rpcResponse.result;

      if (eventsResponse && eventsResponse.events && eventsResponse.events.length > 0) {
        totalEventsFetchedThisRun += eventsResponse.events.length;
        console.log(`Fetched ${eventsResponse.events.length} events.`);

        for (const event of eventsResponse.events) {
          let transactionDetails: any = null;
          if (event.txHash) {
            try {
              console.log(`----------- Fetching tx: ${event.txHash} for event ${event.id} -----------`);
              const txRpcPayload = {
                jsonrpc: "2.0",
                id: `getTx-${event.txHash}-${Date.now()}`,
                method: "getTransaction",
                params: { hash: event.txHash },
              };
              const rawTxResponse = await fetch(sorobanRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(txRpcPayload),
              });
              if (!rawTxResponse.ok) {
                const errorBody = await rawTxResponse.text();
                throw new Error(`getTransaction RPC request failed for ${event.txHash} with status ${rawTxResponse.status}: ${errorBody}`);
              }
              const txRpcResponse = await rawTxResponse.json();
              if (txRpcResponse.error) {
                console.error(`RPC error fetching transaction ${event.txHash}:`, txRpcResponse.error);
                throw new Error(`RPC error for getTransaction ${event.txHash}: ${txRpcResponse.error.message} (Code: ${txRpcResponse.error.code})`);
              }
              transactionDetails = txRpcResponse.result;
              console.log(`----------- Fetched tx: ${event.txHash} RAW RESPONSE: -----------`);
              console.log(JSON.stringify(transactionDetails, null, 2));
              console.log(`-------------------------------------------------------------------`);
            } catch (txError: any) {
              console.error(`Error fetching transaction ${event.txHash} for event ${event.id} (fetch):`, txError.message);
            }
          }
          processedItemsForStorage.push({ event, transactionDetails, eventId: event.id });
        }

        const lastEventInBatch = eventsResponse.events[eventsResponse.events.length - 1];
        const ledgerOfLastEventInBatch = typeof lastEventInBatch.ledger === 'string'
          ? parseInt(lastEventInBatch.ledger, 10)
          : lastEventInBatch.ledger;

        lastLedgerProcessedInCycle = Math.max(lastLedgerProcessedInCycle, ledgerOfLastEventInBatch);
      } else {
        console.log('No events found for this request (or empty events array in response.result).');
      }

      nextCursor = eventsResponse?.cursor;
      if (nextCursor) {
        console.log(`Next page cursor: ${nextCursor}. Will continue fetching.`);
      } else {
        console.log('No cursor returned. This was the last page for the current range or no events found.');
        currentLedgerToQuery = lastLedgerProcessedInCycle + 1;
        console.log(`Advancing currentLedgerToQuery to: ${currentLedgerToQuery} for next potential cycle/iteration.`);
        if (currentLedgerToQuery > latestLedgerSequenceOnRpc) {
          console.log('Advanced currentLedgerToQuery is beyond latest RPC ledger. Will break loop.');
          break;
        }
      }

      if (currentLedgerToQuery > latestLedgerSequenceOnRpc + 1 && !nextCursor) {
        console.warn('Safety break: currentLedgerToQuery advanced beyond latest RPC ledger without a new cursor. Stopping cycle.');
        break;
      }
      if (iteration > 1000) {
        console.error('Safety break: Exceeded 1000 iterations. Aborting.');
        throw new Error('Exceeded maximum fetch iterations.');
      }
    } while (nextCursor);

    if (processedItemsForStorage.length > 0) {
      await storeEventsAndTransactionsInDB(processedItemsForStorage);
    }

    if (lastLedgerProcessedInCycle > lastProcessedLedgerDb) {
      await updateLastProcessedLedgerInDB(lastLedgerProcessedInCycle);
    } else if (totalEventsFetchedThisRun === 0 && currentLedgerToQuery > lastProcessedLedgerDb && currentLedgerToQuery <= latestLedgerSequenceOnRpc + 1) {
      const ledgerToUpdateTo = Math.min(currentLedgerToQuery - 1, latestLedgerSequenceOnRpc);
      if (ledgerToUpdateTo > lastProcessedLedgerDb) {
        console.log(`No events found, but updating lastProcessedLedger in DB to ${ledgerToUpdateTo} to reflect scanned empty range.`);
        await updateLastProcessedLedgerInDB(ledgerToUpdateTo);
      }
    }

    const resultMessage = `Event ingestion cycle finished. Fetched ${totalEventsFetchedThisRun} events. Processed up to ledger ${lastLedgerProcessedInCycle}.`;
    console.log(resultMessage);
    console.log(`------------------------------------------------------`);
    return {
      message: resultMessage,
      eventsFetched: totalEventsFetchedThisRun,
      processedUpToLedger: lastLedgerProcessedInCycle,
      lastRpcLedger: latestLedgerSequenceOnRpc,
    };
  } catch (error: any) {
    const errorMessage = `Error in fetchAndStoreEvents (ledger.ts): ${error.message || error}`;
    console.error(errorMessage);
    // Removed: if (error.response && error.response.data) { ... } as error might not be an axios-like error
    console.log(`------------------------------------------------------`);
    throw new Error(errorMessage);
  }
}

export async function getRpcHealth(): Promise<string> {
    console.log('--------------- Attempting to call sorobanServer.getHealth() (ledger.ts) --------------- ');
    const rpcHealth = await sorobanServer.getHealth();
    console.log('--------------- sorobanServer.getHealth() RAW RESPONSE: ------------------');
    console.log(JSON.stringify(rpcHealth, null, 2));
    console.log('--------------------------------------------------------------------------');
    
    if (!rpcHealth || typeof rpcHealth.status !== 'string') {
      console.warn('RPC health response invalid or status missing.');
      return 'error_invalid_response';
    }
    return rpcHealth.status;
} 