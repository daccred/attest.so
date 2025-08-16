/**
 * @attestprotocol/stellar-sdk
 * 
 * Stellar implementation of the Attest Protocol SDK
 */

// Export the main SDK class
export { StellarAttestProtocol } from './stellar-sdk'

// Export service classes for direct use
export { StellarSchemaService } from './schema'
export { StellarAttestationService } from './attest'
export { StellarAuthorityService } from './authority'

// Export Stellar-specific types
export * from './types'

// Re-export core types for convenience
export {
  type AttestProtocolResponse,
  type Authority,
  type Schema,
  type Attestation,
  type SchemaDefinition,
  type AttestationDefinition,
  type RevocationDefinition,
  type IAttestProtocol,
  AttestProtocolErrorType,
  createSuccessResponse,
  createErrorResponse,
  createAttestProtocolError
} from '@attestprotocol/core'

// Re-export contract bindings for advanced usage
export { 
  Client as ProtocolClient,
  networks as ProtocolNetworks,
  type ResolverAttestationRecord,
  type StoredAttestation,
  type Schema as ProtocolSchema,
  type Authority as ProtocolAuthority,
  type AttestationRecord as ProtocolAttestationRecord,
} from '@attestprotocol/stellar/dist/bindings/src/protocol'

export {
  Client as AuthorityClient,
  networks as AuthorityNetworks,
  type AttestationRecord as AuthorityAttestationRecord,
  type RegisteredAuthorityData,
  type SchemaRules,
} from '@attestprotocol/stellar/dist/bindings/src/authority'

// Internal utilities (for advanced usage and testing)
export * as _internal from './_internal'

// Default export for convenience
import { StellarAttestProtocol } from './stellar-sdk'
export default StellarAttestProtocol