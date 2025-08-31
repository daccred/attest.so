/**
 * Base error class for all Stellar SDK errors
 * @example
 * ```typescript
 * try {
 *   throw new StellarClientError('Something went wrong', 'UNKNOWN_ERROR');
 * } catch (error) {
 *   if (isStellarClientError(error)) {
 *     console.error(error.toJSON());
 *   }
 * }
 * ```
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
      stack: this.stack,
    }
  }
}

/**
 * Represents errors related to network connectivity, timeouts, or availability.
 * @see {StellarClientError}
 */
export class NetworkError extends StellarClientError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', details)
    this.name = 'NetworkError'
  }
}

/**
 * Represents errors that occur during smart contract interactions.
 * @property {string} [contractId] - The ID of the contract that caused the error.
 * @property {string} [method] - The contract method that was being called.
 * @see {StellarClientError}
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
 * Represents errors related to Stellar transactions, such as submission failures or simulation errors.
 * @property {string} [txHash] - The hash of the failed transaction.
 * @property {string} [status] - The status of the transaction (e.g., 'FAILED', 'REJECTED').
 * @see {StellarClientError}
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
 * Represents errors due to invalid input data, such as incorrect formats or missing fields.
 * @property {string} [field] - The name of the field that failed validation.
 * @property {any} [value] - The invalid value that was provided.
 * @see {StellarClientError}
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
 * Represents errors related to schema management, such as a schema not being found or having an invalid format.
 * @property {string} [schemaUid] - The unique identifier of the schema.
 * @property {string} [schemaName] - The name of the schema.
 * @see {StellarClientError}
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
 * Represents errors related to attestations, such as an attestation being expired, revoked, or not found.
 * @property {string} [attestationUid] - The unique identifier of the attestation.
 * @property {string} [schemaUid] - The unique identifier of the schema associated with the attestation.
 * @see {StellarClientError}
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
 * Represents errors related to cryptographic operations, such as BLS signature verification or key generation.
 * @property {string} [operation] - The cryptographic operation that failed (e.g., 'sign', 'verify').
 * @see {StellarClientError}
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
 * Represents errors in the SDK's configuration, such as a missing contract ID or invalid network setting.
 * @property {string} [missingField] - The name of the configuration field that is missing or invalid.
 * @see {StellarClientError}
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
 * Represents an error for a feature that has not yet been implemented.
 * @property {string} [feature] - The name of the unimplemented feature.
 * @see {StellarClientError}
 * @example
 * ```
 * try {
 *  await client.useSomeNewFeature();
 * } catch (e) {
 *  if (isNotImplementedError(e)) {
 *      console.log(e.message); // "Feature 'useSomeNewFeature' is not yet implemented"
 *  }
 * }
 * ```
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
 * Represents an error for a resource that could not be found.
 * @property {string} [resourceType] - The type of the resource that was not found (e.g., 'Attestation', 'Schema').
 * @property {string} [resourceId] - The ID of the resource that was not found.
 * @see {StellarClientError}
 */
export class NotFoundError extends StellarClientError {
  public readonly resourceType?: string
  public readonly resourceId?: string

  constructor(resourceType: string, resourceId?: string) {
    super(`${resourceType}${resourceId ? ` with ID '${resourceId}'` : ''} not found`, 'NOT_FOUND', {
      resourceType,
      resourceId,
    })
    this.name = 'NotFoundError'
    this.resourceType = resourceType
    this.resourceId = resourceId
  }
}

/**
 * Represents errors related to authorization and permissions.
 * @property {string} [requiredRole] - The role required to perform the action.
 * @property {string} [currentRole] - The role of the user attempting the action.
 * @see {StellarClientError}
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
 * Represents errors for operations that exceed a specified time limit.
 * @property {number} [timeoutMs] - The timeout in milliseconds.
 * @property {string} [operation] - The name of the operation that timed out.
 * @see {StellarClientError}
 */
export class TimeoutError extends StellarClientError {
  public readonly timeoutMs?: number
  public readonly operation?: string

  constructor(operation: string, timeoutMs?: number) {
    super(`Operation '${operation}' timed out${timeoutMs ? ` after ${timeoutMs}ms` : ''}`, 'TIMEOUT_ERROR', {
      operation,
      timeoutMs,
    })
    this.name = 'TimeoutError'
    this.operation = operation
    this.timeoutMs = timeoutMs
  }
}

/**
 * Represents errors that occur when a rate limit has been exceeded.
 * @property {number} [retryAfter] - The number of seconds to wait before retrying.
 * @see {StellarClientError}
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
 * Represents errors returned from the Horizon API.
 * @property {number} [statusCode] - The HTTP status code from the Horizon response.
 * @property {string} [endpoint] - The Horizon API endpoint that was called.
 * @see {StellarClientError}
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
 * Provides a standardized set of error codes for consistent error handling throughout the SDK.
 * These codes categorize errors into logical groups such as network, contract, transaction, etc.
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
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * A factory class for creating appropriate error instances from error codes or wrapping existing errors.
 * This helps in standardizing error creation and handling.
 *
 * @example
 * ```typescript
 * // Creating an error from a code
 * const notFoundError = ErrorFactory.createFromCode(
 *   ErrorCode.SCHEMA_NOT_FOUND,
 *   'Schema not found',
 *   { schemaUid: '0x123...' }
 * );
 *
 * // Wrapping an external error
 * try {
 *   await someThirdPartyApiCall();
 * } catch (e) {
 *   const wrappedError = ErrorFactory.wrap(e, 'Failed during API call');
 *   // wrappedError is now a StellarClientError
 * }
 * ```
 */
export class ErrorFactory {
  /**
   * Creates a specific `StellarClientError` subclass based on the provided `ErrorCode`.
   * @param {ErrorCode} code - The error code to create an error for.
   * @param {string} message - The error message.
   * @param {any} [details] - Additional details for the error.
   * @returns {StellarClientError} An instance of a `StellarClientError` subclass.
   */
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
   * Wraps any thrown value into a `StellarClientError`.
   * If the error is already a `StellarClientError`, it is returned as is.
   * It also attempts to infer a more specific error type from the original error's properties.
   *
   * @param {any} error - The error to wrap.
   * @param {string} [context] - An optional context message to prepend to the error message.
   * @returns {StellarClientError} The wrapped error.
   */
  static wrap(error: any, context?: string): StellarClientError {
    if (error instanceof StellarClientError) {
      return error
    }

    const message = context ? `${context}: ${error?.message || String(error)}` : error?.message || String(error)

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
 * Type guard to check if an error is an instance of `StellarClientError`.
 * @param {any} error - The value to check.
 * @returns {boolean} `true` if the error is a `StellarClientError`, otherwise `false`.
 */
export function isStellarClientError(error: any): error is StellarClientError {
  return error instanceof StellarClientError
}

/**
 * Type guard to check if an error is an instance of `NetworkError`.
 * @param {any} error - The value to check.
 * @returns {boolean} `true` if the error is a `NetworkError`, otherwise `false`.
 * @see {NetworkError}
 */
export function isNetworkError(error: any): error is NetworkError {
  return error instanceof NetworkError
}

/**
 * Type guard to check if an error is an instance of `ValidationError`.
 * @param {any} error - The value to check.
 * @returns {boolean} `true` if the error is a `ValidationError`, otherwise `false`.
 * @see {ValidationError}
 */
export function isValidationError(error: any): error is ValidationError {
  return error instanceof ValidationError
}

/**
 * Type guard to check if an error is an instance of `TransactionError`.
 * @param {any} error - The value to check.
 * @returns {boolean} `true` if the error is a `TransactionError`, otherwise `false`.
 * @see {TransactionError}
 */
export function isTransactionError(error: any): error is TransactionError {
  return error instanceof TransactionError
}

/**
 * Type guard to check if an error is an instance of `NotFoundError`.
 * @param {any} error - The value to check.
 * @returns {boolean} `true` if the error is a `NotFoundError`, otherwise `false`.
 * @see {NotFoundError}
 */
export function isNotFoundError(error: any): error is NotFoundError {
  return error instanceof NotFoundError
}

/**
 * Type guard to check if an error is an instance of `NotImplementedError`.
 * @param {any} error - The value to check.
 * @returns {boolean} `true` if the error is a `NotImplementedError`, otherwise `false`.
 * @see {NotImplementedError}
 */
export function isNotImplementedError(error: any): error is NotImplementedError {
  return error instanceof NotImplementedError
}

/**
 * Configuration for retryable operations.
 * @property {number} maxAttempts - The maximum number of times to attempt the operation.
 * @property {number} backoffMs - The initial backoff delay in milliseconds.
 * @property {number} maxBackoffMs - The maximum backoff delay in milliseconds.
 * @property {(error: StellarClientError, attempt: number) => boolean} [shouldRetry] - A function to determine if a failed attempt should be retried.
 */
export interface RetryConfig {
  maxAttempts: number
  backoffMs: number
  maxBackoffMs: number
  shouldRetry?: (error: StellarClientError, attempt: number) => boolean
}

/**
 * The default configuration for the `withRetry` utility.
 * It specifies a default retry strategy:
 * - Retries up to 3 times on `NetworkError` or `TimeoutError`.
 * - Retries on `RateLimitError`.
 * - Does not retry on `ValidationError` or `NotFoundError`.
 * @see {RetryConfig}
 * @see {withRetry}
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  backoffMs: 1000,
  maxBackoffMs: 10000,
  shouldRetry: (error, attempt) => {
    if (error instanceof NetworkError || error instanceof TimeoutError) {
      return attempt < 3
    }
    if (error instanceof RateLimitError) {
      return true
    }
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return false
    }
    return false
  },
}

/**
 * A utility function to execute an operation with a retry mechanism using exponential backoff.
 * This is useful for making operations more resilient to transient failures like network issues.
 *
 * @template T - The return type of the operation.
 * @param {() => Promise<T>} operation - The asynchronous operation to execute.
 * @param {Partial<RetryConfig>} [config={}] - Optional partial configuration to override the default retry settings.
 * @returns {Promise<T>} A promise that resolves with the result of the operation if successful.
 * @throws {StellarClientError} Throws the last error encountered if all retry attempts fail.
 *
 * @example
 * ```typescript
 * async function fetchSomeData() {
 *   // a network call that might fail
 * }
 *
 * try {
 *   const data = await withRetry(fetchSomeData, { maxAttempts: 5 });
 *   console.log('Data fetched successfully:', data);
 * } catch (error) {
 *   console.error('Failed to fetch data after multiple retries:', error);
 * }
 * ```
 */
export async function withRetry<T>(operation: () => Promise<T>, config: Partial<RetryConfig> = {}): Promise<T> {
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

      const backoff = Math.min(
        finalConfig.backoffMs * Math.pow(2, attempt - 1) + Math.random() * 1000, // Exponential backoff with jitter
        finalConfig.maxBackoffMs
      )

      await new Promise((resolve) => setTimeout(resolve, backoff))
    }
  }

  throw lastError || new StellarClientError('Operation failed after retries', 'RETRY_EXHAUSTED')
}
