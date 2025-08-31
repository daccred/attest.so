/**
 * Test to verify that the stellar-sdk indexer functions would work correctly
 * with the actual horizon registry API responses by simulating the data transformations
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

// Simulate the stellar-sdk indexer transformation functions
function simulateIndexerAttestationTransform(apiResponse: any) {
  return (apiResponse.data || []).map((item: any) => ({
    uid: Buffer.from(item.attestation_uid, 'hex'),
    schemaUid: Buffer.from(item.schema_uid, 'hex'),
    subject: item.subjectAddress,
    attester: item.attesterAddress,
    value: item.value,
    timestamp: new Date(item.createdAt).getTime(),
    expirationTime: item.expiration_time,
    revocationTime: item.revokedAt ? new Date(item.revokedAt).getTime() : undefined,
    revoked: item.revoked || false
  }))
}

function simulateIndexerSchemaTransform(apiResponse: any) {
  return (apiResponse.data || []).map((item: any) => ({
    uid: Buffer.from(item.uid, 'hex'),
    definition: item.schema_definition || item.parsed_schema_definition,
    authority: item.deployerAddress,
    resolver: item.resolverAddress,
    revocable: item.revocable ?? true,
    timestamp: new Date(item.createdAt).getTime()
  }))
}

describe('Stellar SDK Indexer Compatibility', () => {
  let mockDb: any

  beforeEach(() => {
    mockDb = createMockDb()
    vi.mocked(db.getDB).mockResolvedValue(mockDb)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchAttestationsByLedger compatibility', () => {
    it('should successfully transform API response to expected ContractAttestation format', async () => {
      const mockAttestationEvent = {
        id: 'attestation-uuid-1',
        attestationUid: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        ledger: TEST_LEDGER,
        schemaUid: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        attesterAddress: 'GABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCDEF',
        subjectAddress: 'GXYZABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCD',
        transactionHash: TEST_TX_HASH,
        schemaEncoding: 'JSON',
        message: 'attestation-message',
        value: { name: 'John Doe', age: 30 },
        revoked: false,
        createdAt: new Date('2025-05-17T21:36:01Z'),
        revokedAt: null,
      }

      mockDb.attestation.findMany.mockResolvedValue([mockAttestationEvent])
      mockDb.attestation.count.mockResolvedValue(1)

      const response = await request(app)
        .get('/api/registry/attestations?by_ledger=1021507&limit=100')
        .expect(200)

      // Transform using simulated indexer logic
      const transformedAttestations = simulateIndexerAttestationTransform(response.body)

      // Verify the transformation produces expected Contract Attestation objects
      expect(transformedAttestations).toHaveLength(1)
      const attestation = transformedAttestations[0]

      expect(attestation).toMatchObject({
        uid: expect.any(Buffer),
        schemaUid: expect.any(Buffer),
        subject: 'GXYZABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCD',
        attester: 'GABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCDEF',
        value: { name: 'John Doe', age: 30 },
        timestamp: expect.any(Number),
        revoked: false
      })

      // Verify Buffer conversions work correctly
      expect(attestation.uid.toString('hex')).toBe('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
      expect(attestation.schemaUid.toString('hex')).toBe('fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210')
      expect(attestation.timestamp).toBe(new Date('2025-05-17T21:36:01Z').getTime())
      expect(attestation.revocationTime).toBeUndefined()
    })
  })

  describe('fetchAttestationsByWallet compatibility', () => {
    it('should return correct pagination structure that indexer expects', async () => {
      const mockAttestations = Array.from({ length: 3 }, (_, i) => ({
        id: `attestation-uuid-${i}`,
        attestationUid: `${i.toString().padStart(64, '0')}`,
        ledger: TEST_LEDGER + i,
        schemaUid: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        attesterAddress: 'GABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCDEF',
        subjectAddress: 'GXYZABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCD',
        transactionHash: TEST_TX_HASH,
        schemaEncoding: 'JSON',
        message: `message-${i}`,
        value: { index: i },
        revoked: i === 2, // Third one is revoked
        createdAt: new Date('2025-05-17T21:36:01Z'),
        revokedAt: i === 2 ? new Date('2025-05-18T21:36:01Z') : null,
      }))

      mockDb.attestation.findMany.mockResolvedValue(mockAttestations)
      mockDb.attestation.count.mockResolvedValue(10) // Total available

      const response = await request(app)
        .get('/api/registry/attestations?attester=GABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCDEF&limit=3&offset=0')
        .expect(200)

      // Verify pagination matches indexer expectations
      expect(response.body.pagination).toMatchObject({
        total: 10,
        limit: 3,
        offset: 0,
        hasMore: true
      })

      // Transform and verify attestations
      const transformedAttestations = simulateIndexerAttestationTransform(response.body)
      expect(transformedAttestations).toHaveLength(3)

      // Verify revoked attestation is handled correctly
      const revokedAttestation = transformedAttestations[2]
      expect(revokedAttestation.revoked).toBe(true)
      expect(revokedAttestation.revocationTime).toBe(new Date('2025-05-18T21:36:01Z').getTime())
    })
  })

  describe('fetchSchemasByLedger compatibility', () => {
    it('should successfully transform API response to expected ContractSchema format', async () => {
      const mockSchemaEvent = {
        id: 'schema-uuid-1',
        uid: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        ledger: TEST_LEDGER,
        schemaDefinition: 'struct Person { string name; uint age; }',
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

      mockDb.schema.findMany.mockResolvedValue([mockSchemaEvent])
      mockDb.schema.count.mockResolvedValue(1)

      const response = await request(app)
        .get('/api/registry/schemas?by_ledger=1021507&limit=100')
        .expect(200)

      // Transform using simulated indexer logic
      const transformedSchemas = simulateIndexerSchemaTransform(response.body)

      // Verify the transformation produces expected ContractSchema objects
      expect(transformedSchemas).toHaveLength(1)
      const schema = transformedSchemas[0]

      expect(schema).toMatchObject({
        uid: expect.any(Buffer),
        definition: 'struct Person { string name; uint age; }',
        authority: 'GDEPLOYERADDRESS1234567890ABCDEFGHIJKLMNOP1234567890ABCD',
        resolver: 'GRESOLVERADDRESS1234567890ABCDEFGHIJKLMNOP1234567890ABCD',
        revocable: true,
        timestamp: expect.any(Number)
      })

      // Verify Buffer conversion works correctly
      expect(schema.uid.toString('hex')).toBe('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
      expect(schema.timestamp).toBe(new Date('2025-05-17T21:36:01Z').getTime())
    })
  })

  describe('Individual record fetching compatibility', () => {
    it('should work with getAttestationByUid transformation', async () => {
      const mockAttestationEvent = {
        id: 'attestation-uuid-1',
        attestationUid: 'specific-attestation-uid-hex',
        ledger: TEST_LEDGER,
        schemaUid: 'specific-schema-uid-hex',
        attesterAddress: 'GABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCDEF',
        subjectAddress: 'GXYZABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCD',
        transactionHash: TEST_TX_HASH,
        schemaEncoding: 'JSON',
        message: 'specific-attestation-message',
        value: { specific: 'data' },
        revoked: false,
        createdAt: new Date('2025-05-17T21:36:01Z'),
        revokedAt: null,
      }

      mockDb.attestation.findUnique.mockResolvedValue(mockAttestationEvent)

      const response = await request(app)
        .get('/api/registry/attestations/specific-attestation-uid-hex')
        .expect(200)

      // Simulate single attestation transformation (similar to getAttestationByUid)
      const item = response.body.data
      const transformedAttestation = {
        uid: Buffer.from(item.attestation_uid, 'hex'),
        schemaUid: Buffer.from(item.schema_uid, 'hex'),
        subject: item.subjectAddress,
        attester: item.attesterAddress,
        value: item.value,
        timestamp: new Date(item.createdAt).getTime(),
        expirationTime: item.expiration_time,
        revocationTime: item.revokedAt ? new Date(item.revokedAt).getTime() : undefined,
        revoked: item.revoked || false
      }

      expect(transformedAttestation).toMatchObject({
        uid: expect.any(Buffer),
        schemaUid: expect.any(Buffer),
        subject: 'GXYZABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCD',
        attester: 'GABCDEFGHIJKLMNOP1234567890ABCDEFGHIJKLMNOP1234567890ABCDEF',
        value: { specific: 'data' },
        timestamp: expect.any(Number),
        revoked: false
      })
    })

    it('should work with getSchemaByUid transformation', async () => {
      const mockSchemaEvent = {
        id: 'schema-uuid-1',
        uid: 'specific-schema-uid-hex',
        ledger: TEST_LEDGER,
        schemaDefinition: 'struct SpecificSchema { string field; }',
        parsedSchemaDefinition: { fields: [{ name: 'field', type: 'string' }] },
        resolverAddress: null,
        revocable: true,
        deployerAddress: 'GDEPLOYERADDRESS1234567890ABCDEFGHIJKLMNOP1234567890ABCD',
        type: 'specific',
        transactionHash: TEST_TX_HASH,
        createdAt: new Date('2025-05-17T21:36:01Z'),
      }

      mockDb.schema.findUnique.mockResolvedValue(mockSchemaEvent)

      const response = await request(app)
        .get('/api/registry/schemas/specific-schema-uid-hex')
        .expect(200)

      // Simulate single schema transformation (similar to getSchemaByUid)
      const item = response.body.data
      const transformedSchema = {
        uid: Buffer.from(item.uid, 'hex'),
        definition: item.schema_definition || item.parsed_schema_definition,
        authority: item.deployerAddress,
        resolver: item.resolverAddress,
        revocable: item.revocable ?? true,
        timestamp: new Date(item.createdAt).getTime()
      }

      expect(transformedSchema).toMatchObject({
        uid: expect.any(Buffer),
        definition: 'struct SpecificSchema { string field; }',
        authority: 'GDEPLOYERADDRESS1234567890ABCDEFGHIJKLMNOP1234567890ABCD',
        resolver: null,
        revocable: true,
        timestamp: expect.any(Number)
      })
    })
  })

  describe('Error handling compatibility', () => {
    it('should handle 404 responses correctly like indexer expects', async () => {
      mockDb.attestation.findUnique.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/registry/attestations/non-existent-uid')
        .expect(404)

      expect(response.body).toMatchObject({
        success: false,
        error: 'Attestation not found'
      })

      // This should simulate how indexer's getAttestationByUid handles 404s
      const shouldReturnNull = response.status === 404
      expect(shouldReturnNull).toBe(true)
    })
  })
})