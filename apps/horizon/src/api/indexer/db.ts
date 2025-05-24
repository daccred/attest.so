import prisma from './prisma';



export async function getLastProcessedLedgerFromDB(): Promise<number> {
  try {
    const metadata = await prisma.metadata.findUnique({
      where: { key: 'lastProcessedLedgerMeta' }
    });
    return metadata ? metadata.value : 0;
  } catch (error) {
    console.error('Error fetching last processed ledger from DB (Prisma):', error);
    return 0;
  }
}

export async function updateLastProcessedLedgerInDB(ledgerSequence: number) {
  console.debug(`[DEBUG] Attempting to upsert lastProcessedLedgerMeta to ${ledgerSequence} in DB.`);
  try {
    await prisma.metadata.upsert({
      where: { key: 'lastProcessedLedgerMeta' },
      update: { value: ledgerSequence },
      create: { key: 'lastProcessedLedgerMeta', value: ledgerSequence }
    });
    console.log(`[INFO] Successfully upserted lastProcessedLedger in DB to: ${ledgerSequence}`);
  } catch (error) {
    console.error('Error updating last processed ledger in DB (Prisma):', error);
  }
}

export async function storeEventsAndTransactionsInDB(eventsWithTransactions: any[]) {
  console.debug(
    `[DEBUG] storeEventsAndTransactionsInDB called with ${eventsWithTransactions.length} items at ${new Date().toISOString()}`
  );

  if (eventsWithTransactions.length === 0) {
    console.debug('[DEBUG] No events to store, exiting function.');
    return;
  }

  console.debug(`[DEBUG] Attempting to upsert ${eventsWithTransactions.length} contract events in DB.`);
  try {
    for (const item of eventsWithTransactions) {
      console.debug(`[DEBUG] Upserting eventId: ${item.event.id}`);
      await prisma.contractEvent.upsert({
        where: { eventId: item.event.id },
        update: { ...item, ingestedAt: new Date() },
        create: { ...item, eventId: item.event.id, ingestedAt: new Date() }
      });
    }
    console.log(`[INFO] Successfully upserted ${eventsWithTransactions.length} events.`);
  } catch (error) {
    console.error('[ERROR] Error storing event-transaction pairs in DB via Prisma:', error);
  }
}