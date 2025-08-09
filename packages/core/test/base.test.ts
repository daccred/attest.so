import { describe, it, expect, beforeEach } from 'vitest'
import { AttestProtocolBase } from '../src/base'
import {
  IProtocolConfig,
  AttestProtocolResponse,
  Authority,
  Schema,
  Attestation,
  SchemaDefinition,
  AttestationDefinition,
  RevocationDefinition,
  DelegatedAttestationDefinition,
  DelegatedRevocationDefinition,
  ListAttestationsByWalletParams,
  ListAttestationsBySchemaParams,
  ListSchemasByIssuerParams,
  PaginatedResponse,
  AttestProtocolErrorType
} from '../src'

// Mock implementation for testing
class MockAttestProtocol extends AttestProtocolBase {
  async initialize(): Promise<AttestProtocolResponse<void>> {
    this.initialized = true
    return { data: undefined }
  }

  async registerAuthority(): Promise<AttestProtocolResponse<string>> {
    return { data: 'mock-authority-id' }
  }

  async fetchAuthority(id: string): Promise<AttestProtocolResponse<Authority | null>> {
    return { data: null }
  }

  async isIssuerAnAuthority(issuer: string): Promise<AttestProtocolResponse<boolean>> {
    return { data: false }
  }

  async createSchema(config: SchemaDefinition): Promise<AttestProtocolResponse<Schema>> {
    return { data: { uid: 'mock-schema', definition: config.content, authority: 'mock-auth', revocable: true } }
  }

  async fetchSchemaById(id: string): Promise<AttestProtocolResponse<Schema | null>> {
    return { data: null }
  }

  async generateIdFromSchema(schema: SchemaDefinition): Promise<AttestProtocolResponse<string>> {
    return { data: 'generated-id' }
  }

  async listSchemasByIssuer(params: ListSchemasByIssuerParams): Promise<AttestProtocolResponse<PaginatedResponse<Schema>>> {
    return { data: { items: [], total: 0, limit: 10, offset: 0, hasMore: false } }
  }

  async issueAttestation(config: AttestationDefinition): Promise<AttestProtocolResponse<Attestation>> {
    return { data: { uid: 'mock-attestation', schemaUid: config.schemaUid, subject: config.subject, attester: 'mock-attester', data: config.data, timestamp: Date.now(), revoked: false } }
  }

  async fetchAttestationById(id: string): Promise<AttestProtocolResponse<Attestation | null>> {
    return { data: null }
  }

  async listAttestationsByWallet(params: ListAttestationsByWalletParams): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>> {
    return { data: { items: [], total: 0, limit: 10, offset: 0, hasMore: false } }
  }

  async listAttestationsBySchema(params: ListAttestationsBySchemaParams): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>> {
    return { data: { items: [], total: 0, limit: 10, offset: 0, hasMore: false } }
  }

  async revokeAttestation(config: RevocationDefinition): Promise<AttestProtocolResponse<void>> {
    return { data: undefined }
  }

  async attestByDelegation(config: DelegatedAttestationDefinition): Promise<AttestProtocolResponse<Attestation>> {
    return { data: { uid: 'delegated-attestation', schemaUid: config.schemaUid, subject: config.subject, attester: config.delegator, data: config.data, timestamp: Date.now(), revoked: false } }
  }

  async revokeByDelegation(config: DelegatedRevocationDefinition): Promise<AttestProtocolResponse<void>> {
    return { data: undefined }
  }

  protected getDefaultNetworkUrl(): string {
    return 'https://mock-network.example.com'
  }
}

describe('AttestProtocolBase', () => {
  let sdk: MockAttestProtocol
  const mockConfig: IProtocolConfig = {
    url: 'https://test.example.com'
  }

  beforeEach(() => {
    sdk = new MockAttestProtocol(mockConfig)
  })

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await sdk.initialize()
      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
    })
  })

  describe('Validation methods', () => {
    beforeEach(async () => {
      await sdk.initialize()
    })

    it('should validate schema definition correctly', () => {
      const validSchema: SchemaDefinition = {
        name: 'Test Schema',
        content: 'string name, uint age'
      }

      const error = (sdk as any).validateSchemaDefinition(validSchema)
      expect(error).toBeNull()
    })

    it('should reject schema with missing name', () => {
      const invalidSchema = {
        content: 'string name, uint age'
      } as SchemaDefinition

      const error = (sdk as any).validateSchemaDefinition(invalidSchema)
      expect(error).toBeTruthy()
      expect(error.type).toBe(AttestProtocolErrorType.VALIDATION_ERROR)
    })

    it('should validate attestation definition correctly', () => {
      const validAttestation: AttestationDefinition = {
        schemaUid: 'schema-123',
        subject: 'subject-address',
        data: 'attestation data'
      }

      const error = (sdk as any).validateAttestationDefinition(validAttestation)
      expect(error).toBeNull()
    })

    it('should reject attestation with past expiration', () => {
      const invalidAttestation: AttestationDefinition = {
        schemaUid: 'schema-123',
        subject: 'subject-address',
        data: 'attestation data',
        expirationTime: Date.now() - 1000 // Past time
      }

      const error = (sdk as any).validateAttestationDefinition(invalidAttestation)
      expect(error).toBeTruthy()
      expect(error.type).toBe(AttestProtocolErrorType.VALIDATION_ERROR)
    })
  })

  describe('Utility methods', () => {
    it('should create paginated response correctly', () => {
      const items = [{ id: '1' }, { id: '2' }]
      const response = (sdk as any).createPaginatedResponse(items, 10, 5, 0)

      expect(response.items).toEqual(items)
      expect(response.total).toBe(10)
      expect(response.limit).toBe(5)
      expect(response.offset).toBe(0)
      expect(response.hasMore).toBe(true)
    })

    it('should normalize address correctly', () => {
      const address = '  0x123abc  '
      const normalized = (sdk as any).normalizeAddress(address)
      expect(normalized).toBe('0x123abc')
    })

    it('should get config values with defaults', () => {
      const url = (sdk as any).getConfigValue('url', 'default-url')
      expect(url).toBe('https://test.example.com')

      const missing = (sdk as any).getConfigValue('missing', 'default-value')
      expect(missing).toBe('default-value')
    })
  })
})