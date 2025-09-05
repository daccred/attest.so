/**
 * Solana-specific types for the Attest Protocol SDK
 */

import { IProtocolConfig } from '@attestprotocol/core'
import * as anchor from '@coral-xyz/anchor'

/**
 * Solana-specific SDK configuration
 */
export interface SolanaConfig extends IProtocolConfig {
  /**
   * Wallet instance or secret key array for signing transactions
   */
  walletOrSecretKey: number[] | anchor.Wallet

  /**
   * Program ID for the attestation contract
   */
  programId?: string

  /**
   * Solana cluster URL (defaults to devnet)
   */
  url?: string
}

/**
 * Configuration for creating a levy on Solana
 */
export interface SolanaLevyConfig {
  amount: anchor.BN
  asset?: anchor.web3.PublicKey // Token mint address
  recipient?: anchor.web3.PublicKey
}

/**
 * Solana-specific schema configuration
 */
export interface SolanaSchemaConfig {
  schemaName: string
  schemaContent: string
  resolverAddress?: anchor.web3.PublicKey | null
  revocable?: boolean
  levy?: SolanaLevyConfig | null
}

/**
 * Solana-specific attestation configuration
 */
export interface SolanaAttestationConfig {
  schemaData: anchor.web3.PublicKey
  data: string
  refUID?: anchor.web3.PublicKey | null
  expirationTime?: number | null
  revocable?: boolean
  accounts: {
    recipient: anchor.web3.PublicKey
    levyReceipent: anchor.web3.PublicKey
    mintAccount: anchor.web3.PublicKey
  }
}

/**
 * Solana-specific revocation configuration
 */
export interface SolanaRevokeAttestationConfig {
  attestationUID: anchor.web3.PublicKey
  recipient: anchor.web3.PublicKey
  reference?: string | null
}

/**
 * Solana authority fetch result
 */
export interface SolanaFetchAuthorityResult {
  authority: anchor.web3.PublicKey
  isVerified: boolean
  firstDeployment: anchor.BN
}

/**
 * Solana schema fetch result
 */
export interface SolanaFetchSchemaResult {
  uid: anchor.web3.PublicKey
  schema: string
  resolver?: anchor.web3.PublicKey
  revocable: boolean
  deployer: anchor.web3.PublicKey
  levy?: {
    amount: anchor.BN
    asset: anchor.web3.PublicKey
    recipient: anchor.web3.PublicKey
  }
}

/**
 * Solana attestation fetch result
 */
export interface SolanaFetchAttestationResult {
  schema: anchor.web3.PublicKey
  recipient: anchor.web3.PublicKey
  attester: anchor.web3.PublicKey
  data: string
  time: anchor.BN
  refUid: anchor.web3.PublicKey
  expirationTime: anchor.BN
  revocationTime: anchor.BN
  revocable: boolean
  uid: anchor.web3.PublicKey
}

/**
 * Solana delegation configuration for attestations
 */
export interface SolanaDelegatedAttestationConfig extends SolanaAttestationConfig {
  delegator: anchor.web3.PublicKey
  signature: Uint8Array
  nonce: anchor.BN
}

/**
 * Solana delegation configuration for revocations
 */
export interface SolanaDelegatedRevocationConfig extends SolanaRevokeAttestationConfig {
  delegator: anchor.web3.PublicKey
  signature: Uint8Array
  nonce: anchor.BN
}
