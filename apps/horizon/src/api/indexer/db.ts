import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | undefined;

export async function connectToPostgreSQL(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL is not defined. Please set DATABASE_URL environment variable.');
    if (process.env.NODE_ENV !== 'test') {
      console.error("CRITICAL: DATABASE_URL not set, indexer will not function.")
    }
    prisma = undefined;
    return false;
  }
  
  try {
    const enablePrismaDebug =
      process.env.PRISMA_DEBUG === '1' ||
      process.env.PRISMA_DEBUG === 'true' ||
      process.env.NODE_ENV === 'development';

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      },
      log: enablePrismaDebug
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['error']
    });

    if (enablePrismaDebug) {
      (prisma as any).$on('query', (e: any) => {
        console.debug(`[prisma] ${e.duration}ms ${e.query}`, e.params);
      });
    }
    
    // Test the connection
    await prisma.$connect();
    console.log('Successfully connected to PostgreSQL.');
    
    return true;
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
    prisma = undefined;
    return false;
  }
}

// Connect to DB when module is loaded
connectToPostgreSQL();

export async function getDbInstance(): Promise<PrismaClient | undefined> {
  if (!prisma) {
    console.warn("getDbInstance called before DB connection was established or connection failed. Attempting to reconnect...");
    await connectToPostgreSQL();
  }
  return prisma;
}

export async function getLastProcessedLedgerFromDB(): Promise<number> {
  const db = await getDbInstance();
  if (!db) {
    console.error('Failed to get database instance.');
    return 0;
  }
  
  try {
    const metadata = await db.horizonMetadata.findUnique({
      where: { key: 'lastProcessedLedgerMeta' }
    });
    return metadata ? parseInt(metadata.value) : 0;
  } catch (error) {
    console.error('Error fetching last processed ledger from DB:', error);
    return 0;
  }
}

export async function updateLastProcessedLedgerInDB(ledgerSequence: number) {
  const db = await getDbInstance();
  if (!db) {
    console.error('Cannot update last processed ledger, database not initialized.');
    return;
  }
  
  try {
    await db.horizonMetadata.upsert({
      where: { key: 'lastProcessedLedgerMeta' },
      update: { value: ledgerSequence.toString() },
      create: { 
        key: 'lastProcessedLedgerMeta',
        value: ledgerSequence.toString()
      }
    });
    console.log(`Updated lastProcessedLedger in DB to: ${ledgerSequence}`);
  } catch (error) {
    console.error('Error updating last processed ledger in DB:', error);
  }
}

export async function storeEventsAndTransactionsInDB(eventsWithTransactions: any[]) {
  const db = await getDbInstance();
  if (!db) {
    console.error('Cannot store events, database not initialized.');
    return;
  }
  
  if (eventsWithTransactions.length === 0) return;

  try {
    // Process events in a transaction for consistency (increase timeout for transaction fetching)
    const results = await db.$transaction(async (prismaTx) => {
      const operations = eventsWithTransactions.map(async (item) => {
        const ev: any = item.event || {};
        const txDetails: any = item.transactionDetails || item.transaction || {};

        const ledgerNumber = typeof ev.ledger === 'string' ? parseInt(ev.ledger, 10) : ev.ledger;
        const eventTimestamp = ev.timestamp || ev.ledgerClosedAt;
        const txHash = ev.txHash || txDetails.txHash || txDetails.hash;

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
          };

          await prismaTx.horizonTransaction.upsert({
            where: { hash: txDetails.hash || txDetails.txHash },
            update: transactionData,
            create: transactionData
          });
        }

        // Store event AFTER transaction exists
        const eventData = {
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
          txHash: (txDetails && (txDetails.hash || txDetails.txHash)) ? txHash : null,
          txEnvelope: txDetails.envelopeXdr || txDetails.envelope || '',
          txResult: txDetails.resultXdr || txDetails.result || '',
          txMeta: txDetails.resultMetaXdr || txDetails.meta || '',
          txFeeBump: Boolean(txDetails.feeBump),
          txStatus: txDetails.status || 'unknown',
          txCreatedAt: eventTimestamp ? new Date(eventTimestamp) : new Date(),
        };

        return prismaTx.horizonEvent.upsert({
          where: { eventId: ev.id },
          update: eventData,
          create: eventData
        });
      });
      
      return Promise.all(operations);
    }, {
      timeout: 30000, // 30 seconds timeout instead of default 5 seconds
    });
    
    console.log(`Stored ${results.length} event-transaction pairs.`);
  } catch (error) {
    console.error('Error storing event-transaction pairs in PostgreSQL:', error);
  }
}

export async function storeOperationsInDB(operations: any[]) {
  const db = await getDbInstance();
  if (!db || operations.length === 0) return;

  try {
    const results = await db.$transaction(async (prismaTx) => {
      const ops = operations.map(async (op) => {
        const operationData = {
          operationId: op.id,
          transactionHash: op.transaction_hash,
          operationIndex: op.operation_index || 0,
          type: op.type,
          typeI: op.type_i || 0,
          details: op,
          sourceAccount: op.source_account,
          contractId: op.contract_id,
          function: op.function,
          parameters: op.parameters || null,
        };

        return prismaTx.horizonOperation.upsert({
          where: { operationId: op.id },
          update: operationData,
          create: operationData
        });
      });
      
      return Promise.all(ops);
    });
    
    console.log(`Stored ${results.length} operations.`);
  } catch (error) {
    console.error('Error storing operations:', error);
  }
}

export async function storeEffectsInDB(effects: any[]) {
  const db = await getDbInstance();
  if (!db || effects.length === 0) return;

  try {
    const results = await db.$transaction(async (prismaTx) => {
      const effs = effects.map(async (effect) => {
        const effectData = {
          effectId: effect.id,
          operationId: effect.operation_id,
          transactionHash: effect.transaction_hash,
          type: effect.type,
          typeI: effect.type_i || 0,
          details: effect,
          account: effect.account,
        };

        return prismaTx.horizonEffect.upsert({
          where: { effectId: effect.id },
          update: effectData,
          create: effectData
        });
      });
      
      return Promise.all(effs);
    });
    
    console.log(`Stored ${results.length} effects.`);
  } catch (error) {
    console.error('Error storing effects:', error);
  }
}

export async function storeContractDataInDB(contractData: any[]) {
  const db = await getDbInstance();
  if (!db || contractData.length === 0) return;

  try {
    const results = await db.$transaction(async (prismaTx) => {
      const data = contractData.map(async (item) => {
        const dataEntry = {
          contractId: item.contract_id,
          key: item.key,
          value: item.val,
          durability: item.durability || 'persistent',
          ledger: item.ledger || 0,
          timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
          previousValue: item.previous_val || null,
          isDeleted: Boolean(item.deleted),
        };

        return prismaTx.horizonContractData.upsert({
          where: { 
            contractId_key_ledger: {
              contractId: item.contract_id,
              key: item.key,
              ledger: item.ledger || 0
            }
          },
          update: dataEntry,
          create: dataEntry
        });
      });
      
      return Promise.all(data);
    });
    
    console.log(`Stored ${results.length} contract data entries.`);
  } catch (error) {
    console.error('Error storing contract data:', error);
  }
}

export async function storeAccountsInDB(accounts: any[]) {
  const db = await getDbInstance();
  if (!db || accounts.length === 0) return;

  try {
    const results = await db.$transaction(async (prismaTx) => {
      const accs = accounts.map(async (account) => {
        const accountData = {
          accountId: account.account_id,
          sequence: account.sequence,
          balances: account.balances || [],
          signers: account.signers || [],
          data: account.data || {},
          flags: account.flags || 0,
          homeDomain: account.home_domain,
          thresholds: account.thresholds || {},
          isContract: Boolean(account.is_contract),
          contractCode: account.contract_code,
          operationCount: account.operation_count || 0,
          lastActivity: account.last_modified_time ? new Date(account.last_modified_time) : null,
        };

        return prismaTx.horizonAccount.upsert({
          where: { accountId: account.account_id },
          update: accountData,
          create: accountData
        });
      });
      
      return Promise.all(accs);
    });
    
    console.log(`Stored ${results.length} accounts.`);
  } catch (error) {
    console.error('Error storing accounts:', error);
  }
}

export async function storePaymentsInDB(payments: any[]) {
  const db = await getDbInstance();
  if (!db || payments.length === 0) return;

  try {
    const results = await db.$transaction(async (prismaTx) => {
      const pymnts = payments.map(async (payment) => {
        const paymentData = {
          paymentId: payment.id,
          transactionHash: payment.transaction_hash,
          operationId: payment.operation_id,
          from: payment.from,
          to: payment.to,
          asset: {
            type: payment.asset_type,
            code: payment.asset_code,
            issuer: payment.asset_issuer
          },
          amount: payment.amount,
          timestamp: payment.created_at ? new Date(payment.created_at) : new Date(),
        };

        return prismaTx.horizonPayment.upsert({
          where: { paymentId: payment.id },
          update: paymentData,
          create: paymentData
        });
      });
      
      return Promise.all(pymnts);
    });
    
    console.log(`Stored ${results.length} payments.`);
  } catch (error) {
    console.error('Error storing payments:', error);
  }
}

// Clean up on process exit
process.on('beforeExit', async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});