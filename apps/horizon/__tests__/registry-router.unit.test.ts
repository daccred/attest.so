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
      attestationUid: 'attest-event-id-1',
      ledger: TEST_LEDGER,
      schemaUid: 'schema-123',
      attesterAddress: 'attester-address',
      subjectAddress: 'subject-address',
      transactionHash: TEST_TX_HASH,
      schemaEncoding: 'JSON',
      message: 'attestation-value',
      value: {
        test_field: 'test_value'
      },
      revoked: false,
      createdAt: new Date('2025-05-17T21:36:01Z'),
      revokedAt: null,
      ingestedAt: new Date('2025-05-17T21:36:05Z'),
      lastUpdated: new Date('2025-05-17T21:36:05Z')
    }

    it('should fetch attestations successfully', async () => {
      mockDb.attestation.findMany.mockResolvedValue([mockAttestationEvent])
      mockDb.attestation.count.mockResolvedValue(1)

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
      mockDb.attestation.findMany.mockResolvedValue([mockAttestationEvent])
      mockDb.attestation.count.mockResolvedValue(1)

      await request(app)
        .get('/api/registry/attestations?by_ledger=1021507')
        .expect(200)

      expect(mockDb.attestation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ledger: 1021507
          })
        })
      )
    })

    it('should filter by schema_uid', async () => {
      mockDb.attestation.findMany.mockResolvedValue([])
      mockDb.attestation.count.mockResolvedValue(0)

      await request(app)
        .get('/api/registry/attestations?schema_uid=schema-123')
        .expect(200)

      expect(mockDb.attestation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schemaUid: 'schema-123'
          })
        })
      )
    })

    it('should filter by attester', async () => {
      mockDb.attestation.findMany.mockResolvedValue([])
      mockDb.attestation.count.mockResolvedValue(0)

      await request(app)
        .get('/api/registry/attestations?attester=attester-address')
        .expect(200)

      expect(mockDb.attestation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attesterAddress: 'attester-address'
          })
        })
      )
    })

    it('should handle pagination parameters', async () => {
      mockDb.attestation.findMany.mockResolvedValue([])
      mockDb.attestation.count.mockResolvedValue(0)

      await request(app)
        .get('/api/registry/attestations?limit=10&offset=20')
        .expect(200)

      expect(mockDb.attestation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20
        })
      )
    })

    it('should enforce maximum limit', async () => {
      mockDb.attestation.findMany.mockResolvedValue([])
      mockDb.attestation.count.mockResolvedValue(0)

      await request(app)
        .get('/api/registry/attestations?limit=500')
        .expect(200)

      expect(mockDb.attestation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200 // Should be capped at 200
        })
      )
    })

  })

  describe('GET /attestations/:uid', () => {
    const mockAttestationEvent = {
      id: 'attestation-uuid-1',
      attestationUid: 'attest-event-id-1',
      ledger: TEST_LEDGER,
      schemaUid: 'schema-123',
      attesterAddress: 'attester-address',
      subjectAddress: 'subject-address',
      transactionHash: TEST_TX_HASH,
      schemaEncoding: 'JSON',
      message: 'attestation-value',
      value: {
        test_field: 'test_value'
      },
      revoked: false,
      createdAt: new Date('2025-05-17T21:36:01Z'),
      revokedAt: null,
      ingestedAt: new Date('2025-05-17T21:36:05Z'),
      lastUpdated: new Date('2025-05-17T21:36:05Z')
    }

    it('should fetch single attestation by UID', async () => {
      mockDb.attestation.findUnique.mockResolvedValue(mockAttestationEvent)

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
      mockDb.attestation.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/registry/attestations/non-existent')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Attestation not found')
    })

  })

  describe('GET /schemas', () => {
    const mockSchemaEvent = {
      id: 'schema-uuid-1',
      uid: 'schema-event-id-1',
      ledger: TEST_LEDGER,
      schemaDefinition: 'schema-definition',
      parsedSchemaDefinition: {
        fields: [{ name: 'test_field', type: 'string' }]
      },
      resolverAddress: null,
      revocable: true,
      deployerAddress: 'deployer-address',
      type: 'identity',
      transactionHash: TEST_TX_HASH,
      createdAt: new Date('2025-05-17T21:36:01Z'),
      ingestedAt: new Date('2025-05-17T21:36:05Z'),
      lastUpdated: new Date('2025-05-17T21:36:05Z')
    }

    it('should fetch schemas successfully', async () => {
      mockDb.schema.findMany.mockResolvedValue([mockSchemaEvent])
      mockDb.schema.count.mockResolvedValue(1)

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
      mockDb.schema.findMany.mockResolvedValue([])
      mockDb.schema.count.mockResolvedValue(0)

      await request(app)
        .get('/api/registry/schemas?deployer=deployer-address')
        .expect(200)

      expect(mockDb.schema.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deployerAddress: 'deployer-address'
          })
        })
      )
    })

    it('should filter by type', async () => {
      mockDb.schema.findMany.mockResolvedValue([])
      mockDb.schema.count.mockResolvedValue(0)

      await request(app)
        .get('/api/registry/schemas?type=identity')
        .expect(200)

      expect(mockDb.schema.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'identity'
          })
        })
      )
    })
  })

  describe('GET /schemas/:uid', () => {
    const mockSchemaEvent = {
      id: 'schema-uuid-1',
      uid: 'schema-event-id-1',
      ledger: TEST_LEDGER,
      schemaDefinition: 'schema-definition',
      parsedSchemaDefinition: {
        fields: [{ name: 'test_field', type: 'string' }]
      },
      resolverAddress: null,
      revocable: true,
      deployerAddress: 'deployer-address',
      type: 'identity',
      transactionHash: TEST_TX_HASH,
      createdAt: new Date('2025-05-17T21:36:01Z'),
      ingestedAt: new Date('2025-05-17T21:36:05Z'),
      lastUpdated: new Date('2025-05-17T21:36:05Z')
    }

    it('should fetch single schema by UID', async () => {
      mockDb.schema.findUnique.mockResolvedValue(mockSchemaEvent)

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
      mockDb.schema.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/registry/schemas/non-existent')
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Schema not found')
    })
  })

})