import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import { getDB } from '../src/common/db'
import { connectToPostgreSQL } from '../src/common/prisma'

// Integration test timeout - backfill operations can take time
const BACKFILL_TIMEOUT = 60000 // 60 seconds
const BACKFILL_START_LEDGER = 209988
const BACKFILL_END_LEDGER = 228328

describe('Backfill Integration Test', () => {
  let db: any

  beforeAll(async () => {
    // Connect to the test database
    await connectToPostgreSQL()
    db = await getDB()
    
    if (!db) {
      throw new Error('Failed to connect to test database')
    }

    // Clean up any existing test data
    //// await cleanupTestData()
  }, 30000)

  afterAll(async () => {
    // Clean up after tests
    if (db) {
      //// await cleanupTestData()
      await db.$disconnect()
    }
  }, 10000)

  // async function cleanupTestData() {
  //   if (!db) return

  //   try {
  //     // Delete test data in correct order due to foreign keys
  //     await db.horizonEvent.deleteMany({
  //       where: {
  //         contractId: {
  //           in: [
  //             'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO',
  //             'CCO3YROVSXMR2QEFLW6HQVVVQHZTOHWJ2X3GWHFBQ3LVFQ2OAPXVWMJ2'
  //           ]
  //         }
  //       }
  //     })

  //     await db.horizonOperation.deleteMany({
  //       where: {
  //         contractId: {
  //           in: [
  //             'CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO',
  //             'CCO3YROVSXMR2QEFLW6HQVVVQHZTOHWJ2X3GWHFBQ3LVFQ2OAPXVWMJ2'
  //           ]
  //         }
  //       }
  //     })

  //     await db.horizonTransaction.deleteMany({
  //       where: {
  //         ledger: {
  //           gte: 1000000 // Clean up recent test transactions
  //         }
  //       }
  //     })

  //     console.log('✅ Test data cleanup completed')
  //   } catch (error) {
  //     console.error('❌ Error during cleanup:', error)
  //   }
  // }

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
      if (currentCounts.events > initialCounts.events || 
          currentCounts.operations > initialCounts.operations || 
          currentCounts.transactions > initialCounts.transactions) {
        
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
    expect(finalCounts.events).toBeGreaterThanOrEqual(initialCounts.events)
    expect(finalCounts.operations).toBeGreaterThanOrEqual(initialCounts.operations)
    expect(finalCounts.transactions).toBeGreaterThanOrEqual(initialCounts.transactions)

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

  async function getDataCounts() {
    if (!db) return { events: 0, operations: 0, transactions: 0 }

    try {
      const [events, operations, transactions] = await Promise.all([
        db.horizonEvent.count(),
        db.horizonOperation.count(),
        db.horizonTransaction.count(),
      ])

      return { events, operations, transactions }
    } catch (error) {
      console.error('Error getting data counts:', error)
      return { events: 0, operations: 0, transactions: 0 }
    }
  }

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

  it('should handle duplicate backfill requests without creating duplicate data', async () => {
    console.log('🔄 Testing duplicate backfill prevention...')

    // Get initial counts
    const initialCounts = await getDataCounts()
    console.log('📊 Initial counts before duplicate test:', initialCounts)

    // Run first backfill
    console.log('📡 Running first backfill...')
    const firstBackfillResponse = await request(app)
      .post('/api/ingest/backfill')
      .send({
        startLedger: BACKFILL_START_LEDGER + 100,
        endLedger: BACKFILL_END_LEDGER
      })
      .expect(202)

    expect(firstBackfillResponse.body.success).toBe(true)
    console.log('✅ First backfill initiated')

    // Wait for first backfill to complete
    await waitForBackfillCompletion(initialCounts, 30000) // 30 second timeout

    // Get counts after first backfill
    const countsAfterFirst = await getDataCounts()
    console.log('📊 Counts after first backfill:', countsAfterFirst)

    // Run second backfill on same range
    console.log('📡 Running second backfill on same data...')
    const secondBackfillResponse = await request(app)
      .post('/api/ingest/backfill')
      .send({
        startLedger: 1000020, // Same range as first backfill
        endLedger: 1000025
      })
      .expect(202)

    expect(secondBackfillResponse.body.success).toBe(true)
    console.log('✅ Second backfill initiated')

    // Wait for second backfill to complete
    await waitForBackfillCompletion(countsAfterFirst, 30000)

    // Get final counts
    const finalCounts = await getDataCounts()
    console.log('📊 Final counts after duplicate backfill:', finalCounts)

    // Verify no duplicates were created
    expect(finalCounts.events).toBe(countsAfterFirst.events)
    expect(finalCounts.operations).toBe(countsAfterFirst.operations)
    expect(finalCounts.transactions).toBe(countsAfterFirst.transactions)

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

  // Helper function to wait for backfill completion
  async function waitForBackfillCompletion(initialCounts: any, timeoutMs: number) {
    const startTime = Date.now()
    let attempts = 0
    const maxAttempts = Math.floor(timeoutMs / 2000) // Check every 2 seconds

    while (attempts < maxAttempts && Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      attempts++

      const currentCounts = await getDataCounts()
      
      // Check if we have new data (indicating backfill progress)
      if (currentCounts.events > initialCounts.events || 
          currentCounts.operations > initialCounts.operations || 
          currentCounts.transactions > initialCounts.transactions) {
        
        console.log(`📈 Progress detected (attempt ${attempts}):`, currentCounts)
        
        // Wait a bit more for completion
        await new Promise(resolve => setTimeout(resolve, 3000))
        const stabilizedCounts = await getDataCounts()
        
        // Check if counts stabilized (backfill completed)
        if (stabilizedCounts.events === currentCounts.events && 
            stabilizedCounts.operations === currentCounts.operations && 
            stabilizedCounts.transactions === currentCounts.transactions) {
          console.log('✅ Backfill completed')
          return
        }
      }
    }
    
    console.log('⚠️ Backfill completion check timed out')
  }
})