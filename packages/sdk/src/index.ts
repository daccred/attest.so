import { SolanaConfig, StarknetConfig, StellarConfig } from './core/types'
// import { StellarAttestSDK } from './core/stellar'
import { SolanaAttestSDK } from './core/solana'
import { StellarAttestSDK } from './core/stellar'
// import { StarknetAttestSDK } from './core/starknet'


export * from './core/types'
export * from './core/stellar'
export * from './core/solana'

// export * from './core/starknet'

/**
 * Factory function to create the appropriate AttestSDKBase implementation
 * based on the provided configuration
 */
export default class AttestSDK {
  static async initializeStellar(config: StellarConfig): Promise<StellarAttestSDK> {
    const stellarClient = new StellarAttestSDK(config)
    // Initialize will return an AttestSDKResponse<void>
    await stellarClient.initialize()
    return stellarClient
  }
  static async initializeSolana(config: SolanaConfig): Promise<SolanaAttestSDK> {
    const solanaClient = new SolanaAttestSDK(config)
    await solanaClient.initialize()
    return solanaClient
  }
  // static async initializeStarknet(config: StarknetConfig): Promise<StarknetAttestSDK> {
  //   const starknetClient = new StarknetAttestSDK(config)
  //   await starknetClient.initialize()
  //   return starknetClient
  // }
}