import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { AttestSDKBase } from './base'
import {
  SolanaConfig,
  AttestSDKResponse,
  SchemaConfig,
  AttestationConfig,
  SolanaFetchAuthorityResult,
  SolanaFetchSchemaResult,
  SolanaFetchAttestationResult,
  SolanaRevokeAttestationConfig,
} from './types'

import * as anchor from '@coral-xyz/anchor'
import idl from './idl.json'

/**
 * Solana implementation of the Attest SDK
 */
export class SolanaAttestSDK extends AttestSDKBase {
  private connection: Connection
  private wallet: anchor.Wallet
  private program: anchor.Program
  private programId: PublicKey

  constructor(config: SolanaConfig) {
    super()

    this.connection = new anchor.web3.Connection(
      config.url ?? 'https://api.devnet.solana.com',
      'confirmed'
    )

    if (Array.isArray(config.walletOrSecretKey)) {
      const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(config.walletOrSecretKey))
      this.wallet = new anchor.Wallet(walletKeypair)
      this.wallet
    } else {
      this.wallet = config.walletOrSecretKey
    }

    const provider = new anchor.AnchorProvider(this.connection, this.wallet, {
      commitment: 'confirmed',
    })
    anchor.setProvider(provider)

    this.programId = config.programId ? new PublicKey(config.programId) : new PublicKey(idl.address)

    this.program = new anchor.Program(idl as anchor.Idl) as anchor.Program<anchor.Idl>
  }

  /**
   * Initialize the SDK (if needed)
   * @returns Transaction signature
   */
  async initialize() {}

  private async _signTransaction(tx: Transaction): Promise<anchor.web3.TransactionSignature> {
    const latestBlockhash = await this.connection.getLatestBlockhash()

    tx.recentBlockhash = latestBlockhash.blockhash
    tx.feePayer = this.wallet.publicKey

    const signedTx = await this.wallet.signTransaction(tx)

    const serializedTx = signedTx.serialize()

    const txSignature = await this.connection.sendRawTransaction(serializedTx)

    await this.connection.confirmTransaction(txSignature)

    return txSignature
  }

  async fetchAuthority(): Promise<AttestSDKResponse<SolanaFetchAuthorityResult>> {
    try {
      const [authorityRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('authority'), this.wallet.publicKey.toBuffer()],
        this.programId
      )
      const authorityAccount = await (this.program.account as any).authorityRecord.fetch(
        authorityRecordPDA
      )

      return { data: authorityAccount }
    } catch (err) {
      return { error: err }
    }
  }

  async registerAuthority(): Promise<AttestSDKResponse<anchor.web3.PublicKey>> {
    try {
      const { data: authorityAccount } = await this.fetchAuthority()

      if (authorityAccount) {
        return { data: authorityAccount.authority }
      }

      const [authorityRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('authority'), this.wallet.publicKey.toBuffer()],
        this.programId
      )

      const tx = await this.program.methods
        .registerAuthority()
        .accounts({
          authority: this.wallet.publicKey,
        })
        .transaction()

      await this._signTransaction(tx)

      return { data: authorityRecordPDA }
    } catch (err) {
      return { error: err }
    }
  }

  async fetchSchema(
    schemaUID: anchor.web3.PublicKey
  ): Promise<AttestSDKResponse<SolanaFetchSchemaResult | null>> {
    try {
      return await (this.program.account as any).schemaData.fetch(schemaUID)
    } catch (err) {
      return { error: err }
    }
  }

  async createSchema(config: SchemaConfig): Promise<AttestSDKResponse<anchor.web3.PublicKey>> {
    try {
      // Find the authority record PDA
      const [authorityRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('authority'), this.wallet.publicKey.toBuffer()],
        this.programId
      )

      // Find the schema data PDA
      const [schemaDataPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('schema'), this.wallet.publicKey.toBuffer(), Buffer.from(config.schemaName)],
        this.programId
      )

      const tx = await this.program.methods
        .createSchema(
          config.schemaName,
          config.schemaContent,
          config.resolverAddress,
          config.revocable ?? true,
          config.levy
        )
        .accounts({
          deployer: this.wallet.publicKey,
          authorityRecord: authorityRecordPDA,
        })
        .transaction()

      await this._signTransaction(tx)

      return { data: schemaDataPDA }
    } catch (err) {
      return { error: err }
    }
  }

  async fetchAttestation(
    attestation: anchor.web3.PublicKey | string
  ): Promise<AttestSDKResponse<SolanaFetchAttestationResult | null>> {
    try {
      return await (this.program.account as any).attestation.fetch(attestation)
    } catch (err) {
      return { error: err }
    }
  }

  async attest(config: AttestationConfig): Promise<AttestSDKResponse<anchor.web3.PublicKey>> {
    try {
      // Find the schema data account to get levy information
      // const { data: schemaData } = await this.fetchSchema(config.schemaData)

      // if (!schemaData) {
      //   return { error: 'Could not retrieve schema' }
      // }

      // Find the attestation PDA
      const [attestationPDA] =  PublicKey.findProgramAddressSync(
        [
          Buffer.from('attestation'),
          config.schemaData.toBuffer(),
          config.accounts.recipient.toBuffer(),
          this.wallet.publicKey.toBuffer(),
        ],
        this.programId
      )
      // Setup accounts
      const accounts: any = {
        attester: this.wallet.publicKey,
        schemaData: config.schemaData,
        ...config.accounts,
      }

      const tx = await this.program.methods
        .attest(
          config.data,
          config.refUID,
          config.expirationTime ? new anchor.BN(config.expirationTime) : null,
          config.revocable ?? true
        )
        .accounts(accounts)
        .transaction()

      await this._signTransaction(tx)

      return { data: attestationPDA }
    } catch (err) {
      return { error: err }
    }
  }

  async revokeAttestation(
    props: SolanaRevokeAttestationConfig
  ): Promise<AttestSDKResponse<anchor.web3.PublicKey>> {
    try {
      const { schemaUID, recipient } = props

      const [attestationPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('attestation'),
          schemaUID.toBuffer(),
          recipient.toBuffer(),
          this.wallet.publicKey.toBuffer(),
        ],
        this.programId
      )

      const { data: attestationBefore } = await this.fetchAttestation(attestationPDA)

      if (!attestationBefore || attestationBefore.revocationTime) {
        return { error: "Attestation doesn't exist or has already been revoked" }
      }

      // Revoke the attestation
      const tx = await this.program.methods
        .revokeAttestation(schemaUID, recipient)
        .accounts({
          attester: this.wallet.publicKey,
          attestation: attestationPDA,
        })
        .transaction()

      await this._signTransaction(tx)
      console.log('Attestation revoked successfully')

      const { data: attestationAfter } = await this.fetchAttestation(attestationPDA)

      if (!attestationAfter || !attestationAfter.revocationTime) {
        return { error: 'Attestation could not be revoked' }
      }

      return { data: attestationPDA }
    } catch (error: any) {
      console.error(error)

      if ((error.message as string).includes('AlreadyRevoked')) {
        return { error: 'Attestation is already revoked' }
      }

      return { error: error.message }
    }
  }
}
