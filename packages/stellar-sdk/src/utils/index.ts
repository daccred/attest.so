/**
 * Utility functions for the Stellar Attest Protocol SDK
 * 
 * This module exports all utility functions organized by category.
 */

// UID Generation utilities
export {
  generateAttestationUid,
  generateSchemaUid,
  formatUid,
  parseFormattedUid
} from './uid-generator'

// Schema encoding/decoding utilities
export {
  encodeSchema,
  decodeSchema,
  validateSchema,
  createSimpleSchema
} from './schema-codec'

// Delegation utilities
export {
  createAttestMessage,
  createRevokeMessage,
  getAttestDST,
  getRevokeDST,
  createDelegatedAttestationRequest,
  createDelegatedRevocationRequest
} from './delegation'

// BLS cryptography utilities
export {
  generateBlsKeys,
  signMessage,
  verifySignature,
  aggregateSignatures,
  aggregatePublicKeys,
  verifyAggregateSignature,
  decompressPublicKey,
  compressPublicKey
} from './bls'

// Horizon integration utilities
export {
  fetchAttestationsByLedger,
  fetchSchemasByLedger,
  fetchAttestationsByWallet,
  fetchSchemasByWallet,
  fetchLatestAttestations,
  fetchLatestSchemas,
  fetchRegistryDump,
  HORIZON_CONFIGS,
  REGISTRY_ENDPOINTS,
  type HorizonConfig,
  type RegistryDump
} from './horizon'