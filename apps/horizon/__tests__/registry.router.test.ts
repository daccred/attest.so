import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import registryRouter from '../src/router/registry.router'
import * as db from '../src/common/db'
import { createMockDb, TEST_CONTRACT_ID, TEST_TX_HASH, TEST_LEDGER } from './fixtures/test-data'

// Mock the database module
vi.mock('../src/common/db')

const app = express()
app.use(express.json())
app.use('/api/registry', registryRouter)

describe('Registry Router', () => {
  let mockDb: any

  beforeEach(() => {
    mockDb = createMockDb()
    vi.mocked(db.getDB).mockResolvedValue(mockDb)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /attestations', () => {
    const mockAttestationEvent = {
      id: 'attestation-uuid-1',
      eventId: 'attest-event-id-1',
      ledger: TEST_LEDGER,
      timestamp: new Date('2025-05-17T21:36:01Z'),
      contractId: TEST_CONTRACT_ID,
      eventType: 'ATTEST',
      eventData: {
        schema_uid: 'schema-123',
        attester: 'attester-address',
        subject: 'subject-address',
        value: 'attestation-value',
        encoding: 'JSON'
      },
      txHash: TEST_TX_HASH,
      txEnvelope: 'envelope-data',
      txResult: 'SUCCESS',
      txMeta: 'meta-data',
      txFeeBump: false,
      txStatus: 'SUCCESS',
      txCreatedAt: new Date('2025-05-17T21:36:01Z'),
      sourceAccount: 'attester-address',
      ingestedAt: new Date('2025-05-17T21:36:05Z'),
      transaction: { hash: TEST_TX_HASH }
    }

    it('should fetch attestations successfully', async () => {
      mockDb.horizonEvent.findMany.mockResolvedValue([mockAttestationEvent])
      mockDb.horizonEvent.count.mockResolvedValue(1)

      const response = await request(app)
        .get('/api/registry/attestations')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0]).toMatchObject({
        attestation_uid: 'attest-event-id-1',
        ledger: TEST_LEDGER,
        attesterAddress: 'attester-address',
        transaction_hash: TEST_TX_HASH
      })
      expect(response.body.pagination).toMatchObject({
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false
      })
    })

    it('should filter by ledger', async () => {
      mockDb.horizonEvent.findMany.mockResolvedValue([mockAttestationEvent])
      mockDb.horizonEvent.count.mockResolvedValue(1)

      await request(app)
        .get('/api/registry/attestations?by_ledger=1021507')
        .expect(200)

      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ledger: 1021507
          })
        })
      )
    })

    it('should filter by schema_uid', async () => {
      mockDb.horizonEvent.findMany.mockResolvedValue([])
      mockDb.horizonEvent.count.mockResolvedValue(0)

      await request(app)
        .get('/api/registry/attestations?schema_uid=schema-123')
        .expect(200)

      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventData: {
              path: ['schema_uid'],
              equals: 'schema-123'
            }
          })
        })
      )
    })

    it('should filter by attester', async () => {
      mockDb.horizonEvent.findMany.mockResolvedValue([])
      mockDb.horizonEvent.count.mockResolvedValue(0)

      await request(app)
        .get('/api/registry/attestations?attester=attester-address')
        .expect(200)

      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { sourceAccount: 'attester-address' },
              {
                eventData: {
                  path: ['attester'],
                  equals: 'attester-address'
                }
              }
            ]
          })
        })
      )
    })

    it('should handle pagination parameters', async () => {
      mockDb.horizonEvent.findMany.mockResolvedValue([])
      mockDb.horizonEvent.count.mockResolvedValue(0)

      await request(app)
        .get('/api/registry/attestations?limit=10&offset=20')
        .expect(200)

      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20
        })
      )
    })

    it('should enforce maximum limit', async () => {
      mockDb.horizonEvent.findMany.mockResolvedValue([])
      mockDb.horizonEvent.count.mockResolvedValue(0)

      await request(app)
        .get('/api/registry/attestations?limit=500')
        .expect(200)

      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200 // Should be capped at 200
        })
      )
    })

    it('should return 400 for invalid ledger parameter', async () => {
      const response = await request(app)
        .get('/api/registry/attestations?by_ledger=invalid')
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Invalid by_ledger parameter')
    })

    it('should return 400 for invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/registry/attestations?limit=-1')
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Invalid limit or offset parameters')
    })

    it('should return 503 when database is unavailable', async () => {
      vi.mocked(db.getDB).mockResolvedValue(undefined)

      const response = await request(app)
        .get('/api/registry/attestations')
        .expect(503)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Database not available')
    })

    it('should handle database errors', async () => {
      mockDb.horizonEvent.findMany.mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .get('/api/registry/attestations')
        .expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('Database error')
    })
  })

  describe('GET /attestations/:uid', () => {
    const mockAttestationEvent = {
      id: 'attestation-uuid-1',
      eventId: 'attest-event-id-1',
      ledger: TEST_LEDGER,
      timestamp: new Date('2025-05-17T21:36:01Z'),
      contractId: TEST_CONTRACT_ID,
      eventType: 'ATTEST',
      eventData: {
        schema_uid: 'schema-123',
        attester: 'attester-address',
        subject: 'subject-address',
        value: 'attestation-value'
      },
      txHash: TEST_TX_HASH,
      sourceAccount: 'attester-address',
      transaction: { hash: TEST_TX_HASH }
    }

    it('should fetch single attestation by UID', async () => {
      mockDb.horizonEvent.findFirst.mockResolvedValue(mockAttestationEvent)

      const response = await request(app)
        .get('/api/registry/attestations/attest-event-id-1')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toMatchObject({
        attestation_uid: 'attest-event-id-1',
        ledger: TEST_LEDGER,
        attesterAddress: 'attester-address'
      })
    })

    it('should return 404 when attestation not found', async () => {
      mockDb.horizonEvent.findFirst.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/registry/attestations/non-existent')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Attestation not found')
    })

    it('should return 503 when database is unavailable', async () => {
      vi.mocked(db.getDB).mockResolvedValue(undefined)

      const response = await request(app)
        .get('/api/registry/attestations/some-uid')
        .expect(503)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Database not available')
    })
  })

  describe('GET /schemas', () => {
    const mockSchemaEvent = {
      id: 'schema-uuid-1',
      eventId: 'schema-event-id-1',
      ledger: TEST_LEDGER,
      timestamp: new Date('2025-05-17T21:36:01Z'),
      contractId: TEST_CONTRACT_ID,
      eventType: 'SCHEMA',
      eventData: {
        definition: 'schema-definition',
        type: 'identity',
        deployer: 'deployer-address',
        revocable: true
      },
      txHash: TEST_TX_HASH,
      sourceAccount: 'deployer-address',
      transaction: { hash: TEST_TX_HASH }
    }

    it('should fetch schemas successfully', async () => {
      mockDb.horizonEvent.findMany.mockResolvedValue([mockSchemaEvent])
      mockDb.horizonEvent.count.mockResolvedValue(1)

      const response = await request(app)
        .get('/api/registry/schemas')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0]).toMatchObject({
        uid: 'schema-event-id-1',
        ledger: TEST_LEDGER,
        deployerAddress: 'deployer-address',
        type: 'identity'
      })
    })

    it('should filter by deployer', async () => {
      mockDb.horizonEvent.findMany.mockResolvedValue([])
      mockDb.horizonEvent.count.mockResolvedValue(0)

      await request(app)
        .get('/api/registry/schemas?deployer=deployer-address')
        .expect(200)

      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { sourceAccount: 'deployer-address' },
              {
                eventData: {
                  path: ['deployer'],
                  equals: 'deployer-address'
                }
              }
            ]
          })
        })
      )
    })

    it('should filter by type', async () => {
      mockDb.horizonEvent.findMany.mockResolvedValue([])
      mockDb.horizonEvent.count.mockResolvedValue(0)

      await request(app)
        .get('/api/registry/schemas?type=identity')
        .expect(200)

      expect(mockDb.horizonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventData: {
              path: ['type'],
              equals: 'identity'
            }
          })
        })
      )
    })
  })

  describe('GET /schemas/:uid', () => {
    const mockSchemaEvent = {
      id: 'schema-uuid-1',
      eventId: 'schema-event-id-1',
      ledger: TEST_LEDGER,
      timestamp: new Date('2025-05-17T21:36:01Z'),
      contractId: TEST_CONTRACT_ID,
      eventType: 'SCHEMA',
      eventData: {
        definition: 'schema-definition',
        type: 'identity',
        deployer: 'deployer-address'
      },
      txHash: TEST_TX_HASH,
      sourceAccount: 'deployer-address',
      transaction: { hash: TEST_TX_HASH }
    }

    it('should fetch single schema by UID', async () => {
      mockDb.horizonEvent.findFirst.mockResolvedValue(mockSchemaEvent)

      const response = await request(app)
        .get('/api/registry/schemas/schema-event-id-1')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toMatchObject({
        uid: 'schema-event-id-1',
        ledger: TEST_LEDGER,
        deployerAddress: 'deployer-address'
      })
    })

    it('should return 404 when schema not found', async () => {
      mockDb.horizonEvent.findFirst.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/registry/schemas/non-existent')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Schema not found')
    })
  })

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockDb.horizonEvent.findMany.mockRejectedValue(new Error('Unexpected error'))

      const response = await request(app)
        .get('/api/registry/attestations')
        .expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Unexpected error')
    })

    it('should handle errors without message', async () => {
      mockDb.horizonEvent.findMany.mockRejectedValue({})

      const response = await request(app)
        .get('/api/registry/attestations')
        .expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Failed to fetch attestations')
    })
  })
})