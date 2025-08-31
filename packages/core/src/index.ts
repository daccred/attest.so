/**
 * @attestprotocol/core
 *
 * Core abstractions and interfaces for Attest Protocol SDKs
 * This package provides the foundation for all chain-specific implementations
 */

// Export all types
export * from './types'

// Export all interfaces
export * from './interfaces'

// Export base classes
export * from './base'

// Re-export commonly used items for convenience
export {
  type AttestProtocolResponse,
  type Authority,
  type Schema,
  type Attestation,
  type SchemaDefinition,
  type AttestationDefinition,
  type RevocationDefinition,
  AttestProtocolErrorType,
  createSuccessResponse,
  createErrorResponse,
  createAttestProtocolError,
} from './types'

export {
  type IAttestProtocol,
  type IProtocolConfig,
  type IBatchOperations,
  type IOffChainOperations,
  type IEventListener,
} from './interfaces'

export { AttestProtocolBase, BatchAttestProtocol, OffChainAttestProtocol, EventListenerAttestProtocol } from './base'
