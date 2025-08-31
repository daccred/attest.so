/**
 * @attestprotocol/starknet-sdk
 *
 * Starknet implementation of the Attest Protocol SDK
 */

// Export the main SDK class
export { StarknetAttestProtocol } from './starknet-sdk'

// Export Starknet-specific types
export {
  StarknetConfig,
  StarknetSchemaConfig,
  StarknetAttestationConfig,
  StarknetDelegatedAttestationConfig,
  StarknetDelegatedRevocationConfig,
  StarknetFetchAuthorityResult,
} from './types'

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
  createAttestProtocolError,
} from '@attestprotocol/core'

// Default export for convenience
import { StarknetAttestProtocol } from './starknet-sdk'
export default StarknetAttestProtocol
