/**
 * Error handling for Stellar Attest Protocol SDK
 * 
 * Provides comprehensive error types and utilities for handling
 * all possible error states in the SDK.
 */

/**
 * Base error class for all Stellar SDK errors
 */
export class StellarClientError extends Error {
  public readonly code: string
  public readonly details?: any
  public readonly timestamp: Date

  constructor(message: string, code: string, details?: any) {
    super(message)
    this.name = 'StellarClientError'
    this.code = code
    this.details = details
    this.timestamp = new Date()
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StellarClientError)
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends StellarClientError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', details)
    this.name = 'NetworkError'
  }
}

/**
 * Contract interaction errors
 */
export class ContractError extends StellarClientError {
  public readonly contractId?: string
  public readonly method?: string

  constructor(message: string, contractId?: string, method?: string, details?: any) {
    super(message, 'CONTRACT_ERROR', details)
    this.name = 'ContractError'
    this.contractId = contractId
    this.method = method
  }
}

/**
 * Transaction-related errors
 */
export class TransactionError extends StellarClientError {
  public readonly txHash?: string
  public readonly status?: string

  constructor(message: string, txHash?: string, status?: string, details?: any) {
    super(message, 'TRANSACTION_ERROR', details)
    this.name = 'TransactionError'
    this.txHash = txHash
    this.status = status
  }
}

/**
 * Validation errors for input data
 */
export class ValidationError extends StellarClientError {
  public readonly field?: string
  public readonly value?: any

  constructor(message: string, field?: string, value?: any) {
    super(message, 'VALIDATION_ERROR', { field, value })
    this.name = 'ValidationError'
    this.field = field
    this.value = value
  }
}

/**
 * Schema-related errors
 */
export class SchemaError extends StellarClientError {
  public readonly schemaUid?: string
  public readonly schemaName?: string

  constructor(message: string, schemaUid?: string, schemaName?: string, details?: any) {
    super(message, 'SCHEMA_ERROR', details)
    this.name = 'SchemaError'
    this.schemaUid = schemaUid
    this.schemaName = schemaName
  }
}

/**
 * Attestation-related errors
 */
export class AttestationError extends StellarClientError {
  public readonly attestationUid?: string
  public readonly schemaUid?: string

  constructor(message: string, attestationUid?: string, schemaUid?: string, details?: any) {
    super(message, 'ATTESTATION_ERROR', details)
    this.name = 'AttestationError'
    this.attestationUid = attestationUid
    this.schemaUid = schemaUid
  }
}

/**
 * BLS signature and cryptography errors
 */
export class CryptographyError extends StellarClientError {
  public readonly operation?: string

  constructor(message: string, operation?: string, details?: any) {
    super(message, 'CRYPTOGRAPHY_ERROR', details)
    this.name = 'CryptographyError'
    this.operation = operation
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends StellarClientError {
  public readonly missingField?: string

  constructor(message: string, missingField?: string) {
    super(message, 'CONFIGURATION_ERROR', { missingField })
    this.name = 'ConfigurationError'
    this.missingField = missingField
  }
}

/**
 * Not implemented error for features pending implementation
 */
export class NotImplementedError extends StellarClientError {
  public readonly feature?: string

  constructor(feature: string, plannedScope?: string) {
    super(
      `Feature '${feature}' is not yet implemented${plannedScope ? ` (planned for ${plannedScope})` : ''}`,
      'NOT_IMPLEMENTED',
      { feature, plannedScope }
    )
    this.name = 'NotImplementedError'
    this.feature = feature
  }
}

/**
 * Not found error for missing resources
 */
export class NotFoundError extends StellarClientError {
  public readonly resourceType?: string
  public readonly resourceId?: string

  constructor(resourceType: string, resourceId?: string) {
    super(
      `${resourceType}${resourceId ? ` with ID '${resourceId}'` : ''} not found`,
      'NOT_FOUND',
      { resourceType, resourceId }
    )
    this.name = 'NotFoundError'
    this.resourceType = resourceType
    this.resourceId = resourceId
  }
}

/**
 * Authorization/permission errors
 */
export class AuthorizationError extends StellarClientError {
  public readonly requiredRole?: string
  public readonly currentRole?: string

  constructor(message: string, requiredRole?: string, currentRole?: string) {
    super(message, 'AUTHORIZATION_ERROR', { requiredRole, currentRole })
    this.name = 'AuthorizationError'
    this.requiredRole = requiredRole
    this.currentRole = currentRole
  }
}

/**
 * Timeout errors for operations that exceed time limits
 */
export class TimeoutError extends StellarClientError {
  public readonly timeoutMs?: number
  public readonly operation?: string

  constructor(operation: string, timeoutMs?: number) {
    super(
      `Operation '${operation}' timed out${timeoutMs ? ` after ${timeoutMs}ms` : ''}`,
      'TIMEOUT_ERROR',
      { operation, timeoutMs }
    )
    this.name = 'TimeoutError'
    this.operation = operation
    this.timeoutMs = timeoutMs
  }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends StellarClientError {
  public readonly retryAfter?: number

  constructor(message: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', { retryAfter })
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

/**
 * Horizon API errors
 */
export class HorizonError extends StellarClientError {
  public readonly statusCode?: number
  public readonly endpoint?: string

  constructor(message: string, statusCode?: number, endpoint?: string, details?: any) {
    super(message, 'HORIZON_ERROR', details)
    this.name = 'HorizonError'
    this.statusCode = statusCode
    this.endpoint = endpoint
  }
}

/**
 * Error codes enum for consistent error handling
 */
export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  
  // Contract errors
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  CONTRACT_NOT_FOUND = 'CONTRACT_NOT_FOUND',
  CONTRACT_CALL_FAILED = 'CONTRACT_CALL_FAILED',
  
  // Transaction errors
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_SIMULATION_FAILED = 'TRANSACTION_SIMULATION_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_SCHEMA_UID = 'INVALID_SCHEMA_UID',
  INVALID_ATTESTATION_UID = 'INVALID_ATTESTATION_UID',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Schema errors
  SCHEMA_ERROR = 'SCHEMA_ERROR',
  SCHEMA_NOT_FOUND = 'SCHEMA_NOT_FOUND',
  SCHEMA_ALREADY_EXISTS = 'SCHEMA_ALREADY_EXISTS',
  SCHEMA_INVALID_FORMAT = 'SCHEMA_INVALID_FORMAT',
  
  // Attestation errors
  ATTESTATION_ERROR = 'ATTESTATION_ERROR',
  ATTESTATION_NOT_FOUND = 'ATTESTATION_NOT_FOUND',
  ATTESTATION_ALREADY_EXISTS = 'ATTESTATION_ALREADY_EXISTS',
  ATTESTATION_EXPIRED = 'ATTESTATION_EXPIRED',
  ATTESTATION_REVOKED = 'ATTESTATION_REVOKED',
  
  // Cryptography errors
  CRYPTOGRAPHY_ERROR = 'CRYPTOGRAPHY_ERROR',
  SIGNATURE_VERIFICATION_FAILED = 'SIGNATURE_VERIFICATION_FAILED',
  KEY_GENERATION_FAILED = 'KEY_GENERATION_FAILED',
  
  // Configuration errors
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  MISSING_CONTRACT_ID = 'MISSING_CONTRACT_ID',
  INVALID_NETWORK = 'INVALID_NETWORK',
  
  // Feature errors
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  DEPRECATED = 'DEPRECATED',
  
  // Authorization errors
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Other errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

/**
 * Error factory for creating appropriate error types
 */
export class ErrorFactory {
  static createFromCode(code: ErrorCode, message: string, details?: any): StellarClientError {
    switch (code) {
      case ErrorCode.NETWORK_ERROR:
      case ErrorCode.NETWORK_TIMEOUT:
      case ErrorCode.NETWORK_UNAVAILABLE:
        return new NetworkError(message, details)
      
      case ErrorCode.CONTRACT_ERROR:
      case ErrorCode.CONTRACT_NOT_FOUND:
      case ErrorCode.CONTRACT_CALL_FAILED:
        return new ContractError(message, details?.contractId, details?.method, details)
      
      case ErrorCode.TRANSACTION_ERROR:
      case ErrorCode.TRANSACTION_FAILED:
      case ErrorCode.TRANSACTION_SIMULATION_FAILED:
      case ErrorCode.INSUFFICIENT_FUNDS:
        return new TransactionError(message, details?.txHash, details?.status, details)
      
      case ErrorCode.VALIDATION_ERROR:
      case ErrorCode.INVALID_ADDRESS:
      case ErrorCode.INVALID_SCHEMA_UID:
      case ErrorCode.INVALID_ATTESTATION_UID:
      case ErrorCode.INVALID_SIGNATURE:
      case ErrorCode.INVALID_INPUT:
        return new ValidationError(message, details?.field, details?.value)
      
      case ErrorCode.SCHEMA_ERROR:
      case ErrorCode.SCHEMA_NOT_FOUND:
      case ErrorCode.SCHEMA_ALREADY_EXISTS:
      case ErrorCode.SCHEMA_INVALID_FORMAT:
        return new SchemaError(message, details?.schemaUid, details?.schemaName, details)
      
      case ErrorCode.ATTESTATION_ERROR:
      case ErrorCode.ATTESTATION_NOT_FOUND:
      case ErrorCode.ATTESTATION_ALREADY_EXISTS:
      case ErrorCode.ATTESTATION_EXPIRED:
      case ErrorCode.ATTESTATION_REVOKED:
        return new AttestationError(message, details?.attestationUid, details?.schemaUid, details)
      
      case ErrorCode.CRYPTOGRAPHY_ERROR:
      case ErrorCode.SIGNATURE_VERIFICATION_FAILED:
      case ErrorCode.KEY_GENERATION_FAILED:
        return new CryptographyError(message, details?.operation, details)
      
      case ErrorCode.CONFIGURATION_ERROR:
      case ErrorCode.MISSING_CONTRACT_ID:
      case ErrorCode.INVALID_NETWORK:
        return new ConfigurationError(message, details?.missingField)
      
      case ErrorCode.NOT_IMPLEMENTED:
        return new NotImplementedError(details?.feature || 'Unknown feature', details?.plannedScope)
      
      case ErrorCode.AUTHORIZATION_ERROR:
      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.FORBIDDEN:
        return new AuthorizationError(message, details?.requiredRole, details?.currentRole)
      
      default:
        return new StellarClientError(message, code, details)
    }
  }

  /**
   * Wrap any error into a StellarClientError
   */
  static wrap(error: any, context?: string): StellarClientError {
    if (error instanceof StellarClientError) {
      return error
    }

    const message = context 
      ? `${context}: ${error?.message || String(error)}`
      : error?.message || String(error)

    // Try to determine error type from the original error
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
      return new NetworkError(message, { originalError: error })
    }

    if (error?.message?.includes('insufficient funds')) {
      return new TransactionError(message, undefined, 'INSUFFICIENT_FUNDS', { originalError: error })
    }

    if (error?.message?.includes('not found')) {
      return new NotFoundError('Resource', undefined)
    }

    if (error?.message?.includes('unauthorized') || error?.message?.includes('forbidden')) {
      return new AuthorizationError(message)
    }

    return new StellarClientError(message, 'UNKNOWN_ERROR', { originalError: error })
  }
}

/**
 * Type guard to check if an error is a StellarClientError
 */
export function isStellarClientError(error: any): error is StellarClientError {
  return error instanceof StellarClientError
}

/**
 * Type guard for specific error types
 */
export function isNetworkError(error: any): error is NetworkError {
  return error instanceof NetworkError
}

export function isValidationError(error: any): error is ValidationError {
  return error instanceof ValidationError
}

export function isTransactionError(error: any): error is TransactionError {
  return error instanceof TransactionError
}

export function isNotFoundError(error: any): error is NotFoundError {
  return error instanceof NotFoundError
}

export function isNotImplementedError(error: any): error is NotImplementedError {
  return error instanceof NotImplementedError
}

/**
 * Retry configuration for operations
 */
export interface RetryConfig {
  maxAttempts: number
  backoffMs: number
  maxBackoffMs: number
  shouldRetry?: (error: StellarClientError, attempt: number) => boolean
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  backoffMs: 1000,
  maxBackoffMs: 10000,
  shouldRetry: (error, attempt) => {
    // Retry network errors and timeouts
    if (error instanceof NetworkError || error instanceof TimeoutError) {
      return attempt < 3
    }
    // Retry rate limits with backoff
    if (error instanceof RateLimitError) {
      return true
    }
    // Don't retry validation errors or not found errors
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return false
    }
    return false
  }
}

/**
 * Retry an operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: StellarClientError | undefined
  
  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = ErrorFactory.wrap(error)
      
      if (attempt === finalConfig.maxAttempts) {
        break
      }
      
      if (finalConfig.shouldRetry && !finalConfig.shouldRetry(lastError, attempt)) {
        break
      }
      
      // Calculate backoff with jitter
      const backoff = Math.min(
        finalConfig.backoffMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
        finalConfig.maxBackoffMs
      )
      
      // If it's a rate limit error with retryAfter, use that instead
      if (lastError instanceof RateLimitError && lastError.retryAfter) {
        await new Promise(resolve => setTimeout(resolve, lastError.retryAfter! * 1000))
      } else {
        await new Promise(resolve => setTimeout(resolve, backoff))
      }
    }
  }
  
  throw lastError || new StellarClientError('Operation failed after retries', 'RETRY_EXHAUSTED')
}