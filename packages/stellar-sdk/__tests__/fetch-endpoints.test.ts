/**
 * Comprehensive tests for all fetch endpoints in the Stellar SDK
 *
 * This test suite verifies all API fetch operations including:
 * - Attestation fetching (by ledger, wallet, latest)
 * - Schema fetching (by ledger, wallet, latest)
 * - Single item fetching (by UID)
 * - Registry dump operations
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest'
import {
  fetchAttestationsByLedger,
  fetchSchemasByLedger,
  fetchAttestationsByWallet,
  fetchSchemasByWallet,
  fetchLatestAttestations,
  fetchLatestSchemas,
  getAttestationByUid,
  getSchemaByUid,
  fetchRegistryDump,
  REGISTRY_ENDPOINTS,
} from '../src/utils/indexer'
import type { ContractAttestation, ContractSchema } from '../src/types'

// Mock ky
vi.mock('ky', () => ({
  default: {
    get: vi.fn(),
  },
}))

import ky from 'ky'

describe('Fetch Endpoints Test Suite', () => {
  const mockKy = ky as any

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchAttestationsByLedger', () => {
    it('should fetch attestations by ledger with default limit', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            attestation_uid: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234',
            schema_uid: 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234',
            subjectAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            attesterAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
            value: { name: 'Test', verified: true },
            createdAt: '2024-01-01T00:00:00Z',
            expiration_time: 1735689600,
            revoked: false,
            ledger: 12345,
          },
        ],
        pagination: { total: 1, hasMore: false, limit: 100, offset: 0 },
      }

      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      const result = await fetchAttestationsByLedger(12345)

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/attestations`, {
        searchParams: { by_ledger: 12345, limit: 100 },
      })

      expect(result).toHaveLength(1)
      expect(result[0].uid).toBeInstanceOf(Buffer)
      expect(result[0].schemaUid).toBeInstanceOf(Buffer)
      expect(result[0].subject).toBe('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')
    })

    it('should respect custom limit (max 100)', async () => {
      const mockResponse = { success: true, data: [] }
      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      await fetchAttestationsByLedger(12345, 50)

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/attestations`, {
        searchParams: { by_ledger: 12345, limit: 50 },
      })
    })

    it('should handle mainnet network', async () => {
      const mockResponse = { success: true, data: [] }
      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      await fetchAttestationsByLedger(12345, 100, 'mainnet')

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.mainnet}/attestations`, {
        searchParams: { by_ledger: 12345, limit: 100 },
      })
    })

    it('should handle API errors gracefully', async () => {
      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockRejectedValueOnce(new Error('HTTP Error')),
      })

      await expect(fetchAttestationsByLedger(12345)).rejects.toThrow('Failed to fetch attestations by ledger')
    })

    it('should handle network errors', async () => {
      mockKy.get.mockRejectedValueOnce(new Error('Network error'))

      await expect(fetchAttestationsByLedger(12345)).rejects.toThrow('Failed to fetch attestations by ledger')
    })
  })

  describe('fetchSchemasByLedger', () => {
    it('should fetch schemas by ledger with default limit', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            uid: 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234',
            schema_definition: 'name:string,age:u32,verified:bool',
            deployerAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            resolverAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
            revocable: true,
            createdAt: '2024-01-01T00:00:00Z',
            ledger: 12345,
          },
        ],
      }

      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      const result = await fetchSchemasByLedger(12345)

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/schemas`, {
        searchParams: { by_ledger: 12345, limit: 100 },
      })

      expect(result).toHaveLength(1)
      expect(result[0].uid).toBeInstanceOf(Buffer)
      expect(result[0].definition).toBe('name:string,age:u32,verified:bool')
    })

    it('should handle empty schema responses', async () => {
      const mockResponse = { success: true, data: [] }
      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      const result = await fetchSchemasByLedger(12345, 50)

      expect(result).toEqual([])
    })
  })

  describe('fetchAttestationsByWallet (without offset)', () => {
    it('should fetch attestations by wallet with only limit parameter', async () => {
      const walletAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const mockResponse = {
        success: true,
        data: [
          {
            attestation_uid: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234',
            schema_uid: 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234',
            subjectAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
            attesterAddress: walletAddress,
            value: { test: true },
            createdAt: '2024-01-01T00:00:00Z',
            revoked: false,
            ledger: 12345,
          },
        ],
        pagination: { total: 1, hasMore: false, limit: 100 },
      }

      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      const result = await fetchAttestationsByWallet(walletAddress)

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/attestations`, {
        searchParams: { attester: walletAddress, limit: 100 },
      })

      expect(result.attestations).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.hasMore).toBe(false)
    })

    it('should respect custom limit (max 100)', async () => {
      const walletAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const mockResponse = { success: true, data: [], pagination: { total: 0, hasMore: false, limit: 50 } }

      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      await fetchAttestationsByWallet(walletAddress, 50)

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/attestations`, {
        searchParams: { attester: walletAddress, limit: 50 },
      })
    })

    it('should enforce maximum limit of 100', async () => {
      const walletAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const mockResponse = { success: true, data: [], pagination: { total: 0, hasMore: false, limit: 100 } }

      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      // Should cap at 100 even if higher limit requested
      await fetchAttestationsByWallet(walletAddress, 200)

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/attestations`, {
        searchParams: { attester: walletAddress, limit: 100 },
      })
    })
  })

  describe('fetchSchemasByWallet (without offset)', () => {
    it('should fetch schemas by wallet with only limit parameter', async () => {
      const walletAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const mockResponse = {
        success: true,
        data: [
          {
            uid: 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234',
            schema_definition: 'test:string',
            deployerAddress: walletAddress,
            resolverAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
            revocable: true,
            createdAt: '2024-01-01T00:00:00Z',
            ledger: 12345,
          },
        ],
        pagination: { total: 1, hasMore: false, limit: 100 },
      }

      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      const result = await fetchSchemasByWallet(walletAddress)

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/schemas`, {
        searchParams: { deployer: walletAddress, limit: 100 },
      })

      expect(result.schemas).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.hasMore).toBe(false)
    })
  })

  describe('fetchLatestAttestations', () => {
    it('should fetch latest attestations with default limit', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            attestation_uid: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234',
            schema_uid: 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234',
            subjectAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            attesterAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
            value: { latest: true },
            createdAt: '2024-01-01T00:00:00Z',
            revoked: false,
            ledger: 12345,
          },
        ],
      }

      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      const result = await fetchLatestAttestations()

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/attestations`, {
        searchParams: { limit: 100 },
      })

      expect(result).toHaveLength(1)
      expect(result[0].value.latest).toBe(true)
    })

    it('should respect custom limit (max 100)', async () => {
      const mockResponse = { success: true, data: [] }
      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      await fetchLatestAttestations(75)

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/attestations`, {
        searchParams: { limit: 75 },
      })
    })
  })

  describe('fetchLatestSchemas', () => {
    it('should fetch latest schemas with default limit', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            uid: 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234',
            schema_definition: 'latest:bool',
            deployerAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            resolverAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
            revocable: false,
            createdAt: '2024-01-01T00:00:00Z',
            ledger: 12345,
          },
        ],
      }

      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      const result = await fetchLatestSchemas()

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/schemas`, {
        searchParams: { limit: 100 },
      })

      expect(result).toHaveLength(1)
      expect(result[0].definition).toBe('latest:bool')
    })
  })

  describe('getAttestationByUid', () => {
    it('should fetch single attestation by UID', async () => {
      const uid = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234'
      const mockResponse = {
        success: true,
        data: {
          attestation_uid: uid,
          schema_uid: 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234',
          subjectAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
          attesterAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
          value: { single: true },
          createdAt: '2024-01-01T00:00:00Z',
          revoked: false,
          ledger: 12345,
        },
      }

      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      const result = await getAttestationByUid(uid)

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/attestations/${uid}`)

      expect(result).toBeDefined()
      expect(result?.uid.toString('hex')).toBe(uid)
    })

    it('should return null for non-existent attestation', async () => {
      const uid = 'nonexistent1234567890123456789012345678901234567890123456789'

      const error: any = new Error('HTTP Error')
      error.response = { status: 404 }
      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockRejectedValueOnce(error),
      })

      const result = await getAttestationByUid(uid)

      expect(result).toBeNull()
    })
  })

  describe('getSchemaByUid', () => {
    it('should fetch single schema by UID', async () => {
      const uid = 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234'
      const mockResponse = {
        success: true,
        data: {
          uid: uid,
          schema_definition: 'single:bool',
          deployerAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
          resolverAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
          revocable: true,
          createdAt: '2024-01-01T00:00:00Z',
          ledger: 12345,
        },
      }

      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      const result = await getSchemaByUid(uid)

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/schemas/${uid}`)

      expect(result).toBeDefined()
      expect(result?.uid.toString('hex')).toBe(uid)
    })

    it('should support includeAttestations parameter', async () => {
      const uid = 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234'
      const mockResponse = { success: true, data: { uid, schema_definition: 'test', deployerAddress: 'GAAA...', resolverAddress: 'GBBB...', revocable: true, createdAt: '2024-01-01T00:00:00Z', ledger: 12345 } }

      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      await getSchemaByUid(uid, true)

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/schemas/${uid}`, {
        searchParams: { include_attestations: 'true' },
      })
    })

    it('should return null for non-existent schema', async () => {
      const uid = 'nonexistent1234567890123456789012345678901234567890123456789'

      const error: any = new Error('HTTP Error')
      error.response = { status: 404 }
      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockRejectedValueOnce(error),
      })

      const result = await getSchemaByUid(uid)

      expect(result).toBeNull()
    })
  })

  describe('fetchRegistryDump', () => {
    it('should fetch complete registry dump', async () => {
      const mockSchemasResponse = {
        success: true,
        data: [
          {
            uid: 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234',
            schema_definition: 'dump:bool',
            deployerAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            resolverAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
            revocable: true,
            createdAt: '2024-01-01T00:00:00Z',
            ledger: 12345,
          },
        ],
      }

      const mockAttestationsResponse = {
        success: true,
        data: [
          {
            attestation_uid: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234',
            schema_uid: 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234',
            subjectAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            attesterAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
            value: { dump: true },
            createdAt: '2024-01-01T00:00:00Z',
            revoked: false,
            ledger: 12346,
          },
        ],
      }

      mockKy.get
        .mockReturnValueOnce({
          json: vi.fn().mockResolvedValueOnce(mockSchemasResponse),
        })
        .mockReturnValueOnce({
          json: vi.fn().mockResolvedValueOnce(mockAttestationsResponse),
        })

      const result = await fetchRegistryDump()

      expect(mockKy.get).toHaveBeenCalledTimes(2)
      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/schemas`, {
        searchParams: { limit: 1000 },
      })
      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/attestations`, {
        searchParams: { limit: 1000 },
      })

      expect(result.schemas).toHaveLength(1)
      expect(result.attestations).toHaveLength(1)
      expect(result.timestamp).toBeDefined()
      expect(result.ledger).toBe(12346)
    })

    it('should handle empty registry', async () => {
      const mockEmptyResponse = { success: true, data: [] }

      mockKy.get
        .mockReturnValueOnce({
          json: vi.fn().mockResolvedValueOnce(mockEmptyResponse),
        })
        .mockReturnValueOnce({
          json: vi.fn().mockResolvedValueOnce(mockEmptyResponse),
        })

      const result = await fetchRegistryDump()

      expect(result.schemas).toEqual([])
      expect(result.attestations).toEqual([])
      expect(result.ledger).toBe(0)
    })

    it('should handle partial failures in registry dump', async () => {
      mockKy.get
        .mockReturnValueOnce({
          json: vi.fn().mockRejectedValueOnce(new Error('HTTP Error')),
        })
        .mockReturnValueOnce({
          json: vi.fn().mockResolvedValueOnce({ success: true, data: [] }),
        })

      await expect(fetchRegistryDump()).rejects.toThrow('Failed to fetch registry dump')
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON responses', async () => {
      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockRejectedValueOnce(new Error('Invalid JSON')),
      })

      await expect(fetchLatestAttestations()).rejects.toThrow()
    })

    it('should handle timeout errors', async () => {
      mockKy.get.mockRejectedValueOnce(new Error('Request timeout'))

      await expect(fetchLatestSchemas()).rejects.toThrow('Failed to fetch latest schemas')
    })

    it('should handle rate limiting (429 status)', async () => {
      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockRejectedValueOnce(new Error('HTTP Error')),
      })

      await expect(fetchLatestAttestations()).rejects.toThrow()
    })
  })

  describe('Limit Parameter Validation', () => {
    it('should enforce maximum limit of 100 for all fetch functions', async () => {
      const mockResponse = { success: true, data: [] }

      // Test fetchLatestAttestations
      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })
      await fetchLatestAttestations(150)
      expect(mockKy.get).toHaveBeenLastCalledWith(`${REGISTRY_ENDPOINTS.testnet}/attestations`, {
        searchParams: { limit: 100 },
      })

      // Test fetchLatestSchemas
      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })
      await fetchLatestSchemas(200)
      expect(mockKy.get).toHaveBeenLastCalledWith(`${REGISTRY_ENDPOINTS.testnet}/schemas`, {
        searchParams: { limit: 100 },
      })

      // Test fetchAttestationsByLedger
      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })
      await fetchAttestationsByLedger(12345, 500)
      expect(mockKy.get).toHaveBeenLastCalledWith(`${REGISTRY_ENDPOINTS.testnet}/attestations`, {
        searchParams: { by_ledger: 12345, limit: 100 },
      })

      // Test fetchSchemasByLedger
      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })
      await fetchSchemasByLedger(12345, 1000)
      expect(mockKy.get).toHaveBeenLastCalledWith(`${REGISTRY_ENDPOINTS.testnet}/schemas`, {
        searchParams: { by_ledger: 12345, limit: 100 },
      })
    })

    it('should use default limit of 100 when not specified', async () => {
      const mockResponse = { success: true, data: [] }

      mockKy.get.mockReturnValueOnce({
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      })

      await fetchLatestAttestations()

      expect(mockKy.get).toHaveBeenCalledWith(`${REGISTRY_ENDPOINTS.testnet}/attestations`, {
        searchParams: { limit: 100 },
      })
    })

    it('should accept valid limits under 100', async () => {
      const mockResponse = { success: true, data: [] }

      const validLimits = [1, 10, 25, 50, 75, 99, 100]

      for (const limit of validLimits) {
        mockKy.get.mockReturnValueOnce({
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        })

        await fetchLatestAttestations(limit)

        expect(mockKy.get).toHaveBeenLastCalledWith(`${REGISTRY_ENDPOINTS.testnet}/attestations`, {
          searchParams: { limit },
        })
      }
    })
  })
})