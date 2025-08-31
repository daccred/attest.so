/**
 * Stellar Client - Core client implementation for Stellar Attest Protocol SDK
 *
 * This client provides the main interface for interacting with the Attest Protocol
 * on the Stellar blockchain, implementing all methods defined in the requirements.
 */

import { Keypair, Networks, rpc, scValToNative, Address, nativeToScVal, xdr, Transaction } from '@stellar/stellar-sdk'

import {
  type Client as ClientType,
  Client as ProtocolClient,
  networks as ProtocolNetworks,
} from '@attestprotocol/stellar/protocol'

import {
  ClientOptions,
  TxOptions,
  SubmitOptions,
  DelegatedAttestationRequest,
  DelegatedRevocationRequest,
  ContractSchema,
  ContractAttestation,
  BlsKeyPair,
  VerificationResult,
  TransactionSigner,
  AttestParams,
  RevokeParams,
  CreateSchemaParams,
  FetchAttestationsByWalletParams,
  FetchSchemasByWalletParams,
  FetchByLedgerParams,
  GenerateAttestationUidParams,
  GenerateSchemaUidParams,
} from './types'

import { generateAttestationUid, generateSchemaUid } from './utils/uidGenerator'
import { encodeSchema, decodeSchema } from './utils/dataCodec'
import { createAttestMessage, createRevokeMessage, getAttestDST, getRevokeDST } from './delegation'
import { generateBlsKeys, verifySignature, signHashedMessage } from './utils/bls'
import {
  fetchAttestationsByLedger,
  fetchSchemasByLedger,
  fetchLatestAttestations,
  fetchLatestSchemas,
  fetchAttestationsByWallet,
  fetchSchemasByWallet,
} from './utils/indexer'
import {
  NetworkError,
  ContractError,
  TransactionError,
  ConfigurationError,
  ErrorFactory,
} from './common/errors'
import { WeierstrassPoint } from '@noble/curves/abstract/weierstrass'

/**
 * Main Stellar client for the Attest Protocol
 */
export class StellarAttestationClient {
  private attestationProtocol: ClientType
  private server: rpc.Server
  private networkPassphrase: string
  private callerPublicKey: string
  private options: ClientOptions

  constructor(options: ClientOptions) {
    this.options = options

    if (!options.publicKey) {
      throw new ConfigurationError('Public key is required')
    }
    this.callerPublicKey = options.publicKey

    // Initialize RPC server
    this.server = new rpc.Server(options.rpcUrl, {
      allowHttp: options.allowHttp ?? options.rpcUrl.startsWith('http://'),
    })

    // Set network passphrase
    if (options.networkPassphrase) {
      this.networkPassphrase = options.networkPassphrase
    } else {
      switch (options.network) {
        case 'mainnet':
          this.networkPassphrase = Networks.PUBLIC
          break
        case 'futurenet':
          this.networkPassphrase = Networks.FUTURENET
          break
        case 'testnet':
        default:
          this.networkPassphrase = Networks.TESTNET
          break
      }
    }

    // Determine contract ID
    let contractId = options.contractId
    if (!contractId) {
      switch (options.network) {
        case 'mainnet':
          contractId = ProtocolNetworks.mainnet.contractId || ''
          break
        case 'testnet':
        default:
          contractId = ProtocolNetworks.testnet.contractId || ''
          break
      }
    }

    if (!contractId) {
      throw new ConfigurationError(
        'Contract ID is required. Either provide it directly or specify a valid network.',
        'contractId'
      )
    }

    // Initialize protocol client
    this.attestationProtocol = new ProtocolClient({
      contractId,
      rpcUrl: options.rpcUrl,
      publicKey: options.publicKey,
      networkPassphrase: this.networkPassphrase,
      allowHttp: options.allowHttp ?? options.rpcUrl.startsWith('http://'),
    })
  }

  /**
   * Revoke an attestation
   *
   * Usage Examples:
   *
   * // Object-based approach (recommended)
   * await client.revoke({
   *   attestationUid: Buffer.from('...'),
   *   options: { signer }
   * })
   *
   * // Legacy positional arguments (backward compatibility)
   * await client.revoke(attestationUid, { signer })
   */
  async revoke(params: RevokeParams): Promise<any>
  async revoke(attestationUid: Buffer, options?: TxOptions): Promise<any>
  async revoke(paramsOrUid: RevokeParams | Buffer, legacyOptions?: TxOptions): Promise<any> {
    try {
      // Handle both object and positional arguments
      const { attestationUid, options } = this.normalizeRevokeArgs(paramsOrUid, legacyOptions)

      const tx = await this.attestationProtocol.revoke({
        revoker: this.callerPublicKey,
        attestation_uid: attestationUid,
      })

      if (options?.simulate) {
        return await tx.simulate()
      }

      // If signer provided, sign and submit automatically
      if (options?.signer) {
        const signedXdr = await options.signer.signTransaction(tx.toXDR())
        return await this.submitTransaction(signedXdr)
      }

      // Return unsigned transaction for manual signing
      return tx
    } catch (error: any) {
      throw ErrorFactory.wrap(error, 'Failed to revoke attestation')
    }
  }

  /**
   * Create an attestation
   *
   * Usage Examples:
   *
   * // Object-based approach (recommended)
   * await client.attest({
   *   schemaUid: Buffer.from('...'),
   *   value: JSON.stringify({ name: 'John', age: 30 }),
   *   subject: 'GSUBJECT123...',
   *   expirationTime: Date.now() + 365*24*60*60*1000,
   *   options: { signer }
   * })
   *
   * // Legacy positional arguments (backward compatibility)
   * await client.attest(schemaUid, value, expiration, { signer })
   */
  async attest(params: AttestParams): Promise<any>
  async attest(schemaUid: Buffer, value: string, expiration?: number, options?: TxOptions): Promise<any>
  async attest(
    paramsOrSchemaUid: AttestParams | Buffer,
    legacyValue?: string,
    legacyExpiration?: number,
    legacyOptions?: TxOptions
  ): Promise<any> {
    try {
      // Handle both object and positional arguments
      const { schemaUid, value, subject, expirationTime, options } = this.normalizeAttestArgs(
        paramsOrSchemaUid,
        legacyValue,
        legacyExpiration,
        legacyOptions
      )

      const tx = await this.attestationProtocol.attest({
        attester: this.callerPublicKey,
        schema_uid: schemaUid,
        value,
        expiration_time: BigInt(expirationTime || 0),
      })

      if (options?.simulate) {
        const result = await tx.simulate()
        // Return the full simulation result for SDK consumers to decide what they need
        return result
      }

      // If signer provided, sign and submit automatically
      if (options?.signer) {
        const signedXdr = await options.signer.signTransaction(tx.toXDR())
        const result = await this.submitTransaction(signedXdr)
        // Return the full transaction result
        return result
      }

      // Return unsigned transaction for manual signing
      return tx
    } catch (error: any) {
      throw new Error(`Failed to create attestation: ${error.message}`)
    }
  }

  /**
   * Generate attestation UID
   *
   * Usage Examples:
   *
   * // Object-based approach (recommended)
   * const uid = client.generateAttestationUid({
   *   schemaUid: Buffer.from('...'),
   *   subject: 'GSUBJECT123...',
   *   nonce: BigInt(12345)
   * })
   *
   * // Legacy positional arguments
   * const uid = client.generateAttestationUid(schemaUid, subject, nonce)
   */
  generateAttestationUid(params: GenerateAttestationUidParams): Buffer
  generateAttestationUid(schemaUid: Buffer, subject: string, nonce: bigint): Buffer
  generateAttestationUid(
    paramsOrSchemaUid: GenerateAttestationUidParams | Buffer,
    legacySubject?: string,
    legacyNonce?: bigint
  ): Buffer {
    const { schemaUid, subject, nonce } = this.normalizeGenerateAttestationUidArgs(
      paramsOrSchemaUid,
      legacySubject,
      legacyNonce
    )
    return generateAttestationUid(schemaUid, subject, nonce)
  }

  /**
   * Generate schema UID
   *
   * Usage Examples:
   *
   * // Object-based approach (recommended)
   * const uid = client.generateSchemaUid({
   *   definition: 'struct Identity { string name; uint age; }',
   *   authority: 'GAUTHORITY123...',
   *   resolver: 'GRESOLVER123...'
   * })
   *
   * // Legacy positional arguments
   * const uid = client.generateSchemaUid(definition, authority, resolver)
   */
  generateSchemaUid(params: GenerateSchemaUidParams): Buffer
  generateSchemaUid(definition: string, authority: string, resolver?: string): Buffer
  generateSchemaUid(
    paramsOrDefinition: GenerateSchemaUidParams | string,
    legacyAuthority?: string,
    legacyResolver?: string
  ): Buffer {
    const { definition, authority, resolver } = this.normalizeGenerateSchemaUidArgs(
      paramsOrDefinition,
      legacyAuthority,
      legacyResolver
    )
    return generateSchemaUid(definition, authority, resolver)
  }

  /**
   * Create a new schema
   *
   * Usage Examples:
   *
   * // Object-based approach (recommended)
   * await client.createSchema({
   *   definition: 'struct Identity { string name; uint age; }',
   *   resolver: 'GRESOLVER123...',
   *   revocable: true,
   *   options: { signer }
   * })
   *
   * // Legacy positional arguments
   * await client.createSchema(definition, resolver, true, { signer })
   */
  async createSchema(params: CreateSchemaParams): Promise<any>
  async createSchema(
    definition: string,
    resolver?: string,
    revocable?: boolean,
    options?: TxOptions
  ): Promise<any>
  async createSchema(
    paramsOrDefinition: CreateSchemaParams | string,
    legacyResolver?: string,
    legacyRevocable?: boolean,
    legacyOptions?: TxOptions
  ): Promise<any> {
    try {
      // Handle both object and positional arguments
      const { definition, resolver, revocable, options } = this.normalizeCreateSchemaArgs(
        paramsOrDefinition,
        legacyResolver,
        legacyRevocable,
        legacyOptions
      )

      const tx = await this.attestationProtocol.register({
        caller: this.callerPublicKey,
        schema_definition: definition,
        resolver: resolver || undefined,
        revocable: revocable ?? true,
      })

      if (options?.simulate) {
        const result = await tx.simulate()
        // Return the full simulation result for SDK consumers to decide what they need
        return result
      }

      // If signer provided, sign and submit automatically
      if (options?.signer) {
        const signedXdr = await options.signer.signTransaction(tx.toXDR())
        const result = await this.submitTransaction(signedXdr)
        // Return the full transaction result
        return result
      }

      // Return unsigned transaction for manual signing
      return tx
    } catch (error: any) {
      throw new Error(`Failed to create schema: ${error.message}`)
    }
  }

  /**
   * Get schema by UID
   */
  async getSchema(uid: Buffer): Promise<any> {
    try {
      const tx = await this.attestationProtocol.get_schema({
        schema_uid: uid,
      })

      const result = await tx.simulate()

      // Return the full simulation result for SDK consumers to decide what they need
      return result
    } catch (error: any) {
      throw new Error(`Failed to fetch schema: ${error.message}`)
    }
  }

  /**
   * Get attestation by UID
   */
  async getAttestation(uid: Buffer): Promise<any> {
    try {
      const tx = await this.attestationProtocol.get_attestation({
        attestation_uid: uid,
      })

      const result = await tx.simulate()

      // Return the full simulation result for SDK consumers to decide what they need
      return result
    } catch (error: any) {
      throw new Error(`Failed to fetch attestation: ${error.message}`)
    }
  }

  /**
   * 9. Create revoke message for delegation
   */
  createRevokeMessage(request: DelegatedRevocationRequest, dst: Buffer): WeierstrassPoint<bigint> {
    return createRevokeMessage(request, dst)
  }

  /**
   * 10. Create attestation message for delegation
   */
  createAttestMessage(request: DelegatedAttestationRequest, dst: Buffer): WeierstrassPoint<bigint> {
    return createAttestMessage(request, dst)
  }

  /**
   * 11. Get domain separator tag for revocations
   */
  async getRevokeDST(): Promise<Buffer> {
    return getRevokeDST(this.attestationProtocol)
  }

  /**
   * 12. Get domain separator tag for attestations
   */
  async getAttestDST(): Promise<Buffer> {
    return getAttestDST(this.attestationProtocol)
  }

  /**
   * 13. Generate BLS key pair
   */
  generateBlsKeys(): BlsKeyPair {
    return generateBlsKeys()
  }

  /**
   * 14. Encode schema definition
   */
  encodeSchema(schema: any): string {
    return encodeSchema(schema)
  }

  /**
   * 15. Decode schema definition
   */
  decodeSchema(encoded: string): any {
    return decodeSchema(encoded)
  }

  /**
   * 16. Verify BLS signature
   */
  verifySignature(
    signedMessage: Buffer,
    publicKey: Buffer,
    expectedMessage: WeierstrassPoint<bigint>
  ): VerificationResult {
    return verifySignature({
      signature: signedMessage,
      publicKey,
      expectedMessage,
    })
  }

  /**
   * Submit a signed transaction to the network
   *
   * Usage Examples:
   *
   * // After manual signing
   * const tx = await client.createSchema(definition)
   * const signedXdr = await someWallet.signTransaction(tx.toXDR())
   * const result = await client.submitTransaction(signedXdr)
   */
  async submitTransaction(signedXdr: string, options?: SubmitOptions): Promise<any> {
    try {
      const transactionEnvelope = xdr.TransactionEnvelope.fromXDR(signedXdr, 'base64')
      const transaction = new Transaction(transactionEnvelope, this.networkPassphrase)

      if (!options?.skipSimulation) {
        // Simulate first
        const simResult = await this.server.simulateTransaction(transaction)
        if ('error' in simResult && simResult.error) {
          throw new Error(`Simulation failed: ${simResult.error}`)
        }
      }

      const result = await this.server.sendTransaction(transaction)
      return result
    } catch (error: any) {
      throw new Error(`Failed to submit transaction: ${error.message}`)
    }
  }

  /**
   * 17. Submit signed transaction (alias for submitTransaction)
   * @deprecated Use submitTransaction instead
   */
  async submitSignedTx(signedXdr: string, options?: SubmitOptions): Promise<any> {
    return this.submitTransaction(signedXdr, options)
  }

  /**
   * 18. Submit raw transaction with BLS signing
   */
  async submitRawTx(
    request: DelegatedAttestationRequest | DelegatedRevocationRequest,
    privateKey: Buffer,
    options?: TxOptions
  ): Promise<any> {
    try {
      // Determine if this is attestation or revocation
      const isAttestation = 'schemaUid' in request && 'value' in request

      // Get the appropriate DST and create message
      let message: WeierstrassPoint<bigint>
      let signedRequest: any

      if (isAttestation) {
        const attestRequest = request as DelegatedAttestationRequest
        const dst = await this.getAttestDST()
        message = this.createAttestMessage(attestRequest, dst)

        // Sign the message with BLS private key
        const signature = signHashedMessage(message, privateKey)

        // Create signed request
        signedRequest = {
          ...attestRequest,
          signature,
        }

        // Submit via delegation
        return await this.attestByDelegation(signedRequest, options)
      } else {
        const revokeRequest = request as DelegatedRevocationRequest
        const dst = await this.getRevokeDST()
        message = this.createRevokeMessage(revokeRequest, dst)

        // Sign the message with BLS private key
        const signature = signHashedMessage(message, privateKey)

        // Create signed request
        signedRequest = {
          ...revokeRequest,
          signature,
        }

        // Submit via delegation
        return await this.revokeByDelegation(signedRequest, options)
      }
    } catch (error: any) {
      throw ErrorFactory.wrap(error, 'Failed to submit raw transaction')
    }
  }

  /**
   * 19. Get attestations by ledger (Horizon integration)
   */
  async getAttestationsByLedger(params: FetchByLedgerParams): Promise<ContractAttestation[]>
  async getAttestationsByLedger(ledger: number, limit?: number): Promise<ContractAttestation[]>
  async getAttestationsByLedger(
    paramsOrLedger: FetchByLedgerParams | number,
    legacyLimit?: number
  ): Promise<ContractAttestation[]> {
    try {
      const { ledger, limit } = this.normalizeFetchByLedgerArgs(paramsOrLedger, legacyLimit)

      const network = this.networkPassphrase === Networks.PUBLIC ? 'mainnet' : 'testnet'
      return await fetchAttestationsByLedger(ledger, limit, network)
    } catch (error: any) {
      throw ErrorFactory.wrap(error, 'Failed to fetch attestations by ledger')
    }
  }

  /**
   * 20. Attest by delegation
   *
   * Usage Examples:
   *
   * // CLI with Keypair
   * const signer = {
   *   signTransaction: async (xdr) => {
   *     const tx = new Transaction(xdr, Networks.TESTNET)
   *     tx.sign(keypair)
   *     return tx.toXDR()
   *   }
   * }
   * await client.attestByDelegation(request, { signer })
   *
   * // Manual signing
   * const tx = await client.attestByDelegation(request)
   * // User signs tx manually, then submit
   */
  async attestByDelegation(request: DelegatedAttestationRequest, options?: TxOptions): Promise<any> {
    try {
      const tx = await this.attestationProtocol.attest_by_delegation({
        submitter: this.callerPublicKey,
        request,
      })

      if (options?.simulate) {
        return await tx.simulate()
      }

      // If signer provided, sign and submit automatically
      if (options?.signer) {
        const signedXdr = await options.signer.signTransaction(tx.toXDR())
        return await this.submitTransaction(signedXdr)
      }

      // Return unsigned transaction for manual signing
      return tx
    } catch (error: any) {
      throw new Error(`Failed to attest by delegation: ${error.message}`)
    }
  }

  /**
   * 21. Revoke by delegation
   *
   * Usage Examples:
   *
   * // CLI with Keypair
   * const signer = {
   *   signTransaction: async (xdr) => {
   *     const tx = new Transaction(xdr, Networks.TESTNET)
   *     tx.sign(keypair)
   *     return tx.toXDR()
   *   }
   * }
   * await client.revokeByDelegation(request, { signer })
   *
   * // Manual signing
   * const tx = await client.revokeByDelegation(request)
   * // User signs tx manually, then submit
   */
  async revokeByDelegation(request: DelegatedRevocationRequest, options?: TxOptions): Promise<any> {
    try {
      const tx = await this.attestationProtocol.revoke_by_delegation({
        submitter: this.callerPublicKey,
        request,
      })

      if (options?.simulate) {
        return await tx.simulate()
      }

      // If signer provided, sign and submit automatically
      if (options?.signer) {
        const signedXdr = await options.signer.signTransaction(tx.toXDR())
        return await this.submitTransaction(signedXdr)
      }

      // Return unsigned transaction for manual signing
      return tx
    } catch (error: any) {
      throw new Error(`Failed to revoke by delegation: ${error.message}`)
    }
  }

  /**
   * 21. Fetch schemas from Horizon
   */
  async fetchSchemas(limit: number = 100): Promise<ContractSchema[]> {
    try {
      const network = this.networkPassphrase === Networks.PUBLIC ? 'mainnet' : 'testnet'
      return await fetchLatestSchemas(limit, network)
    } catch (error: any) {
      throw ErrorFactory.wrap(error, 'Failed to fetch schemas')
    }
  }

  /**
   * 22. Fetch attestations from Horizon
   */
  async fetchAttestations(limit: number = 100): Promise<ContractAttestation[]> {
    try {
      const network = this.networkPassphrase === Networks.PUBLIC ? 'mainnet' : 'testnet'
      return await fetchLatestAttestations(limit, network)
    } catch (error: any) {
      throw ErrorFactory.wrap(error, 'Failed to fetch attestations')
    }
  }

  /**
   * 23. Get schemas by ledger
   */
  async getSchemasByLedger(params: FetchByLedgerParams): Promise<ContractSchema[]>
  async getSchemasByLedger(ledger: number, limit?: number): Promise<ContractSchema[]>
  async getSchemasByLedger(
    paramsOrLedger: FetchByLedgerParams | number,
    legacyLimit?: number
  ): Promise<ContractSchema[]> {
    try {
      const { ledger, limit } = this.normalizeFetchByLedgerArgs(paramsOrLedger, legacyLimit)

      const network = this.networkPassphrase === Networks.PUBLIC ? 'mainnet' : 'testnet'
      return await fetchSchemasByLedger(ledger, limit, network)
    } catch (error: any) {
      throw ErrorFactory.wrap(error, 'Failed to fetch schemas by ledger')
    }
  }

  /**
   * Fetch attestations by wallet address
   *
   * Usage Examples:
   *
   * // Object-based approach (recommended)
   * const result = await client.fetchAttestationsByWallet({
   *   walletAddress: 'GWALLET123...',
   *   limit: 50,
   *   offset: 0
   * })
   *
   * // Legacy positional arguments
   * const result = await client.fetchAttestationsByWallet('GWALLET123...', 50, 0)
   */
  async fetchAttestationsByWallet(params: FetchAttestationsByWalletParams): Promise<{
    attestations: ContractAttestation[]
    total: number
    hasMore: boolean
  }>
  async fetchAttestationsByWallet(
    walletAddress: string,
    limit?: number,
    offset?: number
  ): Promise<{
    attestations: ContractAttestation[]
    total: number
    hasMore: boolean
  }>
  async fetchAttestationsByWallet(
    paramsOrAddress: FetchAttestationsByWalletParams | string,
    legacyLimit?: number,
    legacyOffset?: number
  ): Promise<{
    attestations: ContractAttestation[]
    total: number
    hasMore: boolean
  }> {
    try {
      const { walletAddress, limit, offset } = this.normalizeFetchAttestationsByWalletArgs(
        paramsOrAddress,
        legacyLimit,
        legacyOffset
      )

      const network = this.networkPassphrase === Networks.PUBLIC ? 'mainnet' : 'testnet'
      return await fetchAttestationsByWallet(walletAddress, limit, offset, network)
    } catch (error: any) {
      throw ErrorFactory.wrap(
        error,
        `Failed to fetch attestations for wallet ${typeof paramsOrAddress === 'string' ? paramsOrAddress : paramsOrAddress.walletAddress}`
      )
    }
  }

  /**
   * Fetch schemas created by a wallet address
   *
   * Usage Examples:
   *
   * // Object-based approach (recommended)
   * const result = await client.fetchSchemasByWallet({
   *   walletAddress: 'GWALLET123...',
   *   limit: 50,
   *   offset: 0
   * })
   *
   * // Legacy positional arguments
   * const result = await client.fetchSchemasByWallet('GWALLET123...', 50, 0)
   */
  async fetchSchemasByWallet(params: FetchSchemasByWalletParams): Promise<{
    schemas: ContractSchema[]
    total: number
    hasMore: boolean
  }>
  async fetchSchemasByWallet(
    walletAddress: string,
    limit?: number,
    offset?: number
  ): Promise<{
    schemas: ContractSchema[]
    total: number
    hasMore: boolean
  }>
  async fetchSchemasByWallet(
    paramsOrAddress: FetchSchemasByWalletParams | string,
    legacyLimit?: number,
    legacyOffset?: number
  ): Promise<{
    schemas: ContractSchema[]
    total: number
    hasMore: boolean
  }> {
    try {
      const { walletAddress, limit, offset } = this.normalizeFetchSchemasByWalletArgs(
        paramsOrAddress,
        legacyLimit,
        legacyOffset
      )

      const network = this.networkPassphrase === Networks.PUBLIC ? 'mainnet' : 'testnet'
      return await fetchSchemasByWallet(walletAddress, limit, offset, network)
    } catch (error: any) {
      throw ErrorFactory.wrap(
        error,
        `Failed to fetch schemas for wallet ${typeof paramsOrAddress === 'string' ? paramsOrAddress : paramsOrAddress.walletAddress}`
      )
    }
  }

  /**
   * Get the underlying protocol client for advanced usage
   */
  getClientInstance(): ProtocolClient {
    return this.attestationProtocol
  }

  /**
   * Get the RPC server instance
   */
  getServerInstance(): rpc.Server {
    return this.server
  }

  private normalizeRevokeArgs(
    paramsOrUid: RevokeParams | Buffer,
    legacyOptions?: TxOptions
  ): { attestationUid: Buffer; options?: TxOptions } {
    if (Buffer.isBuffer(paramsOrUid)) {
      return {
        attestationUid: paramsOrUid,
        options: legacyOptions,
      }
    }
    return {
      attestationUid: paramsOrUid.attestationUid,
      options: paramsOrUid.options || legacyOptions,
    }
  }

  private normalizeAttestArgs(
    paramsOrSchemaUid: AttestParams | Buffer,
    legacyValue?: string,
    legacyExpiration?: number,
    legacyOptions?: TxOptions
  ): { schemaUid: Buffer; value: string; subject?: string; expirationTime?: number; options?: TxOptions } {
    if (Buffer.isBuffer(paramsOrSchemaUid)) {
      return {
        schemaUid: paramsOrSchemaUid,
        value: legacyValue || '',
        subject: this.callerPublicKey,
        expirationTime: legacyExpiration,
        options: legacyOptions,
      }
    }
    return {
      schemaUid: paramsOrSchemaUid.schemaUid,
      value: paramsOrSchemaUid.value || legacyValue || '',
      subject: paramsOrSchemaUid.subject || this.callerPublicKey,
      expirationTime: paramsOrSchemaUid.expirationTime || legacyExpiration,
      options: paramsOrSchemaUid.options || legacyOptions,
    }
  }

  private normalizeGenerateAttestationUidArgs(
    paramsOrSchemaUid: GenerateAttestationUidParams | Buffer,
    legacySubject?: string,
    legacyNonce?: bigint
  ): { schemaUid: Buffer; subject: string; nonce: bigint } {
    if (Buffer.isBuffer(paramsOrSchemaUid)) {
      return {
        schemaUid: paramsOrSchemaUid,
        subject: legacySubject || '',
        nonce: legacyNonce || BigInt(0),
      }
    }
    return {
      schemaUid: paramsOrSchemaUid.schemaUid,
      subject: paramsOrSchemaUid.subject || legacySubject || '',
      nonce: paramsOrSchemaUid.nonce || legacyNonce || BigInt(0),
    }
  }

  private normalizeGenerateSchemaUidArgs(
    paramsOrDefinition: GenerateSchemaUidParams | string,
    legacyAuthority?: string,
    legacyResolver?: string
  ): { definition: string; authority: string; resolver: string } {
    if (typeof paramsOrDefinition === 'string') {
      return {
        definition: paramsOrDefinition,
        authority: legacyAuthority || '',
        resolver: legacyResolver || '',
      }
    }
    return {
      definition: paramsOrDefinition.definition,
      authority: paramsOrDefinition.authority || legacyAuthority || '',
      resolver: paramsOrDefinition.resolver || legacyResolver || '',
    }
  }

  private normalizeCreateSchemaArgs(
    paramsOrDefinition: CreateSchemaParams | string,
    legacyResolver?: string,
    legacyRevocable?: boolean,
    legacyOptions?: TxOptions
  ): { definition: string; resolver?: string; revocable?: boolean; options?: TxOptions } {
    if (typeof paramsOrDefinition === 'string') {
      return {
        definition: paramsOrDefinition,
        resolver: legacyResolver,
        revocable: legacyRevocable,
        options: legacyOptions,
      }
    }
    return {
      definition: paramsOrDefinition.definition,
      resolver: paramsOrDefinition.resolver || legacyResolver,
      revocable: paramsOrDefinition.revocable ?? legacyRevocable,
      options: paramsOrDefinition.options || legacyOptions,
    }
  }

  private normalizeFetchAttestationsByWalletArgs(
    paramsOrAddress: FetchAttestationsByWalletParams | string,
    legacyLimit?: number,
    legacyOffset?: number
  ): { walletAddress: string; limit: number; offset: number } {
    if (typeof paramsOrAddress === 'string') {
      return {
        walletAddress: paramsOrAddress,
        limit: legacyLimit || 100,
        offset: legacyOffset || 0,
      }
    }
    return {
      walletAddress: paramsOrAddress.walletAddress,
      limit: paramsOrAddress.limit || legacyLimit || 100,
      offset: paramsOrAddress.offset || legacyOffset || 0,
    }
  }

  private normalizeFetchSchemasByWalletArgs(
    paramsOrAddress: FetchSchemasByWalletParams | string,
    legacyLimit?: number,
    legacyOffset?: number
  ): { walletAddress: string; limit: number; offset: number } {
    if (typeof paramsOrAddress === 'string') {
      return {
        walletAddress: paramsOrAddress,
        limit: legacyLimit || 100,
        offset: legacyOffset || 0,
      }
    }
    return {
      walletAddress: paramsOrAddress.walletAddress,
      limit: paramsOrAddress.limit || legacyLimit || 100,
      offset: paramsOrAddress.offset || legacyOffset || 0,
    }
  }

  private normalizeFetchByLedgerArgs(
    paramsOrLedger: FetchByLedgerParams | number,
    legacyLimit?: number
  ): { ledger: number; limit: number } {
    if (typeof paramsOrLedger === 'number') {
      return {
        ledger: paramsOrLedger,
        limit: legacyLimit || 100,
      }
    }
    return {
      ledger: paramsOrLedger.ledger,
      limit: paramsOrLedger.limit || legacyLimit || 100,
    }
  }
}

