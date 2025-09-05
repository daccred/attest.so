/**
 * @attestprotocol/solana-sdk
 *
 * Solana implementation of the Attest Protocol SDK
 */

// Export the main SDK class
export { SolanaAttestProtocol } from './solana-sdk'

// Export Solana-specific types
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
  createAttestProtocolError,
} from '@attestprotocol/core'

// Default export for convenience
import { SolanaAttestProtocol } from './solana-sdk'
export default SolanaAttestProtocol
