/**
 * Test to verify that the stellar-sdk indexer integration matches the 
 * actual horizon registry API response format
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import registryRouter from '../src/router/registry.router'
import * as db from '../src/common/db'
import { createMockDb, TEST_LEDGER, TEST_TX_HASH } from './fixtures/test-data'

// Mock the database module
vi.mock('../src/common/db')

const app = express()
app.use(express.json())
app.use('/api/registry', registryRouter)

describe('Indexer Integration - API Response Format Verification', () => {
  let mockDb: any

  beforeEach(() => {
    mockDb = createMockDb()
    vi.mocked(db.getDB).mockResolvedValue(mockDb)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Attestation Response Format', () => {
    const mockAttestationEvent = {
      id: 'attestation-uuid-1',
      attestationUid: 'attest-event-id-1',
      ledger: TEST_LEDGER,
      schemaUid: 'schema-123-hex',
      attesterAddress: 'GABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCDEF',
      subjectAddress: 'GXYZABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCD',
      transactionHash: TEST_TX_HASH,
      schemaEncoding: 'JSON',
      message: 'attestation-message',
      value: { test_field: 'test_value' },
      revoked: false,
      createdAt: new Date('2025-05-17T21:36:01Z'),
      revokedAt: null,
    }

    it('should match indexer expected response format for attestation list', async () => {
      mockDb.attestation.findMany.mockResolvedValue([mockAttestationEvent])
      mockDb.attestation.count.mockResolvedValue(1)

      const response = await request(app)
        .get('/api/registry/attestations?by_ledger=1021507&limit=100')
        .expect(200)

      // Verify response structure matches what indexer expects
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            // Fields that indexer.ts expects (see fetchAttestationsByLedger transform)
            attestation_uid: expect.any(String),
            ledger: expect.any(Number),
            schema_uid: expect.any(String),
            attesterAddress: expect.any(String),
            subjectAddress: expect.any(String),
            transaction_hash: expect.any(String),
            schema_encoding: expect.any(String),
            message: expect.any(String),
            value: expect.any(Object),
            createdAt: expect.any(String), // ISO string
            revoked: expect.any(Boolean),
          })
        ]),
        pagination: expect.objectContaining({
          total: expect.any(Number),
          limit: expect.any(Number),
          offset: expect.any(Number),
          hasMore: expect.any(Boolean),
        })
      })

      // Verify specific field mappings match what indexer expects
      const attestationData = response.body.data[0]
      expect(attestationData.attestation_uid).toBe('attest-event-id-1')
      expect(attestationData.schema_uid).toBe('schema-123-hex')
      expect(attestationData.attesterAddress).toBe('GABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCDEF')
      expect(attestationData.subjectAddress).toBe('GXYZABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCD')
      expect(attestationData.createdAt).toBe('2025-05-17T21:36:01.000Z')
    })

    it('should match indexer expected response format for single attestation', async () => {
      mockDb.attestation.findUnique.mockResolvedValue(mockAttestationEvent)

      const response = await request(app)
        .get('/api/registry/attestations/attest-event-id-1')
        .expect(200)

      // Verify single attestation response matches indexer expectations
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          attestation_uid: 'attest-event-id-1',
          ledger: TEST_LEDGER,
          schema_uid: 'schema-123-hex',
          attesterAddress: expect.any(String),
          subjectAddress: expect.any(String),
          transaction_hash: expect.any(String),
          schema_encoding: expect.any(String),
          message: expect.any(String),
          value: expect.any(Object),
          createdAt: expect.any(String),
          revoked: expect.any(Boolean),
        })
      })
    })
  })

  describe('Schema Response Format', () => {
    const mockSchemaEvent = {
      id: 'schema-uuid-1',
      uid: 'schema-event-id-1',
      ledger: TEST_LEDGER,
      schemaDefinition: 'struct{name:string,age:uint}',
      parsedSchemaDefinition: {
        fields: [
          { name: 'name', type: 'string' },
          { name: 'age', type: 'uint' }
        ]
      },
      resolverAddress: 'GRESOLVERADDRESS1234567890ABCDEFGHIJKLMNOP1234567890ABCD',
      revocable: true,
      deployerAddress: 'GDEPLOYERADDRESS1234567890ABCDEFGHIJKLMNOP1234567890ABCD',
      type: 'identity',
      transactionHash: TEST_TX_HASH,
      createdAt: new Date('2025-05-17T21:36:01Z'),
    }

    it('should match indexer expected response format for schema list', async () => {
      mockDb.schema.findMany.mockResolvedValue([mockSchemaEvent])
      mockDb.schema.count.mockResolvedValue(1)

      const response = await request(app)
        .get('/api/registry/schemas?by_ledger=1021507&limit=100')
        .expect(200)

      // Verify response structure matches what indexer expects
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            // Fields that indexer.ts expects (see fetchSchemasByLedger transform)
            uid: expect.any(String),
            ledger: expect.any(Number),
            schema_definition: expect.any(String),
            parsed_schema_definition: expect.any(Object),
            resolverAddress: expect.any(String),
            revocable: expect.any(Boolean),
            deployerAddress: expect.any(String),
            createdAt: expect.any(String), // ISO string
            type: expect.any(String),
            transaction_hash: expect.any(String),
          })
        ]),
        pagination: expect.objectContaining({
          total: expect.any(Number),
          limit: expect.any(Number),
          offset: expect.any(Number),
          hasMore: expect.any(Boolean),
        })
      })

      // Verify specific field mappings match what indexer expects
      const schemaData = response.body.data[0]
      expect(schemaData.uid).toBe('schema-event-id-1')
      expect(schemaData.schema_definition).toBe('struct{name:string,age:uint}')
      expect(schemaData.deployerAddress).toBe('GDEPLOYERADDRESS1234567890ABCDEFGHIJKLMNOP1234567890ABCD')
      expect(schemaData.createdAt).toBe('2025-05-17T21:36:01.000Z')
    })

    it('should match indexer expected response format for single schema', async () => {
      mockDb.schema.findUnique.mockResolvedValue(mockSchemaEvent)

      const response = await request(app)
        .get('/api/registry/schemas/schema-event-id-1')
        .expect(200)

      // Verify single schema response matches indexer expectations
      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          uid: 'schema-event-id-1',
          ledger: TEST_LEDGER,
          schema_definition: 'struct{name:string,age:uint}',
          parsed_schema_definition: expect.any(Object),
          resolverAddress: expect.any(String),
          revocable: true,
          deployerAddress: expect.any(String),
          createdAt: expect.any(String),
          type: 'identity',
          transaction_hash: expect.any(String),
        })
      })
    })
  })

  describe('Filter Parameter Validation', () => {
    it('should accept all filter parameters that indexer uses', async () => {
      mockDb.attestation.findMany.mockResolvedValue([])
      mockDb.attestation.count.mockResolvedValue(0)

      // Test all filter parameters used by indexer functions
      const attestationFilters = [
        'by_ledger=1021507',
        'schema_uid=schema-123',
        'attester=GATTESTER123',
        'subject=GSUBJECT123', 
        'revoked=true',
        'limit=50',
        'offset=10'
      ].join('&')

      await request(app)
        .get(`/api/registry/attestations?${attestationFilters}`)
        .expect(200)

      mockDb.schema.findMany.mockResolvedValue([])
      mockDb.schema.count.mockResolvedValue(0)

      const schemaFilters = [
        'by_ledger=1021507',
        'deployer=GDEPLOYER123',
        'type=identity',
        'revocable=true',
        'limit=50',
        'offset=10'
      ].join('&')

      await request(app)
        .get(`/api/registry/schemas?${schemaFilters}`)
        .expect(200)
    })
  })

  describe('Error Response Format', () => {
    it('should return consistent error format for 404s', async () => {
      mockDb.attestation.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/registry/attestations/non-existent')
        .expect(404)

      expect(response.body).toMatchObject({
        success: false,
        error: 'Attestation not found'
      })
    })

    it('should return consistent error format for invalid parameters', async () => {
      const response = await request(app)
        .get('/api/registry/attestations?by_ledger=invalid')
        .expect(400)

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid by_ledger parameter')
      })
    })
  })
})