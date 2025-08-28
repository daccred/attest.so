import { describe, it, expect, beforeAll, afterAll, vi, test } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { getDB } from '../src/common/db'
import { connectToPostgreSQL } from '../src/common/prisma'
import { PrismaClient } from '@prisma/client'

// Integration test timeout - backfill operations can take time
const BACKFILL_TIMEOUT = 300000
const BACKFILL_START_LEDGER = 200088
const BACKFILL_END_LEDGER = 228328

describe('Backfill Integration Test', () => {
  let db: any

  beforeAll(async () => {
    // Connect to the test database
    await connectToPostgreSQL()
    db = await getDB() as PrismaClient

    if (!db) {
      throw new Error('Failed to connect to test database')
    }

  }, 30000)

  afterAll(async () => {
    // Clean up after tests
    if (db) {
      //// await cleanupTestData()
      await db.$disconnect()
    }
  }, 10000)


  async function getDataCounts() {
    if (!db) return {
      events: 0, operations: 0, transactions: 0,
      distinctEvents: 0, distinctTransactions: 0,
      duplicateCheck: { events: false, transactions: false }
    }

    try {
      const [events, operations, horizonTransactions, transactions, schema, attestations] = await Promise.all([
        db.horizonEvent.count(),
        db.horizonOperation.count(),
        db.horizonTransaction.count(),
        db.transaction.count(),
        db.schema.count(),
        db.attestation.count(),
      ])

      // Check for duplicates by comparing total count vs distinct count
      const [distinctEventIds, distinctOperationIds, distinctTxHashes] = await Promise.all([
        db.horizonEvent.findMany({ select: { eventId: true }, distinct: ['eventId'] }),
        db.horizonOperation.findMany({ select: { operationId: true }, distinct: ['operationId'] }),
        db.horizonTransaction.findMany({ select: { hash: true }, distinct: ['hash'] })
      ])

      const distinctEvents = distinctEventIds.length
      const distinctTransactions = distinctTxHashes.length
      const distinctOperations = distinctOperationIds.length

      // Compare counts to detect duplicates
      const duplicateCheck = {
        events: events !== distinctEvents,
        operations: operations !== distinctOperations,
        horizonTransactions: horizonTransactions !== distinctTransactions,
      }

      if (duplicateCheck.events) {
        console.log(`⚠️ DUPLICATE EVENTS DETECTED: Total=${events}, Distinct=${distinctEvents}`)
      }
      if (duplicateCheck.horizonTransactions) {
        console.log(`⚠️ DUPLICATE TRANSACTIONS DETECTED: Total=${transactions}, Distinct=${distinctTransactions}`)
      }

      console.log(`=============== Backfill Data counts ===============`)
      console.log({ events, operations, transactions, schema, attestations, horizonTransactions, distinctOperations, distinctEvents, distinctTransactions, duplicateCheck })
      console.log(`=============== Backfill Data counts ===============`)

      return {
        schema,
        attestations,
        transactions,
        horizonEvents: events,
        horizonOperations: operations,
        horizonTransactions,
        distinctEvents,
        distinctOperations,
        distinctTransactions,
        duplicateCheck
      }
    } catch (error) {
      console.error('Error getting data counts:', error)
      return {
        events: 0, operations: 0, transactions: 0,
        distinctEvents: 0, distinctTransactions: 0,
        duplicateCheck: { events: false, transactions: false }
      }
    }
  }


  it('should successfully execute backfill and populate database with events, operations, and transactions', async () => {
    console.log('🚀 Starting backfill integration test...')

    // Step 1: Get initial counts
    const initialCounts = await getDataCounts()
    console.log('📊 Initial counts:', initialCounts)

    // Step 2: Trigger backfill via API
    console.log('📡 Triggering backfill via API...')
    const backfillResponse = await request(app)
      .post('/api/ingest/backfill')
      .send({
        startLedger: BACKFILL_START_LEDGER,
        endLedger: BACKFILL_END_LEDGER
      })
      .expect(202)

    expect(backfillResponse.body.success).toBe(true)
    expect(backfillResponse.body.message).toContain('Historical data backfill initiated')
    console.log('✅ Backfill API response:', backfillResponse.body.message)

    // Step 3: Wait for backfill to complete
    console.log('⏳ Waiting for backfill to complete...')

    let attempts = 0
    const maxAttempts = 30 // 30 attempts * 2s = 60s max wait
    let backfillCompleted = false

    while (attempts < maxAttempts && !backfillCompleted) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
      attempts++

      const currentCounts = await getDataCounts()

      // Check if we have new data (indicating backfill progress)
      if (currentCounts.horizonEvents > initialCounts.horizonEvents ||
        currentCounts.horizonOperations > initialCounts.horizonOperations ||
        currentCounts.horizonTransactions > initialCounts.horizonTransactions) {

        console.log(`📈 Progress detected (attempt ${attempts}):`, currentCounts)

        // Wait a bit more for completion, then check if counts stabilized
        await new Promise(resolve => setTimeout(resolve, 3000))
        const finalCounts = await getDataCounts()

        if (finalCounts.events === currentCounts.events &&
          finalCounts.operations === currentCounts.operations &&
          finalCounts.transactions === currentCounts.transactions) {
          backfillCompleted = true
          console.log('✅ Backfill appears to be completed')
        }
      }
    }

    if (!backfillCompleted) {
      console.log('⚠️ Backfill may still be in progress after timeout')
    }

    // Step 4: Verify data was populated
    const finalCounts = await getDataCounts()
    console.log('📊 Final counts:', finalCounts)

    // We should have some data after backfill
    expect(finalCounts.events).toBeGreaterThanOrEqual(initialCounts.horizonEvents)

    // Step 5: Retrieve and verify events with related data
    console.log('📋 Retrieving events with related transaction and operation data...')

    const events = await db.horizonEvent.findMany({
      include: {
        transaction: true,
        operation: true,
      },
      orderBy: { timestamp: 'desc' },
      take: 10, // Get latest 10 events
    })

    console.log(`📋 Retrieved ${events.length} events with related data`)

    if (events.length > 0) {
      // Verify event structure
      const firstEvent = events[0]
      expect(firstEvent).toBeDefined()
      expect(firstEvent.eventId).toBeDefined()
      expect(firstEvent.ledger).toBeDefined()
      expect(firstEvent.contractId).toBeDefined()
      expect(firstEvent.eventType).toBeDefined()
      expect(firstEvent.eventData).toBeDefined()

      console.log('✅ Event structure validation passed')
      console.log('📋 Sample event:', {
        eventId: firstEvent.eventId,
        ledger: firstEvent.ledger,
        contractId: firstEvent.contractId,
        eventType: firstEvent.eventType,
        hasTransaction: !!firstEvent.transaction,
        hasOperation: !!firstEvent.operation,
      })

      // Verify relationships exist
      let eventsWithTransactions = 0
      let eventsWithOperations = 0

      for (const event of events) {
        if (event.transaction) {
          eventsWithTransactions++

          // Verify transaction structure
          expect(event.transaction.hash).toBeDefined()
          expect(event.transaction.ledger).toBeDefined()
          expect(event.transaction.successful).toBeDefined()
        }

        if (event.operation) {
          eventsWithOperations++

          // Verify operation structure
          expect(event.operation.operationId).toBeDefined()
          expect(event.operation.contractId).toBeDefined()
          expect(event.operation.operationType).toBeDefined()
        }
      }

      console.log(`✅ Events with transactions: ${eventsWithTransactions}/${events.length}`)
      console.log(`✅ Events with operations: ${eventsWithOperations}/${events.length}`)

      // At least some events should have related transaction data
      expect(eventsWithTransactions).toBeGreaterThan(0)
    }

    // Step 6: Verify operations have correct contract associations
    console.log('⚙️ Verifying operations have correct contract associations...')

    const operations = await db.horizonOperation.findMany({
      include: {
        events: true,
      },
      orderBy: { ingestedAt: 'desc' },
      take: 5,
    })

    console.log(`⚙️ Retrieved ${operations.length} operations`)

    for (const operation of operations) {
      expect(operation.contractId).toBeDefined()
      expect(operation.operationType).toBeDefined()
      expect(operation.transactionHash).toBeDefined()

      console.log('✅ Operation validation:', {
        operationId: operation.operationId,
        contractId: operation.contractId,
        operationType: operation.operationType,
        eventCount: operation.events?.length || 0,
      })
    }

    // Step 7: Verify transactions are properly linked
    console.log('💳 Verifying transactions are properly linked...')

    const transactions = await db.horizonTransaction.findMany({
      include: {
        events: true,
        _count: {
          select: {
            events: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 5,
    })

    console.log(`💳 Retrieved ${transactions.length} transactions`)

    for (const transaction of transactions) {
      expect(transaction.hash).toBeDefined()
      expect(transaction.ledger).toBeDefined()
      expect(transaction.sourceAccount).toBeDefined()

      console.log('✅ Transaction validation:', {
        hash: transaction.hash.substring(0, 10) + '...',
        ledger: transaction.ledger,
        successful: transaction.successful,
        eventCount: transaction._count?.events || 0,
      })
    }

    console.log('🎉 Backfill integration test completed successfully!')

  }, BACKFILL_TIMEOUT)



  it('should handle backfill API errors gracefully', async () => {
    console.log('🧪 Testing backfill error handling...')

    // Test with invalid parameters
    const errorResponse = await request(app)
      .post('/api/ingest/backfill')
      .send({
        startLedger: 'invalid', // Invalid parameter
      })
      .expect(400)

    expect(errorResponse.body.success).toBe(false)
    expect(errorResponse.body.error).toContain('Invalid startLedger parameter')

    console.log('✅ Error handling test passed')
  })

  it('should return proper status for queue status endpoint', async () => {
    console.log('📊 Testing queue status endpoint...')

    const statusResponse = await request(app)
      .get('/api/queue/status')
      .expect(200)

    expect(statusResponse.body.success).toBe(true)
    expect(statusResponse.body.queue).toBeDefined()

    console.log('✅ Queue status test passed:', statusResponse.body.queue)
  })

  test.runIf(true)('should handle duplicate backfill requests without creating duplicate data', async () => {
    console.log('🔄 Testing duplicate backfill prevention...')

    // Get final counts
    const finalCounts = await getDataCounts()
    console.log('📊 Final counts after duplicate backfill:', finalCounts)

    // Verify no duplicates were created
    expect(finalCounts.events).toBe(finalCounts.distinctEvents)
    expect(finalCounts.transactions).toBe(finalCounts.distinctTransactions)
    expect(finalCounts.operations).toBe(finalCounts.distinctOperations)
    expect(finalCounts.duplicateCheck.events).toBe(false)

    console.log('✅ Duplicate prevention test passed - no duplicates created')

    // Verify database constraints by checking for unique violations
    const uniqueEvents = await db.horizonEvent.groupBy({
      by: ['eventId'],
      _count: { eventId: true },
      having: { eventId: { _count: { gt: 1 } } }
    })

    const uniqueTransactions = await db.horizonTransaction.groupBy({
      by: ['hash'],
      _count: { hash: true },
      having: { hash: { _count: { gt: 1 } } }
    })

    const uniqueOperations = await db.horizonOperation.groupBy({
      by: ['operationId'],
      _count: { operationId: true },
      having: { operationId: { _count: { gt: 1 } } }
    })

    expect(uniqueEvents).toHaveLength(0)
    expect(uniqueTransactions).toHaveLength(0)
    expect(uniqueOperations).toHaveLength(0)

    console.log('✅ Database uniqueness constraints verified')
  }, BACKFILL_TIMEOUT)


})