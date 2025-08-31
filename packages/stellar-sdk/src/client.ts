/**
 * Stellar Client - Core client implementation for Stellar Attest Protocol SDK
 * 
 * This client provides the main interface for interacting with the Attest Protocol
 * on the Stellar blockchain, implementing all methods defined in the requirements.
 */

import { 
  Keypair, 
  Networks, 
  rpc, 
  scValToNative,
  Address,
  nativeToScVal,
  xdr,
  Transaction
} from '@stellar/stellar-sdk'

import { 
  type Client as ClientType,
  Client as ProtocolClient,
  networks as ProtocolNetworks 
} from '@attestprotocol/stellar/dist/protocol'

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
  TransactionSigner
} from './types'

import { generateAttestationUid, generateSchemaUid } from './utils/uidGenerator'
import { encodeSchema, decodeSchema } from './utils/dataCodec'
import { 
  createAttestMessage, 
  createRevokeMessage,
  getAttestDST,
  getRevokeDST 
} from './utils/delegation'
import { generateBlsKeys, verifySignature, signHashedMessage } from './utils/bls'
import { 
  fetchAttestationsByLedger,
  fetchSchemasByLedger,
  fetchLatestAttestations,
  fetchLatestSchemas,
  fetchAttestationsByWallet,
  fetchSchemasByWallet
} from './utils/indexer'
import { 
  NetworkError, 
  ContractError, 
  TransactionError,
  ValidationError,
  NotImplementedError,
  ConfigurationError,
  ErrorFactory
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
   * 2. Revoke an attestation
   * 
   * Usage Examples:
   * 
   * // CLI with Keypair
   * const keypair = Keypair.fromSecret('SECRET_KEY')
   * const signer = {
   *   signTransaction: async (xdr) => {
   *     const tx = new Transaction(xdr, Networks.TESTNET)
   *     tx.sign(keypair)
   *     return tx.toXDR()
   *   }
   * }
   * await client.revoke(attestationUid, { signer })
   * 
   * // Web with Freighter
   * const signer = {
   *   signTransaction: async (xdr) => {
   *     return await window.freighter.signTransaction(xdr, { network: 'TESTNET' })
   *   }
   * }
   * await client.revoke(attestationUid, { signer })
   * 
   * // Manual signing (returns unsigned transaction)
   * const tx = await client.revoke(attestationUid)
   * // User signs tx manually, then submit with:
   * // await client.submitTransaction(signedXdr)
   */
  async revoke(attestationUid: Buffer, options?: TxOptions): Promise<any> {
    try {
      const tx = await this.attestationProtocol.revoke({
        revoker: this.callerPublicKey,
        attestation_uid: attestationUid
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
   * 3. Create an attestation
   * 
   * Usage Examples:
   * 
   * // CLI with Keypair
   * const keypair = Keypair.fromSecret('SECRET_KEY')
   * const signer = {
   *   signTransaction: async (xdr) => {
   *     const tx = new Transaction(xdr, Networks.TESTNET)
   *     tx.sign(keypair)
   *     return tx.toXDR()
   *   }
   * }
   * const uid = await client.attest(schemaUid, value, expiration, { signer })
   * 
   * // Web with Freighter
   * const signer = {
   *   signTransaction: async (xdr) => {
   *     return await window.freighter.signTransaction(xdr, { network: 'TESTNET' })
   *   }
   * }
   * const uid = await client.attest(schemaUid, value, expiration, { signer })
   * 
   * // Manual signing (returns unsigned transaction)
   * const tx = await client.attest(schemaUid, value, expiration)
   * // User signs tx manually, then submit with:
   * // const result = await client.submitTransaction(signedXdr)
   */
  async attest(
    schemaUid: Buffer, 
    value: string, 
    expiration?: number, 
    options?: TxOptions
  ): Promise<Buffer | any> {
    try {
      const tx = await this.attestationProtocol.attest({
        attester: this.callerPublicKey,
        schema_uid: schemaUid,
        value,
        expiration_time: expiration
      })

      if (options?.simulate) {
        const result = await tx.simulate()
        // Extract attestation UID from simulation result
        if (result.result?.returnValue) {
          const uid = scValToNative(result.result.returnValue)
          return Buffer.from(uid)
        }
        throw new Error('Simulation did not return attestation UID')
      }

      // If signer provided, sign and submit automatically
      if (options?.signer) {
        const signedXdr = await options.signer.signTransaction(tx.toXDR())
        const result = await this.submitTransaction(signedXdr)
        // Extract attestation UID from result
        return Buffer.from(result.hash || result.transactionHash || '', 'hex')
      }

      // Return unsigned transaction for manual signing
      return tx
    } catch (error: any) {
      throw new Error(`Failed to create attestation: ${error.message}`)
    }
  }

  /**
   * 4. Generate attestation UID
   */
  generateAttestationUid(schemaUid: Buffer, subject: string, nonce: bigint): Buffer {
    return generateAttestationUid(schemaUid, subject, nonce)
  }

  /**
   * 5. Generate schema UID
   */
  generateSchemaUid(definition: string, authority: string, resolver?: string): Buffer {
    return generateSchemaUid(definition, authority, resolver)
  }

  /**
   * 6. Create a new schema
   * 
   * Usage Examples:
   * 
   * // CLI with Keypair
   * const keypair = Keypair.fromSecret('SECRET_KEY')
   * const signer = {
   *   signTransaction: async (xdr) => {
   *     const tx = new Transaction(xdr, Networks.TESTNET)
   *     tx.sign(keypair)
   *     return tx.toXDR()
   *   }
   * }
   * const uid = await client.createSchema(definition, resolver, true, { signer })
   * 
   * // Web with Freighter
   * const signer = {
   *   signTransaction: async (xdr) => {
   *     return await window.freighter.signTransaction(xdr, { network: 'TESTNET' })
   *   }
   * }
   * const uid = await client.createSchema(definition, resolver, true, { signer })
   * 
   * // Manual signing (returns unsigned transaction)
   * const tx = await client.createSchema(definition, resolver, true)
   * // User signs tx manually, then submit with:
   * // const result = await client.submitTransaction(signedXdr)
   */
  async createSchema(
    definition: string, 
    resolver?: string, 
    revocable: boolean = true, 
    options?: TxOptions
  ): Promise<Buffer | any> {
    try {
      const tx = await this.attestationProtocol.register({
        caller: this.callerPublicKey,
        schema_definition: definition,
        resolver: resolver || null,
        revocable
      })

      if (options?.simulate) {
        const result = await tx.simulate()
        if (result.result?.returnValue) {
          const uid = scValToNative(result.result.returnValue)
          return Buffer.from(uid)
        }
        throw new Error('Simulation did not return schema UID')
      }

      // If signer provided, sign and submit automatically
      if (options?.signer) {
        const signedXdr = await options.signer.signTransaction(tx.toXDR())
        const result = await this.submitTransaction(signedXdr)
        // Extract schema UID from result
        return Buffer.from(result.hash || result.transactionHash || '', 'hex')
      }

      // Return unsigned transaction for manual signing
      return tx
    } catch (error: any) {
      throw new Error(`Failed to create schema: ${error.message}`)
    }
  }

  /**
   * 7. Get schema by UID
   */
  async getSchema(uid: Buffer): Promise<ContractSchema> {
    try {
      const tx = await this.attestationProtocol.get_schema({
        schema_uid: uid
      })

      const result = await tx.simulate()
      
      if (!result.result?.returnValue) {
        throw new Error('Schema not found')
      }

      const schemaData = scValToNative(result.result.returnValue)
      
      return {
        uid,
        definition: schemaData.definition || schemaData.schema,
        authority: schemaData.authority,
        resolver: schemaData.resolver,
        revocable: schemaData.revocable ?? true,
        timestamp: schemaData.timestamp || Date.now()
      }
    } catch (error: any) {
      throw new Error(`Failed to fetch schema: ${error.message}`)
    }
  }

  /**
   * 8. Get attestation by UID
   */
  async getAttestation(uid: Buffer): Promise<ContractAttestation> {
    try {
      const tx = await this.attestationProtocol.get_attestation({
        attestation_uid: uid
      })

      const result = await tx.simulate()
      
      if (!result.result?.returnValue) {
        throw new Error('Attestation not found')
      }

      const attestationData = scValToNative(result.result.returnValue)
      
      return {
        uid,
        schemaUid: Buffer.from(attestationData.schema_uid),
        subject: attestationData.subject,
        attester: attestationData.attester,
        value: attestationData.value,
        timestamp: attestationData.timestamp || Date.now(),
        expirationTime: attestationData.expiration_time,
        revocationTime: attestationData.revocation_time,
        revoked: attestationData.revoked || false
      }
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
      expectedMessage
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
          signature
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
          signature
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
  async getAttestationsByLedger(ledger: number, limit?: number): Promise<ContractAttestation[]> {
    try {
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
  async attestByDelegation(
    request: DelegatedAttestationRequest, 
    options?: TxOptions
  ): Promise<any> {
    try {
      const tx = await this.attestationProtocol.attest_by_delegation({
        request: {
          attester: request.attester,
          schema_uid: request.schemaUid,
          value: request.value,
          nonce: request.nonce,
          deadline: request.deadline,
          signature: request.signature
        }
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
  async revokeByDelegation(
    request: DelegatedRevocationRequest, 
    options?: TxOptions
  ): Promise<any> {
    try {
      const tx = await this.attestationProtocol.revoke_by_delegation({
        request: {
          revoker: request.revoker,
          attestation_uid: request.attestationUid,
          nonce: request.nonce,
          deadline: request.deadline,
          signature: request.signature
        }
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
  async getSchemasByLedger(ledger: number, limit?: number): Promise<ContractSchema[]> {
    try {
      const network = this.networkPassphrase === Networks.PUBLIC ? 'mainnet' : 'testnet'
      return await fetchSchemasByLedger(ledger, limit, network)
    } catch (error: any) {
      throw ErrorFactory.wrap(error, 'Failed to fetch schemas by ledger')
    }
  }

  /**
   * Fetch attestations by wallet address
   * 
   * @param walletAddress - The wallet address to query
   * @param limit - Maximum number of results (default 100)
   * @param offset - Pagination offset (default 0)
   * @returns Promise with attestations, total count, and hasMore flag
   */
  async fetchAttestationsByWallet(
    walletAddress: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{
    attestations: ContractAttestation[]
    total: number
    hasMore: boolean
  }> {
    try {
      const network = this.networkPassphrase === Networks.PUBLIC ? 'mainnet' : 'testnet'
      return await fetchAttestationsByWallet(walletAddress, limit, offset, network)
    } catch (error: any) {
      throw ErrorFactory.wrap(error, `Failed to fetch attestations for wallet ${walletAddress}`)
    }
  }

  /**
   * Fetch schemas created by a wallet address
   * 
   * @param walletAddress - The wallet address to query
   * @param limit - Maximum number of results (default 100)
   * @param offset - Pagination offset (default 0)
   * @returns Promise with schemas, total count, and hasMore flag
   */
  async fetchSchemasByWallet(
    walletAddress: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{
    schemas: ContractSchema[]
    total: number
    hasMore: boolean
  }> {
    try {
      const network = this.networkPassphrase === Networks.PUBLIC ? 'mainnet' : 'testnet'
      return await fetchSchemasByWallet(walletAddress, limit, offset, network)
    } catch (error: any) {
      throw ErrorFactory.wrap(error, `Failed to fetch schemas for wallet ${walletAddress}`)
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
}