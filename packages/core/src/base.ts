/**
 * Abstract base class for Attest Protocol SDKs
 * Provides common functionality and enforces the interface contract
 */

import { IAttestProtocol, IProtocolConfig, IBatchOperations, IOffChainOperations, IEventListener } from './interfaces'
import {
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
  AttestProtocolError,
  AttestProtocolErrorType,
  createSuccessResponse,
  createErrorResponse,
  createAttestProtocolError,
} from './types'

/**
 * Abstract base class that provides common functionality for all chain implementations
 * Chain-specific SDKs should extend this class and implement the abstract methods
 */
export abstract class AttestProtocolBase implements IAttestProtocol {
  protected config: IProtocolConfig
  protected initialized: boolean = false

  constructor(config: IProtocolConfig) {
    this.config = config
  }

  // Abstract methods that must be implemented by chain-specific SDKs

  abstract initialize(): Promise<AttestProtocolResponse<void>>

  // Authority Management
  abstract registerAuthority(): Promise<AttestProtocolResponse<string>>
  abstract fetchAuthority(id: string): Promise<AttestProtocolResponse<Authority | null>>
  abstract isIssuerAnAuthority(issuer: string): Promise<AttestProtocolResponse<boolean>>

  // Schema Management
  abstract createSchema(config: SchemaDefinition): Promise<AttestProtocolResponse<Schema>>
  abstract fetchSchemaById(id: string): Promise<AttestProtocolResponse<Schema | null>>
  abstract generateIdFromSchema(schema: SchemaDefinition): Promise<AttestProtocolResponse<string>>
  abstract listSchemasByIssuer(
    params: ListSchemasByIssuerParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Schema>>>

  // Attestation Management
  abstract issueAttestation(config: AttestationDefinition): Promise<AttestProtocolResponse<Attestation>>
  abstract fetchAttestationById(id: string): Promise<AttestProtocolResponse<Attestation | null>>
  abstract listAttestationsByWallet(
    params: ListAttestationsByWalletParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>>
  abstract listAttestationsBySchema(
    params: ListAttestationsBySchemaParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>>
  abstract revokeAttestation(config: RevocationDefinition): Promise<AttestProtocolResponse<void>>

  // Delegation
  abstract attestByDelegation(config: DelegatedAttestationDefinition): Promise<AttestProtocolResponse<Attestation>>
  abstract revokeByDelegation(config: DelegatedRevocationDefinition): Promise<AttestProtocolResponse<void>>

  // Common utility methods

  /**
   * Check if the SDK has been initialized
   */
  protected ensureInitialized(): AttestProtocolError | null {
    if (!this.initialized) {
      return createAttestProtocolError(
        AttestProtocolErrorType.VALIDATION_ERROR,
        'SDK must be initialized before performing operations. Call initialize() first.'
      )
    }
    return null
  }

  /**
   * Validate required parameters
   */
  protected validateRequired(params: Record<string, any>, requiredFields: string[]): AttestProtocolError | null {
    for (const field of requiredFields) {
      if (params[field] === undefined || params[field] === null || params[field] === '') {
        return createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          `Required parameter '${field}' is missing or empty`
        )
      }
    }
    return null
  }

  /**
   * Safe wrapper for async operations with error handling
   */
  protected async safeExecute<T>(
    operation: () => Promise<T>,
    finallyCallback?: () => void
  ): Promise<AttestProtocolResponse<T>> {
    try {
      const result = await operation()
      return createSuccessResponse(result)
    } catch (error) {
      console.error('SDK operation failed:', error)
      return createErrorResponse(error)
    } finally {
      finallyCallback?.()
    }
  }

  /**
   * Helper method to create paginated responses
   */
  protected createPaginatedResponse<T>(items: T[], total: number, limit: number, offset: number): PaginatedResponse<T> {
    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    }
  }

  /**
   * Normalize wallet address format (chain-specific implementations should override)
   */
  protected normalizeAddress(address: string): string {
    return address.trim()
  }

  /**
   * Validate schema definition
   */
  protected validateSchemaDefinition(schema: SchemaDefinition): AttestProtocolError | null {
    const validation = this.validateRequired(schema, ['name', 'content'])
    if (validation) return validation

    if (schema.name.length > 100) {
      return createAttestProtocolError(
        AttestProtocolErrorType.VALIDATION_ERROR,
        'Schema name must be 100 characters or less'
      )
    }

    if (schema.content.length === 0) {
      return createAttestProtocolError(AttestProtocolErrorType.VALIDATION_ERROR, 'Schema content cannot be empty')
    }

    return null
  }

  /**
   * Validate attestation definition
   */
  protected validateAttestationDefinition(attestation: AttestationDefinition): AttestProtocolError | null {
    const validation = this.validateRequired(attestation, ['schemaUid', 'subject', 'data'])
    if (validation) return validation

    if (attestation.expirationTime) {
      const expirationTime =
        typeof attestation.expirationTime === 'string'
          ? parseInt(attestation.expirationTime, 10)
          : attestation.expirationTime

      if (expirationTime <= Date.now()) {
        return createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          'Expiration time must be in the future'
        )
      }
    }

    return null
  }

  /**
   * Validate revocation definition
   */
  protected validateRevocationDefinition(revocation: RevocationDefinition): AttestProtocolError | null {
    return this.validateRequired(revocation, ['attestationUid'])
  }

  /**
   * Get configuration value with default
   */
  protected getConfigValue<T>(key: string, defaultValue: T): T {
    return this.config[key] !== undefined ? this.config[key] : defaultValue
  }

  /**
   * Get network URL
   */
  protected getNetworkUrl(): string {
    return this.config.url || this.getDefaultNetworkUrl()
  }

  /**
   * Get default network URL (must be implemented by chain-specific SDKs)
   */
  protected abstract getDefaultNetworkUrl(): string

  /**
   * Format timestamp for the specific chain
   */
  protected formatTimestamp(timestamp: number | string): number | string {
    if (typeof timestamp === 'string') {
      return timestamp
    }
    return timestamp
  }

  /**
   * Parse timestamp from chain format
   */
  protected parseTimestamp(timestamp: any): number {
    if (typeof timestamp === 'number') {
      return timestamp
    }
    if (typeof timestamp === 'string') {
      return parseInt(timestamp, 10)
    }
    if (timestamp && typeof timestamp.toNumber === 'function') {
      return timestamp.toNumber()
    }
    return Date.now()
  }
}

/**
 * Mixin class for SDKs that support batch operations
 */
export abstract class BatchAttestProtocol extends AttestProtocolBase implements IBatchOperations {
  abstract batchIssueAttestations(attestations: AttestationDefinition[]): Promise<AttestProtocolResponse<Attestation[]>>
  abstract batchRevokeAttestations(revocations: RevocationDefinition[]): Promise<AttestProtocolResponse<void>>
}

/**
 * Mixin class for SDKs that support off-chain operations
 */
export abstract class OffChainAttestProtocol extends AttestProtocolBase implements IOffChainOperations {
  abstract createOffChainAttestation(config: AttestationDefinition): Promise<AttestProtocolResponse<string>>
  abstract verifyOffChainAttestation(
    attestation: Attestation,
    signature: string
  ): Promise<AttestProtocolResponse<boolean>>
}

/**
 * Mixin class for SDKs that support event listening
 */
export abstract class EventListenerAttestProtocol extends AttestProtocolBase implements IEventListener {
  abstract subscribeToAttestationEvents(callback: (event: any) => void): Promise<AttestProtocolResponse<string>>
  abstract subscribeToSchemaEvents(callback: (event: any) => void): Promise<AttestProtocolResponse<string>>
  abstract unsubscribe(subscriptionId: string): Promise<AttestProtocolResponse<void>>
}
