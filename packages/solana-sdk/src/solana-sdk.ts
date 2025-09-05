/**
 * Solana implementation of the Attest Protocol SDK
 */

import {
  AttestProtocolBase,
  AttestProtocolResponse,
  Authority,
  Schema,
  Attestation,
  SchemaDefinition,
  AttestationDefinition,
  RevocationDefinition,
  DelegatedAttestationDefinition,
  DelegatedRevocationDefinition,
  ListAttestationsByWalletParams,
  ListAttestationsBySchemaParams,
  ListSchemasByIssuerParams,
  PaginatedResponse,
  AttestProtocolErrorType,
  createSuccessResponse,
  createErrorResponse,
  createAttestProtocolError,
} from '@attestprotocol/core'

import type {
  SolanaConfig,
  SolanaLevyConfig,
  SolanaSchemaConfig,
  SolanaAttestationConfig,
  SolanaRevokeAttestationConfig,
  SolanaFetchAuthorityResult,
  SolanaFetchSchemaResult,
  SolanaFetchAttestationResult,
  SolanaDelegatedAttestationConfig,
  SolanaDelegatedRevocationConfig,
} from './types'

export type {
  SolanaConfig,
  SolanaLevyConfig,
  SolanaSchemaConfig,
  SolanaAttestationConfig,
  SolanaRevokeAttestationConfig,
}

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'

// Default program ID - should be updated when contracts are deployed
const DEFAULT_PROGRAM_ID = 'AttestzZ8SYGczFJuM5YZCjWKd8LbLZm6yG3nQdQFFjy'

/**
 * Solana implementation of the Attest SDK
 */
export class SolanaAttestProtocol extends AttestProtocolBase {
  private connection: Connection
  private wallet: anchor.Wallet
  private program: anchor.Program | null = null
  private programId: PublicKey

  constructor(config: SolanaConfig) {
    super(config)

    this.connection = new anchor.web3.Connection(config.url ?? 'https://api.devnet.solana.com', 'confirmed')

    if (Array.isArray(config.walletOrSecretKey)) {
      const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(config.walletOrSecretKey))
      this.wallet = new anchor.Wallet(walletKeypair)
    } else {
      this.wallet = config.walletOrSecretKey
    }

    this.programId = config.programId ? new PublicKey(config.programId) : new PublicKey(DEFAULT_PROGRAM_ID)
  }

  protected getDefaultNetworkUrl(): string {
    return 'https://api.devnet.solana.com'
  }

  /**
   * Initialize the SDK by setting up the Anchor provider and program
   */
  async initialize(): Promise<AttestProtocolResponse<void>> {
    return this.safeExecute(async () => {
      const provider = new anchor.AnchorProvider(this.connection, this.wallet, {
        commitment: 'confirmed',
      })
      anchor.setProvider(provider)

      try {
        // Load the IDL - in a real implementation, this would be the actual IDL
        const idl = await anchor.Program.fetchIdl(this.programId, provider)
        if (!idl) {
          throw new Error('Could not fetch program IDL')
        }

        this.program = new anchor.Program(idl, provider)
      } catch (error) {
        // Fallback to a minimal program interface for development
        console.warn('Could not load full program IDL, using minimal interface')
      }

      this.initialized = true
    })
  }

  // Authority Management

  async registerAuthority(): Promise<AttestProtocolResponse<string>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      const [authorityRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('authority'), this.wallet.publicKey.toBuffer()],
        this.programId
      )

      // Check if authority already exists
      try {
        if (this.program) {
          await (this.program.account as any).authorityRecord.fetch(authorityRecordPDA)
          return this.wallet.publicKey.toBase58() // Already registered
        }
      } catch (error) {
        // Authority doesn't exist, proceed with registration
      }

      if (this.program) {
        const tx = await this.program.methods
          .registerAuthority()
          .accounts({
            authority: this.wallet.publicKey,
            authorityRecord: authorityRecordPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .transaction()

        await this._signTransaction(tx)
      }

      return this.wallet.publicKey.toBase58()
    })
  }

  async fetchAuthority(id: string): Promise<AttestProtocolResponse<Authority | null>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      const authorityKey = new PublicKey(id)
      const [authorityRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('authority'), authorityKey.toBuffer()],
        this.programId
      )

      try {
        if (this.program) {
          const authorityAccount = await (this.program.account as any).authorityRecord.fetch(authorityRecordPDA)

          return {
            id: authorityAccount.authority.toBase58(),
            isVerified: authorityAccount.isVerified,
            deploymentTime: authorityAccount.firstDeployment?.toNumber() || Date.now(),
          }
        }
      } catch (error) {
        // Authority not found
      }

      return null
    })
  }

  async isIssuerAnAuthority(issuer: string): Promise<AttestProtocolResponse<boolean>> {
    const result = await this.fetchAuthority(issuer)
    if (result.error) return createErrorResponse(result.error)
    return createSuccessResponse(result.data !== null)
  }

  // Schema Management

  async createSchema(config: SchemaDefinition): Promise<AttestProtocolResponse<Schema>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    const validationError = this.validateSchemaDefinition(config)
    if (validationError) return createErrorResponse(validationError)

    return this.safeExecute(async () => {
      const [authorityRecordPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('authority'), this.wallet.publicKey.toBuffer()],
        this.programId
      )

      const [schemaDataPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('schema'), this.wallet.publicKey.toBuffer(), Buffer.from(config.name)],
        this.programId
      )

      if (this.program) {
        const resolverKey = config.resolver ? new PublicKey(config.resolver) : null

        const tx = await this.program.methods
          .createSchema(config.content, resolverKey, config.revocable ?? true)
          .accounts({
            deployer: this.wallet.publicKey,
            authorityRecord: authorityRecordPDA,
            schemaData: schemaDataPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .transaction()

        await this._signTransaction(tx)
      }

      return {
        uid: schemaDataPDA.toBase58(),
        definition: config.content,
        authority: this.wallet.publicKey.toBase58(),
        revocable: config.revocable ?? true,
        resolver: config.resolver || null,
      }
    })
  }

  async fetchSchemaById(id: string): Promise<AttestProtocolResponse<Schema | null>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      const schemaKey = new PublicKey(id)

      try {
        if (this.program) {
          const schemaAccount = await (this.program.account as any).schemaData.fetch(schemaKey)

          return {
            uid: id,
            definition: schemaAccount.schema,
            authority: schemaAccount.deployer.toBase58(),
            revocable: schemaAccount.revocable,
            resolver: schemaAccount.resolver?.toBase58() || null,
            levy: schemaAccount.levy
              ? {
                  amount: schemaAccount.levy.amount.toString(),
                  asset: schemaAccount.levy.asset.toBase58(),
                  recipient: schemaAccount.levy.recipient.toBase58(),
                }
              : null,
          }
        }
      } catch (error) {
        // Schema not found
      }

      return null
    })
  }

  async generateIdFromSchema(schema: SchemaDefinition): Promise<AttestProtocolResponse<string>> {
    return this.safeExecute(async () => {
      const [schemaDataPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('schema'), this.wallet.publicKey.toBuffer(), Buffer.from(schema.name)],
        this.programId
      )
      return schemaDataPDA.toBase58()
    })
  }

  async listSchemasByIssuer(
    params: ListSchemasByIssuerParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Schema>>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // This would require indexing or filtering all schema accounts
      // For now, return empty results
      return this.createPaginatedResponse([], 0, params.limit ?? 10, params.offset ?? 0)
    })
  }

  // Attestation Management

  async issueAttestation(config: AttestationDefinition): Promise<AttestProtocolResponse<Attestation>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    const validationError = this.validateAttestationDefinition(config)
    if (validationError) return createErrorResponse(validationError)

    return this.safeExecute(async () => {
      const schemaKey = new PublicKey(config.schemaUid)
      const recipientKey = new PublicKey(config.subject)

      const [attestationDataPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('attestation'), schemaKey.toBuffer(), recipientKey.toBuffer(), this.wallet.publicKey.toBuffer()],
        this.programId
      )

      if (this.program) {
        const refUid = config.reference ? new PublicKey(config.reference) : null
        const expirationTime = config.expirationTime ? new anchor.BN(config.expirationTime) : null

        const tx = await this.program.methods
          .attest(config.data, refUid, expirationTime, config.revocable ?? true)
          .accounts({
            attester: this.wallet.publicKey,
            schemaData: schemaKey,
            recipient: recipientKey,
            attestationData: attestationDataPDA,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .transaction()

        await this._signTransaction(tx)
      }

      const timestamp = Date.now()

      return {
        uid: attestationDataPDA.toBase58(),
        schemaUid: config.schemaUid,
        subject: config.subject,
        attester: this.wallet.publicKey.toBase58(),
        data: config.data,
        timestamp,
        expirationTime: config.expirationTime || null,
        revocationTime: null,
        revoked: false,
        reference: config.reference || null,
      }
    })
  }

  async fetchAttestationById(id: string): Promise<AttestProtocolResponse<Attestation | null>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      const attestationKey = new PublicKey(id)

      try {
        if (this.program) {
          const attestationAccount = await (this.program.account as any).attestationData.fetch(attestationKey)

          return {
            uid: id,
            schemaUid: attestationAccount.schema.toBase58(),
            subject: attestationAccount.recipient.toBase58(),
            attester: attestationAccount.attester.toBase58(),
            data: attestationAccount.data,
            timestamp: attestationAccount.time.toNumber(),
            expirationTime: attestationAccount.expirationTime?.toNumber() || null,
            revocationTime: attestationAccount.revocationTime?.toNumber() || null,
            revoked: attestationAccount.revocationTime && attestationAccount.revocationTime.toNumber() > 0,
            reference: attestationAccount.refUid?.toBase58() || null,
          }
        }
      } catch (error) {
        // Attestation not found
      }

      return null
    })
  }

  async listAttestationsByWallet(
    params: ListAttestationsByWalletParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // This would require indexing or filtering all attestation accounts
      // For now, return empty results
      return this.createPaginatedResponse([], 0, params.limit ?? 10, params.offset ?? 0)
    })
  }

  async listAttestationsBySchema(
    params: ListAttestationsBySchemaParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // This would require indexing or filtering all attestation accounts
      // For now, return empty results
      return this.createPaginatedResponse([], 0, params.limit ?? 10, params.offset ?? 0)
    })
  }

  async revokeAttestation(config: RevocationDefinition): Promise<AttestProtocolResponse<void>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    const validationError = this.validateRevocationDefinition(config)
    if (validationError) return createErrorResponse(validationError)

    return this.safeExecute(async () => {
      const attestationKey = new PublicKey(config.attestationUid)

      if (this.program) {
        const tx = await this.program.methods
          .revokeAttestation()
          .accounts({
            attester: this.wallet.publicKey,
            attestationData: attestationKey,
          })
          .transaction()

        await this._signTransaction(tx)
      }
    })
  }

  // Delegation

  async attestByDelegation(config: DelegatedAttestationDefinition): Promise<AttestProtocolResponse<Attestation>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // Implementation would depend on delegation logic in Solana contracts
      // This is a placeholder that would need actual delegation signature verification
      throw createAttestProtocolError(AttestProtocolErrorType.NOT_FOUND_ERROR, 'Delegation not fully implemented')
    })
  }

  async revokeByDelegation(config: DelegatedRevocationDefinition): Promise<AttestProtocolResponse<void>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // Implementation would depend on delegation logic in Solana contracts
      throw createAttestProtocolError(AttestProtocolErrorType.NOT_FOUND_ERROR, 'Delegation not fully implemented')
    })
  }

  // Solana-specific helper methods

  private async _signTransaction(tx: Transaction): Promise<anchor.web3.TransactionSignature> {
    const latestBlockhash = await this.connection.getLatestBlockhash()

    tx.recentBlockhash = latestBlockhash.blockhash
    tx.feePayer = this.wallet.publicKey

    const signedTx = await this.wallet.signTransaction(tx)
    const serializedTx = signedTx.serialize()
    const txSignature = await this.connection.sendRawTransaction(serializedTx)

    await this.connection.confirmTransaction({
      signature: txSignature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    })

    return txSignature
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(): Promise<AttestProtocolResponse<{ balance: number; address: PublicKey }>> {
    return this.safeExecute(async () => {
      const balance = await this.connection.getBalance(this.wallet.publicKey)
      return { balance, address: this.wallet.publicKey }
    })
  }

  /**
   * Normalize Solana address format
   */
  protected normalizeAddress(address: string): string {
    try {
      return new PublicKey(address).toBase58()
    } catch {
      return super.normalizeAddress(address)
    }
  }
}
