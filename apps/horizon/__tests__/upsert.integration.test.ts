import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { getDB } from '../src/common/db'
import { connectToPostgreSQL } from '../src/common/prisma'
import { storeTransactionsInDB } from '../src/repository/transactions.repository'
import { storeOperationsInDB } from '../src/repository/operations.repository'

// Helper function to test events upsert logic directly
async function storeEventsInDB(eventsWithTransactions: any[]): Promise<number> {
  const db = await getDB()
  if (!db || eventsWithTransactions.length === 0) return 0

  let totalStored = 0
  
  try {
    for (const item of eventsWithTransactions) {
      const ev: any = item.event || {}
      const txDetails: any = item.transactionDetails || item.transaction || {}

      const ledgerNumber = typeof ev.ledger === 'string' ? parseInt(ev.ledger, 10) : ev.ledger
      const eventTimestamp = ev.timestamp || ev.ledgerClosedAt
      const txHash = ev.txHash || txDetails.txHash || txDetails.hash

      // Store event data
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
        txHash: txDetails && (txDetails.hash || txDetails.txHash) ? txHash : null,
        txEnvelope: txDetails.envelopeXdr || txDetails.envelope || '',
        txResult: txDetails.resultXdr || txDetails.result || '',
        txMeta: txDetails.resultMetaXdr || txDetails.meta || '',
        txFeeBump: Boolean(txDetails.feeBump),
        txStatus: txDetails.status || 'unknown',
        txCreatedAt: eventTimestamp ? new Date(eventTimestamp) : new Date(),
      }

      await db.horizonEvent.upsert({
        where: { eventId: ev.id },
        update: eventData,
        create: eventData,
      })
      
      totalStored++
    }
    
    return totalStored
  } catch (error) {
    console.error('Error storing events:', error)
    return 0
  }
}

const UPSERT_TIMEOUT = 30000

describe('Upsert Integration Test', () => {
  let db: any

  beforeAll(async () => {
    await connectToPostgreSQL()
    db = await getDB()
    
    if (!db) {
      throw new Error('Failed to connect to test database')
    }

    // Clean up any existing test data
    await cleanupTestData()
  }, 30000)

  afterAll(async () => {
    if (db) {
      await cleanupTestData()
      await db.$disconnect()
    }
  }, 10000)

  async function cleanupTestData() {
    if (!db) return

    try {
      // Delete test data
      await db.horizonEvent.deleteMany({
        where: {
          eventId: { startsWith: 'test-' }
        }
      })

      await db.horizonOperation.deleteMany({
        where: {
          operationId: { startsWith: 'test-' }
        }
      })

      await db.horizonTransaction.deleteMany({
        where: {
          hash: { startsWith: 'test-' }
        }
      })

      console.log('✅ Test data cleanup completed')
    } catch (error) {
      console.error('❌ Error during cleanup:', error)
    }
  }

  it('should properly handle duplicate transaction upserts without creating duplicates', async () => {
    console.log('🔄 Testing transaction upsert behavior...')

    // Create test transaction data
    const testTransaction = {
      hash: 'test-tx-duplicate-123',
      ledger: 999999,
      timestamp: new Date(),
      sourceAccount: 'test-account',
      fee: '100000',
      operationCount: 1,
      envelope: { type: 'test' },
      result: { success: true },
      meta: { operations: [] },
      successful: true
    }

    // First upsert
    console.log('📡 First transaction upsert...')
    const firstResult = await storeTransactionsInDB([testTransaction])
    expect(firstResult).toBe(1)

    // Verify transaction was created
    const afterFirst = await db.horizonTransaction.count({
      where: { hash: testTransaction.hash }
    })
    expect(afterFirst).toBe(1)

    // Second upsert with same hash (should not create duplicate)
    console.log('📡 Second transaction upsert (duplicate)...')
    const secondResult = await storeTransactionsInDB([testTransaction])
    expect(secondResult).toBe(1) // Function still returns 1 (processed)

    // Verify no duplicate was created
    const afterSecond = await db.horizonTransaction.count({
      where: { hash: testTransaction.hash }
    })
    expect(afterSecond).toBe(1) // Should still be 1, not 2

    console.log('✅ Transaction upsert test passed - no duplicates created')
  }, UPSERT_TIMEOUT)

  it('should properly handle duplicate operation upserts without creating duplicates', async () => {
    console.log('🔄 Testing operation upsert behavior...')

    // Create test operation data
    const testOperation = {
      id: 'test-op-duplicate-123',
      transaction_hash: 'test-tx-for-op-123',
      type: 'invoke_host_function',
      source_account: 'test-account',
      successful: true,
      transaction_successful: true
    }

    const contractIds = ['test-contract-123']

    // First upsert
    console.log('⚙️ First operation upsert...')
    const firstResult = await storeOperationsInDB([testOperation], contractIds)
    expect(firstResult).toBe(1)

    // Verify operation was created
    const afterFirst = await db.horizonOperation.count({
      where: { operationId: testOperation.id }
    })
    expect(afterFirst).toBe(1)

    // Second upsert with same operationId (should not create duplicate)
    console.log('⚙️ Second operation upsert (duplicate)...')
    const secondResult = await storeOperationsInDB([testOperation], contractIds)
    expect(secondResult).toBe(1) // Function still returns 1 (processed)

    // Verify no duplicate was created
    const afterSecond = await db.horizonOperation.count({
      where: { operationId: testOperation.id }
    })
    expect(afterSecond).toBe(1) // Should still be 1, not 2

    console.log('✅ Operation upsert test passed - no duplicates created')
  }, UPSERT_TIMEOUT)

  it('should verify database uniqueness constraints', async () => {
    console.log('🔍 Testing database uniqueness constraints...')

    // Try to directly create duplicate transaction (should fail)
    const duplicateTransaction = {
      hash: 'test-constraint-tx-123',
      ledger: 999998,
      timestamp: new Date(),
      sourceAccount: 'test-account',
      fee: '50000',
      operationCount: 1,
      envelope: {},
      result: {},
      meta: {},
      successful: true
    }

    // First creation should succeed
    await db.horizonTransaction.create({ data: duplicateTransaction })

    // Second creation with same hash should fail
    let constraintError = false
    try {
      await db.horizonTransaction.create({ data: duplicateTransaction })
    } catch (error: any) {
      constraintError = true
      expect(error.message).toContain('Unique constraint')
    }

    expect(constraintError).toBe(true)
    console.log('✅ Database constraint test passed - duplicate creation blocked')

    // But upsert should work fine
    await db.horizonTransaction.upsert({
      where: { hash: duplicateTransaction.hash },
      update: { fee: '75000' },
      create: duplicateTransaction
    })

    const updated = await db.horizonTransaction.findUnique({
      where: { hash: duplicateTransaction.hash }
    })
    expect(updated.fee).toBe('75000')

    console.log('✅ Upsert on existing record works correctly')
  }, UPSERT_TIMEOUT)

  it('should handle concurrent upserts correctly', async () => {
    console.log('🔄 Testing concurrent upsert behavior...')

    const testHash = 'test-concurrent-tx-123'
    const baseTransaction = {
      hash: testHash,
      ledger: 999997,
      timestamp: new Date(),
      sourceAccount: 'test-account',
      fee: '100000',
      operationCount: 1,
      envelope: {},
      result: {},
      meta: {},
      successful: true
    }

    // Run multiple concurrent upserts
    const promises = Array.from({ length: 5 }, (_, i) => 
      storeTransactionsInDB([{
        ...baseTransaction,
        sourceAccount: `test-account-${i}` // Slightly different data
      }])
    )

    const results = await Promise.all(promises)
    console.log('📊 Concurrent results:', results)

    // Should have exactly one record regardless of how many upserts ran
    const finalCount = await db.horizonTransaction.count({
      where: { hash: testHash }
    })
    expect(finalCount).toBe(1)

    console.log('✅ Concurrent upsert test passed - only one record exists')
  }, UPSERT_TIMEOUT)

  it('should properly handle duplicate event upserts without creating duplicates', async () => {
    console.log('🔄 Testing event upsert behavior...')

    // First create the transaction that the event will reference
    const testTransaction = {
      hash: 'test-tx-for-event-123',
      ledger: 999996,
      timestamp: new Date(),
      sourceAccount: 'test-account',
      fee: '100000',
      operationCount: 1,
      envelope: { type: 'test' },
      result: { success: true },
      meta: { operations: [] },
      successful: true
    }

    console.log('📡 Creating transaction for event test...')
    await storeTransactionsInDB([testTransaction])

    // Create test event data
    const testEvent = {
      event: {
        id: 'test-event-duplicate-123',
        ledger: 999996,
        timestamp: new Date().toISOString(),
        contractId: 'test-contract-123',
        type: 'ATTEST',
        data: {
          topic: ['test-topic'],
          value: 'test-value',
          pagingToken: 'test-token',
          inSuccessfulContractCall: true,
        }
      },
      transactionDetails: {
        hash: 'test-tx-for-event-123',
        sourceAccount: 'test-account',
        successful: true,
        status: 'SUCCESS'
      }
    }

    // First upsert
    console.log('📡 First event upsert...')
    const firstResult = await storeEventsInDB([testEvent])
    expect(firstResult).toBe(1)

    // Verify event was created
    const afterFirst = await db.horizonEvent.count({
      where: { eventId: testEvent.event.id }
    })
    expect(afterFirst).toBe(1)

    // Second upsert with same eventId (should not create duplicate)
    console.log('📡 Second event upsert (duplicate)...')
    const secondResult = await storeEventsInDB([testEvent])
    expect(secondResult).toBe(1) // Function still returns 1 (processed)

    // Verify no duplicate was created
    const afterSecond = await db.horizonEvent.count({
      where: { eventId: testEvent.event.id }
    })
    expect(afterSecond).toBe(1) // Should still be 1, not 2

    console.log('✅ Event upsert test passed - no duplicates created')

    // Test updating existing event
    const updatedEvent = {
      ...testEvent,
      event: {
        ...testEvent.event,
        type: 'REVOKE', // Change event type
        contractId: 'updated-contract-123'
      }
    }

    console.log('🔄 Testing event update via upsert...')
    const updateResult = await storeEventsInDB([updatedEvent])
    expect(updateResult).toBe(1)

    // Verify the event was updated, not duplicated
    const afterUpdate = await db.horizonEvent.count({
      where: { eventId: testEvent.event.id }
    })
    expect(afterUpdate).toBe(1)

    // Verify the data was actually updated
    const updatedRecord = await db.horizonEvent.findUnique({
      where: { eventId: testEvent.event.id }
    })
    expect(updatedRecord?.eventType).toBe('REVOKE')
    expect(updatedRecord?.contractId).toBe('updated-contract-123')

    console.log('✅ Event update test passed - existing record updated correctly')
  }, UPSERT_TIMEOUT)

  it('should handle concurrent event upserts correctly', async () => {
    console.log('🔄 Testing concurrent event upsert behavior...')

    // First create the transaction for concurrent event test
    const concurrentTransaction = {
      hash: 'test-concurrent-tx-123',
      ledger: 999995,
      timestamp: new Date(),
      sourceAccount: 'test-account',
      fee: '100000',
      operationCount: 1,
      envelope: { type: 'test' },
      result: { success: true },
      meta: { operations: [] },
      successful: true
    }

    console.log('📡 Creating transaction for concurrent event test...')
    await storeTransactionsInDB([concurrentTransaction])

    const testEventId = 'test-concurrent-event-123'
    const baseEvent = {
      event: {
        id: testEventId,
        ledger: 999995,
        timestamp: new Date().toISOString(),
        contractId: 'test-contract-123',
        type: 'ATTEST',
        data: {
          topic: ['test-topic'],
          value: 'test-value',
          pagingToken: 'test-token',
          inSuccessfulContractCall: true,
        }
      },
      transactionDetails: {
        hash: 'test-concurrent-tx-123',
        sourceAccount: 'test-account',
        successful: true,
        status: 'SUCCESS'
      }
    }

    // Run multiple concurrent upserts
    const promises = Array.from({ length: 5 }, (_, i) => 
      storeEventsInDB([{
        ...baseEvent,
        event: {
          ...baseEvent.event,
          contractId: `test-contract-${i}` // Slightly different data
        }
      }])
    )

    const results = await Promise.all(promises)
    console.log('📊 Concurrent event results:', results)

    // Should have exactly one record regardless of how many upserts ran
    const finalCount = await db.horizonEvent.count({
      where: { eventId: testEventId }
    })
    expect(finalCount).toBe(1)

    console.log('✅ Concurrent event upsert test passed - only one record exists')
  }, UPSERT_TIMEOUT)
})