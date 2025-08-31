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
  xdr
} from '@stellar/stellar-sdk'

import { 
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
  VerificationResult
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

/**
 * Main Stellar client for the Attest Protocol
 */
export class StellarClient {
  private protocolClient: ProtocolClient
  private server: rpc.Server
  private networkPassphrase: string
  private options: ClientOptions

  constructor(options: ClientOptions) {
    this.options = options
    
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
          contractId = ProtocolNetworks.mainnet?.contractId || ''
          break
        case 'testnet':
        default:
          contractId = ProtocolNetworks.testnet?.contractId || ''
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
    this.protocolClient = new ProtocolClient({
      networkPassphrase: this.networkPassphrase,
      rpcUrl: options.rpcUrl,
      allowHttp: options.allowHttp ?? options.rpcUrl.startsWith('http://'),
      contractId,
    })
  }

  /**
   * 2. Revoke an attestation
   */
  async revoke(attestationUid: Buffer, options?: TxOptions): Promise<any> {
    try {
      const tx = await this.protocolClient.revoke({
        revoker: '', // Will be set by the wallet signing the transaction
        attestation_uid: attestationUid
      })

      if (options?.simulate) {
        return await tx.simulate()
      }

      const result = await tx.signAndSend()
      return result
    } catch (error: any) {
      throw ErrorFactory.wrap(error, 'Failed to revoke attestation')
    }
  }

  /**
   * 3. Create an attestation
   */
  async attest(
    schemaUid: Buffer, 
    value: string, 
    expiration?: number, 
    options?: TxOptions
  ): Promise<Buffer> {
    try {
      const tx = await this.protocolClient.attest({
        attester: '', // Will be set by the wallet signing the transaction
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

      const result = await tx.signAndSend()
      // The attestation UID should be in the result
      // This will need to be extracted from the transaction result
      return Buffer.from(result.transactionHash || '', 'hex')
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
   */
  async createSchema(
    definition: string, 
    resolver?: string, 
    revocable: boolean = true, 
    options?: TxOptions
  ): Promise<Buffer> {
    try {
      const tx = await this.protocolClient.register({
        authority: '', // Will be set by the wallet signing the transaction
        schema: definition,
        resolver: resolver ? new Address(resolver) : undefined,
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

      const result = await tx.signAndSend()
      // Extract schema UID from result
      return Buffer.from(result.transactionHash || '', 'hex')
    } catch (error: any) {
      throw new Error(`Failed to create schema: ${error.message}`)
    }
  }

  /**
   * 7. Get schema by UID
   */
  async getSchema(uid: Buffer): Promise<ContractSchema> {
    try {
      const tx = await this.protocolClient.get_schema({
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
      const tx = await this.protocolClient.get_attestation({
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
  createRevokeMessage(request: DelegatedRevocationRequest, dst: Buffer): Buffer {
    return createRevokeMessage(request, dst)
  }

  /**
   * 10. Create attestation message for delegation
   */
  createAttestMessage(request: DelegatedAttestationRequest, dst: Buffer): Buffer {
    return createAttestMessage(request, dst)
  }

  /**
   * 11. Get domain separator tag for revocations
   */
  async getRevokeDST(): Promise<Buffer> {
    return getRevokeDST(this.protocolClient)
  }

  /**
   * 12. Get domain separator tag for attestations
   */
  async getAttestDST(): Promise<Buffer> {
    return getAttestDST(this.protocolClient)
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
    expectedMessage?: Buffer
  ): VerificationResult {
    return verifySignature(signedMessage, publicKey, expectedMessage)
  }

  /**
   * 17. Submit signed transaction
   */
  async submitSignedTx(signedXdr: string, options?: SubmitOptions): Promise<any> {
    try {
      const transaction = xdr.TransactionEnvelope.fromXDR(signedXdr, 'base64')
      
      if (!options?.skipSimulation) {
        // Simulate first
        const simResult = await this.server.simulateTransaction(transaction)
        if (simResult.error) {
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
      let message: Buffer
      let signedRequest: any
      
      if (isAttestation) {
        const attestRequest = request as DelegatedAttestationRequest
        const dst = await this.getAttestDST()
        message = this.createAttestMessage(attestRequest, dst)
        
        // Sign the message with BLS private key
        const signature = signMessage(message, privateKey)
        
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
        const signature = signMessage(message, privateKey)
        
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
   */
  async attestByDelegation(
    request: DelegatedAttestationRequest, 
    options?: TxOptions
  ): Promise<any> {
    try {
      const tx = await this.protocolClient.attest_by_delegation({
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

      return await tx.signAndSend()
    } catch (error: any) {
      throw new Error(`Failed to attest by delegation: ${error.message}`)
    }
  }

  /**
   * 20. Revoke by delegation
   */
  async revokeByDelegation(
    request: DelegatedRevocationRequest, 
    options?: TxOptions
  ): Promise<any> {
    try {
      const tx = await this.protocolClient.revoke_by_delegation({
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

      return await tx.signAndSend()
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
  getProtocolClient(): ProtocolClient {
    return this.protocolClient
  }

  /**
   * Get the RPC server instance
   */
  getServer(): rpc.Server {
    return this.server
  }
}