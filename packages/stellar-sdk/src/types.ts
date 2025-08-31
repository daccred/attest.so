/**
 * Stellar-specific types for the Attest Protocol SDK
 */

import { IProtocolConfig } from '@attestprotocol/core'

/**
 * Custom signer interface for Stellar transactions
 */
export interface StellarCustomSigner {
  signTransaction: (xdr: string) => Promise<{
    signedTxXdr: string
    signerAddress?: string
  }>
}

/**
 * Stellar-specific SDK configuration
 */
export interface StellarConfig extends IProtocolConfig {
  /**
   * Either a secret key string or a custom signer implementation
   */
  secretKeyOrCustomSigner: string | StellarCustomSigner
  
  /**
   * Public key address
   */
  publicKey: string
  
  /**
   * Network passphrase (defaults to TESTNET)
   */
  networkPassphrase?: string
  
  /**
   * Contract addresses for protocol and authority contracts
   */
  contractAddresses?: {
    protocol?: string
    authority?: string
  }
  
  /**
   * Whether to allow HTTP connections (for development)
   */
  allowHttp?: boolean
}

/**
 * Stellar-specific schema configuration
 */
export interface StellarSchemaConfig {
  name: string
  content: string
  resolverAddress?: string
  revocable?: boolean
}

/**
 * Stellar-specific attestation configuration
 */
export interface StellarAttestationConfig {
  schemaUID: string
  subject: string
  reference?: string
}

/**
 * Stellar attestation configuration with value field
 */
export interface StellarAttestationConfigWithValue extends StellarAttestationConfig {
  value: string
  reference: string
}

/**
 * Stellar authority fetch result
 */
export interface StellarFetchAuthorityResult {
  address: string
  metadata: string
}

/**
 * Stellar schema fetch result
 */
export interface StellarFetchSchemaResult {
  uid: string
  definition: string
  authority: string
  revocable: boolean
  resolver: string | null
}

/**
 * Stellar schema creation result
 */
export interface StellarCreateSchemaResult {
  schemaUID: string
  hash: string
}

/**
 * Stellar attestation fetch result
 */
export interface StellarFetchAttestationResult {
  schemaUid: string
  subject: string
  value: string
  reference: string | null
  revoked: boolean
}

/**
 * Stellar revocation configuration
 */
export interface StellarRevokeAttestationConfig {
  attestationUID: string
  recipient: string
  reference?: string | null
}

/**
 * Client configuration options for initializing the Stellar SDK
 */
export interface ClientOptions {
  /** Soroban RPC URL */
  rpcUrl: string
  /** Network type: 'testnet' | 'mainnet' | 'futurenet' */
  network?: 'testnet' | 'mainnet' | 'futurenet'
  /** Protocol contract ID */
  contractId?: string
  /** Network passphrase override */
  networkPassphrase?: string
  /** Allow HTTP connections (for local development) */
  allowHttp?: boolean
}

/**
 * Transaction options for contract interactions
 */
export interface TxOptions {
  /** Transaction fee in stroops */
  fee?: number
  /** Transaction timeout in seconds */
  timeoutInSeconds?: number
  /** Whether to simulate the transaction only */
  simulate?: boolean
}

/**
 * Options for submitting transactions
 */
export interface SubmitOptions extends TxOptions {
  /** Skip simulation before submission */
  skipSimulation?: boolean
}

/**
 * Delegated attestation request
 */
export interface DelegatedAttestationRequest {
  /** Schema UID (32 bytes) */
  schemaUid: Buffer
  /** Subject address */
  subject: string
  /** Attester address */
  attester: string
  /** Attestation value */
  value: string
  /** Nonce for uniqueness */
  nonce: bigint
  /** Deadline timestamp */
  deadline: bigint
  /** Optional expiration time */
  expirationTime?: number
  /** BLS signature */
  signature: Buffer
}

/**
 * Delegated revocation request
 */
export interface DelegatedRevocationRequest {
  /** Attestation UID to revoke */
  attestationUid: Buffer
  /** Revoker address */
  revoker: string
  /** Nonce for uniqueness */
  nonce: bigint
  /** Deadline timestamp */
  deadline: bigint
  /** BLS signature */
  signature: Buffer
}

/**
 * BLS key pair for delegation
 */
export interface BlsKeyPair {
  /** Public key (192 bytes uncompressed) */
  publicKey: Uint8Array,
  /** Private key (32 bytes) */
  privateKey: Uint8Array
}

/**
 * Result of signature verification
 */
export interface VerificationResult {
  /** Whether the signature is valid */
  isValid: boolean
  /** Metadata extracted from the signature */
  metadata?: {
    /** Original message that was signed */
    originalMessage: Buffer
    /** Parsed input parameters */
    inputs: Record<string, any>
  }
}

/**
 * Schema object from contract
 */
export interface ContractSchema {
  uid: Buffer
  definition: string
  authority: string
  resolver?: string
  revocable: boolean
  timestamp: number
}

/**
 * Attestation object from contract
 */
export interface ContractAttestation {
  uid: Buffer
  schemaUid: Buffer
  subject: string
  attester: string
  value: string
  timestamp: number
  expirationTime?: number
  revocationTime?: number
  revoked: boolean
}