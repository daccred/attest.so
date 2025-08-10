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
  getDbInstance,
} from './db';
import { IndexerErrorHandler, PerformanceMonitor, RateLimiter } from './error-handler';

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

  const db = await getDbInstance();
  if (!db) {
    const errMsg = 'Database not connected (checked in fetchAndStoreEvents). Aborting event fetch.';
    console.error(errMsg);
    console.log(`------------------------------------------------------`);
    throw new Error(errMsg);
  }
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
    let prevCursor: string | undefined = undefined;
    let staleCursorCount = 0;

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

        const batchItems: any[] = [];
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
          batchItems.push({ event, transactionDetails, eventId: event.id });
        }

        const lastEventInBatch = eventsResponse.events[eventsResponse.events.length - 1];
        const ledgerOfLastEventInBatch = typeof lastEventInBatch.ledger === 'string'
          ? parseInt(lastEventInBatch.ledger, 10)
          : lastEventInBatch.ledger;

        lastLedgerProcessedInCycle = Math.max(lastLedgerProcessedInCycle, ledgerOfLastEventInBatch);

        // Flush this batch immediately to avoid losing progress if we later get stuck on a stale cursor
        try {
          await storeEventsAndTransactionsInDB(batchItems);
          // Reset any accumulated items since we flush per batch now
          processedItemsForStorage = [];
        } catch (storeErr) {
          console.error('Error flushing batch to DB:', (storeErr as any)?.message || storeErr);
        }

        staleCursorCount = 0; // reset on progress
      } else {
        console.log('No events found for this request (or empty events array in response.result).');
        // If RPC keeps returning the same cursor with no events, break to avoid an infinite loop
        if (eventsResponse?.cursor) {
          if (prevCursor === eventsResponse.cursor) {
            staleCursorCount++;
            console.log(`Cursor unchanged with empty events. Repeat count: ${staleCursorCount}`);
            if (staleCursorCount >= 3) {
              console.log('Breaking fetch loop due to repeated empty responses with unchanged cursor.');
              nextCursor = undefined;
              break;
            }
          } else {
            staleCursorCount = 0;
          }
        }
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

      prevCursor = nextCursor;

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

/**
 * Fetch operations for a transaction or account from Horizon
 */
export async function fetchOperationsFromHorizon(params: {
  transactionHash?: string;
  accountId?: string;
  contractId?: string;
  cursor?: string;
  limit?: number;
}): Promise<any[]> {
  const { transactionHash, accountId, contractId, cursor, limit = 100 } = params;
  
  return await PerformanceMonitor.measureAsync('fetchOperationsFromHorizon', async () => {
    // Rate limiting: max 50 requests per minute
    if (!RateLimiter.canProceed('operations', 50, 60000)) {
      IndexerErrorHandler.logWarning('Rate limit reached for operations API');
      return [];
    }

    try {
      const baseParams: any = {
        limit: Math.min(limit, 200), // Enforce maximum limit
        order: 'desc'
      };
      
      if (cursor) baseParams.cursor = cursor;
      if (transactionHash) baseParams.for_transaction = transactionHash;
      if (accountId) baseParams.for_account = accountId;
      
      IndexerErrorHandler.logInfo('Fetching operations from Horizon', baseParams);

      const horizonUrl = sorobanRpcUrl.replace('/soroban/rpc', '');
      const queryString = new URLSearchParams(baseParams).toString();
      const url = `${horizonUrl}/operations?${queryString}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const operations = data._embedded?.records || [];
      
      IndexerErrorHandler.logSuccess(`Fetched ${operations.length} operations`);
      return operations;
    } catch (error: any) {
      IndexerErrorHandler.handleRpcError(error, 'fetchOperationsFromHorizon');
      return [];
    }
  });
}

/**
 * Fetch effects for an operation or transaction from Horizon
 */
export async function fetchEffectsFromHorizon(params: {
  operationId?: string;
  transactionHash?: string;
  accountId?: string;
  cursor?: string;
  limit?: number;
}): Promise<any[]> {
  const { operationId, transactionHash, accountId, cursor, limit = 100 } = params;
  
  try {
    const baseParams: any = {
      limit,
      order: 'desc'
    };
    
    if (cursor) baseParams.cursor = cursor;
    if (operationId) baseParams.for_operation = operationId;
    if (transactionHash) baseParams.for_transaction = transactionHash;
    if (accountId) baseParams.for_account = accountId;
    
    console.log('Fetching effects from Horizon with params:', baseParams);

    const response = await fetch(sorobanRpcUrl.replace('/soroban/rpc', '') + '/effects', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Effects request failed: ${response.status}`);
    }

    const data = await response.json();
    return data._embedded?.records || [];
  } catch (error: any) {
    console.error('Error fetching effects:', error.message);
    return [];
  }
}

/**
 * Fetch payments for an account from Horizon
 */
export async function fetchPaymentsFromHorizon(params: {
  accountId?: string;
  cursor?: string;
  limit?: number;
}): Promise<any[]> {
  const { accountId, cursor, limit = 100 } = params;
  
  try {
    const baseParams: any = {
      limit,
      order: 'desc'
    };
    
    if (cursor) baseParams.cursor = cursor;
    if (accountId) baseParams.for_account = accountId;
    
    console.log('Fetching payments from Horizon with params:', baseParams);

    const response = await fetch(sorobanRpcUrl.replace('/soroban/rpc', '') + '/payments', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Payments request failed: ${response.status}`);
    }

    const data = await response.json();
    return data._embedded?.records || [];
  } catch (error: any) {
    console.error('Error fetching payments:', error.message);
    return [];
  }
}

/**
 * Fetch account details from Horizon
 */
export async function fetchAccountFromHorizon(accountId: string): Promise<any | null> {
  try {
    console.log(`Fetching account ${accountId} from Horizon`);

    const response = await fetch(sorobanRpcUrl.replace('/soroban/rpc', '') + `/accounts/${accountId}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Account ${accountId} not found`);
        return null;
      }
      throw new Error(`Account request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`Error fetching account ${accountId}:`, error.message);
    return null;
  }
}

/**
 * Fetch contract data from Soroban RPC
 */
export async function fetchContractDataFromSoroban(params: {
  contractId: string;
  key: string;
  durability?: 'persistent' | 'temporary';
}): Promise<any | null> {
  const { contractId, key, durability = 'persistent' } = params;
  
  try {
    const rpcPayload = {
      jsonrpc: "2.0",
      id: `getContractData-${Date.now()}`,
      method: "getLedgerEntries",
      params: {
        keys: [{
          type: 'contractData',
          contractId,
          key,
          durability
        }]
      },
    };

    console.log(`Fetching contract data for ${contractId}/${key}:`, JSON.stringify(rpcPayload, null, 2));

    const response = await fetch(sorobanRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcPayload),
    });

    if (!response.ok) {
      throw new Error(`Contract data request failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      console.error('RPC error fetching contract data:', data.error);
      return null;
    }

    return data.result?.entries?.[0] || null;
  } catch (error: any) {
    console.error(`Error fetching contract data for ${contractId}/${key}:`, error.message);
    return null;
  }
}

/**
 * Comprehensive data fetcher that gets all related data for events
 */
export async function fetchComprehensiveContractData(startLedger?: number): Promise<{
  events: any[];
  operations: any[];
  effects: any[];
  accounts: any[];
  payments: any[];
  contractData: any[];
}> {
  console.log('Starting comprehensive contract data fetch...');
  
  // First fetch events (existing logic)
  const eventResults = await fetchAndStoreEvents(startLedger);
  
  // Get all unique transaction hashes and account IDs from events
  const db = await getDbInstance();
  if (!db) return { events: [], operations: [], effects: [], accounts: [], payments: [], contractData: [] };
  
  const recentEvents = await (db as any).horizonEvent.findMany({
    take: 1000,
    orderBy: { timestamp: 'desc' },
    select: { txHash: true, contractId: true }
  });
  
  const txHashes = [...new Set((recentEvents as any[]).map((e: any) => e.txHash as string).filter((h: string) => !!h))];
  const contractIds = [...new Set((recentEvents as any[]).map((e: any) => e.contractId as string).filter((c: string) => !!c))];
  
  // Fetch operations for these transactions
  const operations: any[] = [];
  for (const txHash of txHashes.slice(0, 100)) { // Limit to avoid rate limits
    const ops = await fetchOperationsFromHorizon({ transactionHash: txHash });
    operations.push(...ops);
  }
  
  // Fetch effects for these operations
  const effects: any[] = [];
  for (const op of operations.slice(0, 100)) {
    const effs = await fetchEffectsFromHorizon({ operationId: op.id });
    effects.push(...effs);
  }
  
  // Fetch account details for contract accounts
  const accounts: any[] = [];
  for (const contractId of contractIds.slice(0, 50)) {
    const account = await fetchAccountFromHorizon(contractId);
    if (account) accounts.push(account);
  }
  
  // Fetch payments for these accounts
  const payments: any[] = [];
  for (const contractId of contractIds.slice(0, 20)) {
    const pymts = await fetchPaymentsFromHorizon({ accountId: contractId });
    payments.push(...pymts);
  }
  
  // TODO: Fetch contract data entries would require knowing specific keys
  const contractData: any[] = [];
  
  return {
    events: eventResults ? [eventResults] : [],
    operations,
    effects,
    accounts,
    payments,
    contractData
  };
}