import { rpc } from '@stellar/stellar-sdk'; // SDK still used for getLatestLedger and getHealth
import {
  sorobanRpcUrl,
  CONTRACT_ID_TO_INDEX,
  CONTRACT_IDS,
  MAX_EVENTS_PER_FETCH,
  MAX_OPERATIONS_PER_FETCH,
  LEDGER_HISTORY_LIMIT_DAYS,
} from './constants';
import {
  getLastProcessedLedgerFromDB,
  updateLastProcessedLedgerInDB,
  storeEventsAndTransactionsInDB,
  storeContractOperationsInDB,
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

      // Use Stellar Horizon API for operations (not Soroban RPC)
      const horizonUrl = sorobanRpcUrl.includes('testnet') 
        ? 'https://horizon-testnet.stellar.org'
        : 'https://horizon.stellar.org';
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

    // Use Stellar Horizon API for effects (not Soroban RPC)
    const horizonUrl = sorobanRpcUrl.includes('testnet') 
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org';
    const queryString = new URLSearchParams(baseParams).toString();
    const url = `${horizonUrl}/effects?${queryString}`;

    const response = await fetch(url, {
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

    // Use Stellar Horizon API for payments (not Soroban RPC)
    const horizonUrl = sorobanRpcUrl.includes('testnet') 
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org';
    const queryString = new URLSearchParams(baseParams).toString();
    const url = `${horizonUrl}/payments?${queryString}`;

    const response = await fetch(url, {
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

    // Use Stellar Horizon API for accounts (not Soroban RPC)
    const horizonUrl = sorobanRpcUrl.includes('testnet') 
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org';

    const response = await fetch(`${horizonUrl}/accounts/${accountId}`, {
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

/**
 * Enhanced contract-specific operations fetcher
 * Fetches all operations that involve any of the specified contracts
 */
export async function fetchContractOperations(
  contractIds: string[] = CONTRACT_IDS,
  startLedger?: number,
  includeFailedTx?: boolean
): Promise<{
  operations: any[];
  transactions: any[];
  accounts: Set<string>;
  failedOperations: any[];
  operationsFetched: number;
  transactionsFetched: number;
}> {
  const operations: any[] = [];
  const transactions: any[] = [];
  const accountsSet = new Set<string>();
  const failedOperations: any[] = [];
  
  console.log(`🔍 Fetching contract operations for ${contractIds.length} contracts from ledger ${startLedger || 'latest'}`);
  
  // For each contract, fetch all operations using account-based queries
  // In Stellar, contracts are accounts, so we can fetch operations by account
  for (const contractId of contractIds) {
    try {
      console.log(`📋 Fetching operations for contract: ${contractId}`);
      
      const contractOps = await fetchOperationsFromHorizon({
        accountId: contractId,  // Use accountId instead of contractId
        limit: MAX_OPERATIONS_PER_FETCH
      });
      
      console.log(`✅ Found ${contractOps.length} operations for contract ${contractId}`);
      
      operations.push(...contractOps);
      
      // Extract unique accounts and track failed operations
      for (const op of contractOps) {
        if (op.source_account) {
          accountsSet.add(op.source_account);
        }
        
        // Check if operation was in a failed transaction
        if (!op.successful || (op.transaction_successful === false)) {
          failedOperations.push(op);
        }
      }
      
    } catch (error: any) {
      console.error(`❌ Error fetching operations for contract ${contractId}:`, error.message);
    }
  }
  
  // Get unique transaction hashes and fetch full transaction details
  const txHashes = [...new Set(operations.map(op => op.transaction_hash).filter(Boolean))];
  console.log(`📦 Fetching ${txHashes.length} unique transactions for operations`);
  
  for (const txHash of txHashes) {
    try {
      const txDetails = await fetchTransactionDetails(txHash);
      if (txDetails) {
        transactions.push(txDetails);
      }
    } catch (error: any) {
      console.error(`❌ Error fetching transaction ${txHash}:`, error.message);
    }
  }
  
  // Store contract operations in database with proper contract mapping
  if (operations.length > 0) {
    console.log(`💾 Storing ${operations.length} contract operations in database...`);
    
    // Add contract ID mapping to each operation before storing
    const operationsWithContract = operations.map(op => ({
      ...op,
      _contractId: contractIds.find(id => 
        // The operation belongs to whichever contract account we fetched it from
        op.source_account === id || 
        op.account === id ||
        JSON.stringify(op).includes(id)
      ) || contractIds[0]
    }));
    
    const storedCount = await storeContractOperationsInDB(operationsWithContract, contractIds);
    console.log(`✅ Stored ${storedCount} contract operations successfully`);
  }
  
  return {
    operations,
    transactions,
    accounts: accountsSet,
    failedOperations,
    operationsFetched: operations.length,
    transactionsFetched: transactions.length
  };
}

/**
 * Comprehensive contract data fetcher - gets ALL data related to contracts
 * Combines events, operations, transactions, and account activity
 */
export async function fetchContractComprehensiveData(
  startLedger?: number,
  contractIds: string[] = CONTRACT_IDS
): Promise<{
  events: any[];
  operations: any[];
  transactions: any[];
  accounts: Set<string>;
  failedOperations: any[];
  summary: {
    eventsFetched: number;
    operationsFetched: number;
    transactionsFetched: number;
    accountsInvolved: number;
    failedOperations: number;
    processedUpToLedger: number;
  };
}> {
  console.log(`🚀 Starting comprehensive contract data collection for ${contractIds.length} contracts`);
  console.log(`📋 Contracts: ${contractIds.join(', ')}`);
  
  // 1. Fetch events using existing event-based approach (for events with data)
  console.log('📅 Step 1: Fetching contract events...');
  const eventsResult = await fetchAndStoreEvents(startLedger);
  const events: any[] = []; // We'll need to query the DB for events to get them in the right format
  
  // 2. Fetch all contract operations (including those without events)
  console.log('⚙️ Step 2: Fetching contract operations...');
  const operationsResult = await fetchContractOperations(contractIds, startLedger, true);
  
  // 3. Combine transaction data from both sources
  console.log('🔗 Step 3: Consolidating transaction data...');
  const allTransactionHashes = new Set([
    ...operationsResult.transactions.map(tx => tx.hash || tx.txHash),
  ]);
  
  // 4. Identify accounts involved in contract interactions
  const allAccounts = new Set([...operationsResult.accounts]);
  
  console.log(`✅ Comprehensive data collection completed:`);
  console.log(`   - Events fetched: ${eventsResult.eventsFetched}`);
  console.log(`   - Operations fetched: ${operationsResult.operationsFetched}`);
  console.log(`   - Transactions processed: ${allTransactionHashes.size}`);
  console.log(`   - Accounts involved: ${allAccounts.size}`);
  console.log(`   - Failed operations: ${operationsResult.failedOperations.length}`);
  
  return {
    events,
    operations: operationsResult.operations,
    transactions: operationsResult.transactions,
    accounts: allAccounts,
    failedOperations: operationsResult.failedOperations,
    summary: {
      eventsFetched: eventsResult.eventsFetched,
      operationsFetched: operationsResult.operationsFetched,
      transactionsFetched: allTransactionHashes.size,
      accountsInvolved: allAccounts.size,
      failedOperations: operationsResult.failedOperations.length,
      processedUpToLedger: eventsResult.processedUpToLedger
    }
  };
}

/**
 * Helper function to fetch transaction details by hash
 */
async function fetchTransactionDetails(txHash: string): Promise<any | null> {
  try {
    const txRpcPayload = {
      jsonrpc: "2.0",
      id: `getTx-${txHash}-${Date.now()}`,
      method: "getTransaction",
      params: { hash: txHash },
    };
    
    const rawTxResponse = await fetch(sorobanRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txRpcPayload),
    });
    
    if (!rawTxResponse.ok) {
      throw new Error(`HTTP ${rawTxResponse.status}`);
    }
    
    const txRpcResponse = await rawTxResponse.json();
    
    if (txRpcResponse.error) {
      throw new Error(txRpcResponse.error.message);
    }
    
    return txRpcResponse.result;
  } catch (error: any) {
    console.error(`Error fetching transaction ${txHash}:`, error.message);
    return null;
  }
}