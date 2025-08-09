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