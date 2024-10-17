import { AttestSDKBaseConfig, AttestSDKResponse, SchemaRecord, WalletNetwork } from './types'
import { Connection } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import {
  HELIUS_DEVNET_URL,
  HELIUS_MAINNET_URL,
  SOLANA_DEVNET_URL,
  SOLANA_MAINNET_URL,
  SOLANA_TESTNET_URL,
} from './constants'

export abstract class AttestSDKBase<T extends anchor.Idl> {
  protected connection: Connection
  protected wallet: anchor.Wallet
  protected program: anchor.Program<T>

  protected DEFAULT_RESOLVER = 'https://schema.attest.so/resolver'

  private heliusAPIKey: string
  private heliusUrl: string

  constructor(config: AttestSDKBaseConfig) {
    this.connection = new anchor.web3.Connection(
      config.url ?? config.network === WalletNetwork.MAINNET
        ? SOLANA_MAINNET_URL
        : config.network === WalletNetwork.DEVNET
        ? SOLANA_DEVNET_URL
        : SOLANA_TESTNET_URL,
      'confirmed'
    )

    this.wallet = config.wallet

    const provider = new anchor.AnchorProvider(this.connection, this.wallet, {
      commitment: 'confirmed',
    })

    anchor.setProvider(provider)

    this.program = new anchor.Program(config.idl as anchor.Idl) as any as anchor.Program<T>

    this.heliusAPIKey = config.heliusAPIKey ?? 'helius-api-key'

    this.heliusUrl =
      config.network === WalletNetwork.MAINNET ? HELIUS_MAINNET_URL : HELIUS_DEVNET_URL
  }

  protected async generateUID(): Promise<string> {
    // Implementation to generate UID
    return 'magic-uid' + Math.random().toString(36).substring(2, 15)
  }

  protected async storeSchema(schema: string): Promise<string> {
    // Implementation to store schema
    return this.generateUID()
  }

  protected async validateSchema(schema: string): Promise<boolean> {
    // Implementation to verify schema
    return true
  }

  protected async verifySchema(schemaUID: string): Promise<string | null> {
    // Implementation to verify schema
    return 'schema'
  }

  protected async createAttestation(
    schemaUID: string,
    data: any,
    resolver?: string
  ): Promise<string | null> {
    // trigger resolver

    const response = await this.triggerResolver(resolver || this.DEFAULT_RESOLVER, data)

    return this.generateUID()
  }

  protected async triggerResolver(resolver: string, data: any): Promise<string> {
    // trigger resolver

    return 'response'
  }

  protected async storeAttestation(attestation: string): Promise<string> {
    // Implementation to store attestation
    return this.generateUID()
  }

  protected async verifyAttestationUID(uid: string): Promise<boolean> {
    // Implementation to verify attestation UID
    return true
  }

  protected async verifyAttestationIsRevocable(uid: string): Promise<AttestSDKResponse<string>> {
    // Implementation to verify attestation revocable

    const valid = await this.verifyAttestationUID(uid)

    if (!valid) {
      return {
        error: 'Invalid attestation',
      }
    }

    return {
      data: 'revocable',
    }
  }

  protected async updateAttestationStatus(uid: string, status: string): Promise<boolean> {
    return true
  }

  protected async performDelegation(id: string, delegateTo: string): Promise<boolean> {
    // Implementation to perform attestation delegation
    return true
  }

  protected async fetchAttestation(uid: string): Promise<any | null> {
    // Implementation to fetch attestation data
    return null
  }

  protected async fetchAllAttestations(schemaUID: string): Promise<string[]> {
    // Implementation to fetch all attestations
    return []
  }

  protected async verifyAttestationValidity(id: string): Promise<boolean> {
    // Implementation to verify attestation validity
    return true
  }

  protected async fetchAttestationTimestamp(attestationUID: string): Promise<number> {
    // Implementation to fetch current timestamp
    return Date.now()
  }

  protected async fetchAttestationCount(uid: string): Promise<number> {
    // Implementation to fetch total number of attestations
    return 0
  }

  protected async fetchAllSchemaForWallet(): Promise<AttestSDKResponse<SchemaRecord[]>> {
    const url = `${
      this.heliusUrl
    }/addresses/${this.wallet.publicKey.toBase58()}/transactions?api-key=${
      this.heliusAPIKey
    }&type=UNKNOWN`

    const response = await fetch(url)
    if (response.ok) {
      const res = await response.json()

      const data = res.map((x: any) => {
        return {
          slot: x.slot,
          timestamp: x.timestamp,
          signature: x.signature,
          fee: x.fee,
          feePayer: x.feePayer,
          type: x.type,
          source: x.source,
          description: x.description,
          schemaAccount: x.nativeTransfers[0].toUserAccount,
        }
      })

      return { data }
    }

    return {
      error: response.statusText,
    }
  }

  protected async fetchAllSchemaRecords(): Promise<AttestSDKResponse<SchemaRecord[]>> {
    const url = `${
      this.heliusUrl
    }/addresses/${this.program.programId.toBase58()}/transactions?api-key=${
      this.heliusAPIKey
    }&type=UNKNOWN`

    const response = await fetch(url)
    if (response.ok) {
      const res = await response.json()

      const data = res.map((x: any) => {
        return {
          slot: x.slot,
          timestamp: x.timestamp,
          signature: x.signature,
          fee: x.fee,
          feePayer: x.feePayer,
          type: x.type,
          source: x.source,
          description: x.description,
          schemaAccount: x.nativeTransfers[0].toUserAccount,
        }
      })

      return { data }
    }

    return {
      error: response.statusText,
    }
  }
}
