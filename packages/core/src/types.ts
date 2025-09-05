/**
 * Core types and abstractions for Attest Protocol SDKs
 * These types are chain-agnostic and serve as the foundation for all chain-specific implementations
 */

/**
 * Standard response type for all SDK operations
 * @template T - The type of the data in the response
 */
export type AttestProtocolResponse<T = undefined> =
  | {
      data: T
      error?: undefined
    }
  | {
      data?: undefined
      error: any
    }

/**
 * Base configuration for any chain-specific SDK
 */
export interface ChainConfig {
  rpcUrl?: string
  [key: string]: any
}

/**
 * Generic authority representation
 */
export interface Authority {
  id: string
  isVerified: boolean
  metadata?: string
  deploymentTime?: number | string
  [key: string]: any
}

/**
 * Generic schema representation
 */
export interface Schema {
  uid: string
  definition: string
  authority: string
  revocable: boolean
  resolver?: string | null
  [key: string]: any
}

/**
 * Generic attestation representation
 */
export interface Attestation {
  uid: string
  schemaUid: string
  subject: string
  attester: string
  data: string
  timestamp: number | string
  expirationTime?: number | string | null
  revocationTime?: number | string | null
  revoked: boolean
  reference?: string | null
  [key: string]: any
}

/**
 * Generic schema creation configuration
 */
export interface SchemaDefinition {
  name: string
  content: string
  revocable?: boolean
  resolver: string | undefined
}

/**
 * Generic attestation creation configuration
 */
export interface AttestationDefinition {
  schemaUid: string
  subject: string
  data: string
  expirationTime?: number | string | null
  revocable?: boolean
  reference?: string | null
}

/**
 * Generic revocation configuration
 */
export interface RevocationDefinition {
  attestationUid: string
  reference?: string | null
}

/**
 * Generic delegation configuration for attestations
 */
export interface DelegatedAttestationDefinition extends AttestationDefinition {
  delegator: string
  signature: string
  nonce?: string | number
}

/**
 * Generic delegation configuration for revocations
 */
export interface DelegatedRevocationDefinition extends RevocationDefinition {
  delegator: string
  signature: string
  nonce?: string | number
}

/**
 * Query parameters for listing attestations by wallet
 */
export interface ListAttestationsByWalletParams {
  wallet: string
  limit?: number
  offset?: number
  schemaUid?: string
  includeRevoked?: boolean
}

/**
 * Query parameters for listing attestations by schema
 */
export interface ListAttestationsBySchemaParams {
  schemaUid: string
  limit?: number
  offset?: number
  includeRevoked?: boolean
  subject?: string
}

/**
 * Query parameters for listing schemas by issuer
 */
export interface ListSchemasByIssuerParams {
  issuer: string
  limit?: number
  offset?: number
}

/**
 * Pagination response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

/**
 * Error types for SDK operations
 */
export enum AttestProtocolErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  ALREADY_EXISTS_ERROR = 'ALREADY_EXISTS_ERROR',
  INVALID_SIGNATURE_ERROR = 'INVALID_SIGNATURE_ERROR',
  EXPIRED_ERROR = 'EXPIRED_ERROR',
  REVOKED_ERROR = 'REVOKED_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Structured error for SDK operations
 */
export interface AttestProtocolError {
  type: AttestProtocolErrorType
  message: string
  details?: any
  code?: string | number
}

/**
 * Helper function to create a success response
 */
export function createSuccessResponse<T>(data: T): AttestProtocolResponse<T> {
  return { data }
}

/**
 * Helper function to create an error response
 */
export function createErrorResponse(error: any): AttestProtocolResponse<never> {
  return { error }
}

/**
 * Helper function to create a structured error
 */
export function createAttestProtocolError(
  type: AttestProtocolErrorType,
  message: string,
  details?: any,
  code?: string | number
): AttestProtocolError {
  return { type, message, details, code }
}
