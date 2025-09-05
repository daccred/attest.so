/**
 * @attestprotocol/sdk
 *
 * Meta-package that provides unified access to all Attest Protocol blockchain implementations
 * This package exports all chain-specific SDKs and provides factory methods for easy initialization
 */

// Export all chain-specific SDKs
export { SolanaAttestProtocol } from '@attestprotocol/solana-sdk'
export { StarknetAttestProtocol } from '@attestprotocol/starknet-sdk'

// Export all chain-specific types
export * from '@attestprotocol/solana-sdk'
export * from '@attestprotocol/starknet-sdk'

// Export core types and interfaces
export * from '@attestprotocol/core'

// Import for factory methods
import { SolanaAttestProtocol, SolanaConfig } from '@attestprotocol/solana-sdk'
import { StarknetAttestProtocol, StarknetConfig } from '@attestprotocol/starknet-sdk'

/**
 * Factory class to create the appropriate AttestProtocol implementation based on configuration
 * Provides backward compatibility with the previous SDK interface
 */
export class AttestProtocol {
  /**
   * Initialize a Solana SDK instance
   * @param config Solana-specific configuration
   * @returns Promise resolving to initialized Solana SDK
   */
  static async initializeSolana(config: SolanaConfig): Promise<SolanaAttestProtocol> {
    const solanaClient = new SolanaAttestProtocol(config)

    const result = await solanaClient.initialize()
    if (result.error) {
      console.error('Solana SDK initialization failed:', result.error)
      throw result.error
    }

    return solanaClient
  }

  /**
   * Initialize a Starknet SDK instance
   * @param config Starknet-specific configuration
   * @returns Promise resolving to initialized Starknet SDK
   */
  static async initializeStarknet(config: StarknetConfig): Promise<StarknetAttestProtocol> {
    const starknetClient = new StarknetAttestProtocol(config)

    const result = await starknetClient.initialize()
    if (result.error) {
      console.error('Starknet SDK initialization failed:', result.error)
      throw result.error
    }

    return starknetClient
  }

  /**
   * Auto-detect and initialize the appropriate SDK based on configuration
   * @param config Configuration object with a 'chain' property indicating the target blockchain
   * @returns Promise resolving to initialized SDK
   */
  static async initialize(
    config: (SolanaConfig | StarknetConfig) & {
      chain: 'stellar' | 'solana' | 'starknet'
    }
  ) {
    switch (config.chain) {
      case 'solana':
        return this.initializeSolana(config as SolanaConfig)
      case 'starknet':
        return this.initializeStarknet(config as StarknetConfig)
      default:
        throw new Error(`Unsupported chain: ${(config as any).chain}. Supported chains: stellar, solana, starknet`)
    }
  }
}

// Export the factory as default for backward compatibility
export default AttestProtocol

/**
 * Utility type to help with chain detection
 */
export type ChainType = 'stellar' | 'solana' | 'starknet'

/**
 * Utility type for unified configuration
 */
export type UnifiedConfig = {
  chain: ChainType
} & (SolanaConfig | StarknetConfig)

/**
 * Helper function to create a unified configuration
 */
export function createConfig<T extends ChainType>(
  chain: T,
  config: T extends 'solana' ? SolanaConfig : StarknetConfig
): UnifiedConfig {
  return { chain, ...config } as UnifiedConfig
}

/**
 * Version information
 */
export const SDK_VERSION = '1.7.3'
export const SUPPORTED_CHAINS = ['stellar', 'solana', 'starknet'] as const
