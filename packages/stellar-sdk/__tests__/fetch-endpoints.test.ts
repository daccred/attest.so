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

// Mock fetch globally
global.fetch = vi.fn()

describe('Fetch Endpoints Test Suite', () => {
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

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await fetchAttestationsByLedger(12345)

      expect(global.fetch).toHaveBeenCalledWith(
        `${REGISTRY_ENDPOINTS.testnet}/attestations?by_ledger=12345&limit=100`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      )

      expect(result).toHaveLength(1)
      expect(result[0].uid).toBeInstanceOf(Buffer)
      expect(result[0].schemaUid).toBeInstanceOf(Buffer)
      expect(result[0].subject).toBe('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')
    })

    it('should respect custom limit (max 100)', async () => {
      const mockResponse = { success: true, data: [] }
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await fetchAttestationsByLedger(12345, 50)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
        expect.any(Object)
      )
    })

    it('should handle mainnet network', async () => {
      const mockResponse = { success: true, data: [] }
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await fetchAttestationsByLedger(12345, 100, 'mainnet')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(REGISTRY_ENDPOINTS.mainnet),
        expect.any(Object)
      )
    })

    it('should handle API errors gracefully', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      await expect(fetchAttestationsByLedger(12345)).rejects.toThrow('Failed to fetch attestations for ledger')
    })

    it('should handle network errors', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

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

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await fetchSchemasByLedger(12345)

      expect(global.fetch).toHaveBeenCalledWith(
        `${REGISTRY_ENDPOINTS.testnet}/schemas?by_ledger=12345&limit=100`,
        expect.any(Object)
      )

      expect(result).toHaveLength(1)
      expect(result[0].uid).toBeInstanceOf(Buffer)
      expect(result[0].definition).toBe('name:string,age:u32,verified:bool')
    })

    it('should handle empty schema responses', async () => {
      const mockResponse = { success: true, data: [] }
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
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

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await fetchAttestationsByWallet(walletAddress)

      expect(global.fetch).toHaveBeenCalledWith(
        `${REGISTRY_ENDPOINTS.testnet}/attestations?attester=${walletAddress}&limit=100`,
        expect.any(Object)
      )

      expect(result.attestations).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.hasMore).toBe(false)
    })

    it('should respect custom limit (max 100)', async () => {
      const walletAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const mockResponse = { success: true, data: [], pagination: { total: 0, hasMore: false, limit: 50 } }
      
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await fetchAttestationsByWallet(walletAddress, 50)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
        expect.any(Object)
      )
    })

    it('should enforce maximum limit of 100', async () => {
      const walletAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const mockResponse = { success: true, data: [], pagination: { total: 0, hasMore: false, limit: 100 } }
      
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      // Should cap at 100 even if higher limit requested
      await fetchAttestationsByWallet(walletAddress, 200)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=100'),
        expect.any(Object)
      )
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

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await fetchSchemasByWallet(walletAddress)

      expect(global.fetch).toHaveBeenCalledWith(
        `${REGISTRY_ENDPOINTS.testnet}/schemas?deployer=${walletAddress}&limit=100`,
        expect.any(Object)
      )

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

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await fetchLatestAttestations()

      expect(global.fetch).toHaveBeenCalledWith(
        `${REGISTRY_ENDPOINTS.testnet}/attestations?limit=100`,
        expect.any(Object)
      )

      expect(result).toHaveLength(1)
      expect(result[0].value.latest).toBe(true)
    })

    it('should respect custom limit (max 100)', async () => {
      const mockResponse = { success: true, data: [] }
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await fetchLatestAttestations(75)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=75'),
        expect.any(Object)
      )
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

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await fetchLatestSchemas()

      expect(global.fetch).toHaveBeenCalledWith(
        `${REGISTRY_ENDPOINTS.testnet}/schemas?limit=100`,
        expect.any(Object)
      )

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

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await getAttestationByUid(uid)

      expect(global.fetch).toHaveBeenCalledWith(
        `${REGISTRY_ENDPOINTS.testnet}/attestations/${uid}`,
        expect.any(Object)
      )

      expect(result).toBeDefined()
      expect(result?.uid.toString('hex')).toBe(uid)
    })

    it('should return null for non-existent attestation', async () => {
      const uid = 'nonexistent1234567890123456789012345678901234567890123456789'
      
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
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

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await getSchemaByUid(uid)

      expect(global.fetch).toHaveBeenCalledWith(
        `${REGISTRY_ENDPOINTS.testnet}/schemas/${uid}`,
        expect.any(Object)
      )

      expect(result).toBeDefined()
      expect(result?.uid.toString('hex')).toBe(uid)
    })

    it('should support includeAttestations parameter', async () => {
      const uid = 'f1e2d3c4b5a6789012345678901234567890123456789012345678901234'
      const mockResponse = { success: true, data: { uid, schema_definition: 'test', deployerAddress: 'GAAA...', resolverAddress: 'GBBB...', revocable: true, createdAt: '2024-01-01T00:00:00Z', ledger: 12345 } }
      
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await getSchemaByUid(uid, true)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('include_attestations=true'),
        expect.any(Object)
      )
    })

    it('should return null for non-existent schema', async () => {
      const uid = 'nonexistent1234567890123456789012345678901234567890123456789'
      
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
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

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSchemasResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAttestationsResponse,
        })

      const result = await fetchRegistryDump()

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/schemas?limit=1000'),
        expect.any(Object)
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/attestations?limit=1000'),
        expect.any(Object)
      )

      expect(result.schemas).toHaveLength(1)
      expect(result.attestations).toHaveLength(1)
      expect(result.timestamp).toBeDefined()
      expect(result.ledger).toBe(12346)
    })

    it('should handle empty registry', async () => {
      const mockEmptyResponse = { success: true, data: [] }

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEmptyResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEmptyResponse,
        })

      const result = await fetchRegistryDump()

      expect(result.schemas).toEqual([])
      expect(result.attestations).toEqual([])
      expect(result.ledger).toBe(0)
    })

    it('should handle partial failures in registry dump', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        })

      await expect(fetchRegistryDump()).rejects.toThrow('Failed to fetch registry dump')
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON responses', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      await expect(fetchLatestAttestations()).rejects.toThrow()
    })

    it('should handle timeout errors', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Request timeout'))

      await expect(fetchLatestSchemas()).rejects.toThrow('Request timeout')
    })

    it('should handle rate limiting (429 status)', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
      })

      await expect(fetchLatestAttestations()).rejects.toThrow()
    })
  })

  describe('Limit Parameter Validation', () => {
    it('should enforce maximum limit of 100 for all fetch functions', async () => {
      const mockResponse = { success: true, data: [] }
      
      // Test fetchLatestAttestations
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })
      await fetchLatestAttestations(150)
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('limit=100'),
        expect.any(Object)
      )

      // Test fetchLatestSchemas
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })
      await fetchLatestSchemas(200)
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('limit=100'),
        expect.any(Object)
      )

      // Test fetchAttestationsByLedger
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })
      await fetchAttestationsByLedger(12345, 500)
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('limit=100'),
        expect.any(Object)
      )

      // Test fetchSchemasByLedger
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })
      await fetchSchemasByLedger(12345, 1000)
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('limit=100'),
        expect.any(Object)
      )
    })

    it('should use default limit of 100 when not specified', async () => {
      const mockResponse = { success: true, data: [] }
      
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await fetchLatestAttestations()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=100'),
        expect.any(Object)
      )
    })

    it('should accept valid limits under 100', async () => {
      const mockResponse = { success: true, data: [] }
      
      const validLimits = [1, 10, 25, 50, 75, 99, 100]
      
      for (const limit of validLimits) {
        ;(global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        })
        
        await fetchLatestAttestations(limit)
        
        expect(global.fetch).toHaveBeenLastCalledWith(
          expect.stringContaining(`limit=${limit}`),
          expect.any(Object)
        )
      }
    })
  })
})