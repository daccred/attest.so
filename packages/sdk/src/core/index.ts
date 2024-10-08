import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { AttestSDKBaseConfig } from './types'
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
    return 'magic-schema-uid'
  }

  protected async storeSchema(schema: string): Promise<string> {
    // Implementation to store schema
    return 'magic-schema-uid'
  }

  protected async verifySchema(schema: string): Promise<boolean> {
    // Implementation to verify schema
    return true
  }

  protected async storeAttestation(attestation: string): Promise<string> {
    // Implementation to store attestation
    return 'magic-attestation-uid'
  }

  protected async verifyAttestationUID(uid: string): Promise<boolean> {
    // Implementation to verify attestation UID
    return true
  }

  protected async verifyAttestationIsRevocable(uid: string): Promise<boolean> {
    // Implementation to verify attestation revocable
    return true
  }

  protected async updateAttestationStatus(uid: string, status: string): Promise<boolean> {
    return true
  }

  protected async performDelegation(id: string, delegateTo: string): Promise<boolean> {
    // Implementation to perform attestation delegation
    return true
  }

  protected async fetchAttestation(id: string): Promise<string | null> {
    // Implementation to fetch attestation data
    return null
  }

  protected async fetchAllAttestations(): Promise<string[]> {
    // Implementation to fetch all attestations
    return []
  }

  protected async verifyAttestationValidity(id: string): Promise<boolean> {
    // Implementation to verify attestation validity
    return true
  }

  protected async fetchCurrentTimestamp(): Promise<number> {
    // Implementation to fetch current timestamp
    return Date.now()
  }

  protected async fetchAttestationCount(): Promise<number> {
    // Implementation to fetch total number of attestations
    return 0
  }

  protected async fetchAllSchemaUIDs(): Promise<string[]> {
    // Implementation to fetch all schema UIDs
    return []
  }

  protected async fetchAllSchemaRecords(): Promise<string[]> {
    // Implementation to fetch all schema records
    return []
  }
}
