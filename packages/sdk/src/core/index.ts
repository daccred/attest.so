import { AttestSDKBaseConfig, AttestSDKResponse } from './types'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import idl from './idl.json'

const authorityPair = [
  113, 7, 155, 214, 148, 126, 181, 107, 120, 44, 193, 72, 169, 185, 218, 216, 104, 3, 106, 237, 40,
  195, 35, 191, 40, 51, 61, 70, 37, 168, 34, 68, 182, 64, 112, 205, 55, 248, 241, 213, 45, 191, 199,
  3, 183, 58, 48, 133, 131, 2, 110, 253, 146, 222, 31, 123, 18, 73, 114, 55, 78, 185, 101, 68,
]

const authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(authorityPair))

export abstract class AttestSDKBase {
  private connection!: Connection
  private wallet!: anchor.Wallet
  private program!: any

  protected DEFAULT_RESOLVER = 'https://schema.attest.so/resolver'

  constructor(config: AttestSDKBaseConfig) {
    this.connection = new anchor.web3.Connection(
      config.url ?? 'https://api.devnet.solana.com',
      'confirmed'
    )

    const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(config.secretKey))

    this.wallet = new anchor.Wallet(walletKeypair)

    const provider = new anchor.AnchorProvider(this.connection, this.wallet, {
      commitment: 'confirmed',
    })

    anchor.setProvider(provider)

    this.program = new anchor.Program(idl as anchor.Idl) as any
  }

  protected async initialize(): Promise<string> {
    const tx = await this.program.methods.initialize().rpc()

    return tx
  }

  protected async registerSchema({
    schemaName,
    schemaContent,
    resolverAddress = null,
    revocable = true,
  }: {
    schemaName: string
    schemaContent: string
    resolverAddress?: PublicKey | null
    revocable?: boolean
  }): Promise<PublicKey> {
    const [schemaDataPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('schema'), authorityKeypair.publicKey.toBuffer(), Buffer.from(schemaName)],
      this.program.programId
    )

    const tx = await this.program.methods
      .register(schemaName, schemaContent, resolverAddress, revocable)
      .accounts({
        deployer: authorityKeypair.publicKey,
        // schemaData: schemaDataPDA,
        // systemProgram: SystemProgram.programId,
      })
      .signers([authorityKeypair]) // Deployer is the authority and signer
      .rpc()

    return schemaDataPDA
  }

  protected async fetchSchema(schemaUID: string): Promise<string> {
    const schemaAccount = await this.program.account.schemaData.fetch(schemaUID)

    return schemaAccount.schema
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

  protected async fetchAllSchemaUIDs(uids?: string[]): Promise<string[]> {
    // Implementation to fetch all schema UIDs
    return []
  }

  protected async fetchAllSchemaRecords(): Promise<string[]> {
    // Implementation to fetch all schema records
    return []
  }
}
