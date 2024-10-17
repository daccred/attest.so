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

export enum WalletNetwork {
  MAINNET,
  TESTNET,
  DEVNET,
}

/**
 * AttestSDKBaseConfig type definition.
 */
export type AttestSDKBaseConfig = {
  network?: WalletNetwork
  secretKey?: number[]
  url?: string
  idl: anchor.Idl
  wallet: anchor.Wallet
  heliusAPIKey?: string
}

export type SchemaRecord = {
  slot: number
  timestamp: number
  signature: string
  fee: number
  feePayer: string
  type: string
  source: string
  description: string
  schemaAccount: string
}
