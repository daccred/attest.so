/**
 * Starknet-specific types for the Attest Protocol SDK
 */

import { IProtocolConfig } from '@attestprotocol/core'

/**
 * Starknet-specific SDK configuration
 */
export interface StarknetConfig extends IProtocolConfig {
  /**
   * Account address on Starknet
   */
  accountAddress: string

  /**
   * Private key for signing transactions
   */
  privateKey: string

  /**
   * Contract address for the attestation protocol
   */
  contractAddress?: string

  /**
   * Provider URL (defaults to Goerli testnet)
   */
  url?: string

  /**
   * Network configuration
   */
  network?: 'mainnet-alpha' | 'goerli-alpha' | 'sepolia-alpha'
}

/**
 * Starknet-specific schema configuration
 */
export interface StarknetSchemaConfig {
  name: string
  content: string
  resolverAddress?: string
  revocable?: boolean
}

/**
 * Starknet-specific attestation configuration
 */
export interface StarknetAttestationConfig {
  schemaUid: string
  subject: string
  data: string
  reference?: string
  expirationTime?: number
}

/**
 * Starknet-specific revocation configuration
 */
export interface StarknetRevokeAttestationConfig {
  attestationUid: string
  reference?: string
}

/**
 * Starknet authority fetch result
 */
export interface StarknetFetchAuthorityResult {
  address: string
  isVerified: boolean
  metadata?: string
  registrationTime?: number
}

/**
 * Starknet schema fetch result
 */
export interface StarknetFetchSchemaResult {
  uid: string
  definition: string
  authority: string
  revocable: boolean
  resolver?: string
  creationTime: number
}

/**
 * Starknet attestation fetch result
 */
export interface StarknetFetchAttestationResult {
  uid: string
  schemaUid: string
  subject: string
  attester: string
  data: string
  timestamp: number
  expirationTime?: number
  revocationTime?: number
  revoked: boolean
  reference?: string
}

/**
 * Starknet delegation configuration for attestations
 */
export interface StarknetDelegatedAttestationConfig extends StarknetAttestationConfig {
  delegator: string
  signature: string[]
  nonce: string
}

/**
 * Starknet delegation configuration for revocations
 */
export interface StarknetDelegatedRevocationConfig extends StarknetRevokeAttestationConfig {
  delegator: string
  signature: string[]
  nonce: string
}
