/**
 * Common types used across the Attest SDK
 */

import * as anchor from '@coral-xyz/anchor'

/**
 * AttestSDKResponse type definition.
 * @template T - The type of the data in the response.
 */
export type AttestSDKResponse<T = undefined> =
  | {
      data: T
      error?: undefined
    }
  | {
      data?: undefined
      error: any
    }

/**
 * Base configuration for any chain-specific SDK
 */
export interface ChainConfig {
  url?: string
}

/**
 * Solana-specific configuration
 */
export interface SolanaConfig extends ChainConfig {
  walletOrSecretKey: number[] | anchor.Wallet
  programId?: string
}

/**
 * Starknet-specific configuration
 */
export interface StarknetConfig extends ChainConfig {
  accountAddress: string
  privateKey: string
  contractAddress?: string
}

/**
 * Stellar-specific configuration
 */
export interface StellarConfig extends ChainConfig {
  secretKey: string
  networkPassphrase?: string
}

/**
 * Configuration for creating a levy
 */
export interface LevyConfig {
  amount: anchor.BN
  asset?: anchor.web3.PublicKey // Token mint address is required
  recipient?: anchor.web3.PublicKey
}

/**
 * Configuration for creating a schema
 */
export interface SchemaConfig {
  schemaName: string
  schemaContent: string
  resolverAddress?: anchor.web3.PublicKey | null
  revocable?: boolean
  levy?: LevyConfig | null
}

/**
 * Configuration for creating an attestation
 */
export interface AttestationConfig {
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

export interface SolanaFetchAuthorityResult {
  authority: anchor.web3.PublicKey
  isVerified: boolean
  firstDeployment: anchor.BN
}

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

export interface RevokeAttestationConfig {
  schemaUID: anchor.web3.PublicKey
  recipient: anchor.web3.PublicKey
}
