/**
 * Stellar implementation of the Attest Protocol SDK
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

import { StellarConfig } from './types'
import { StellarSchemaRegistry } from './schema'
import { StellarAttestationService } from './attest'
import { AttestProtocolAuthority } from './authority'

import {
  Keypair,
  Networks,
  rpc,
} from '@stellar/stellar-sdk'

// Note: ContractClientOptions is inferred from the client constructors

import { 
  Client as ProtocolClient,
  networks as ProtocolNetworks 
} from '@attestprotocol/stellar/dist/protocol'
import { 
  Client as AuthorityClient,
  networks as AuthorityNetworks 
} from '@attestprotocol/stellar/dist/authority'

/**
 * Stellar implementation of the Attest SDK
 */
export class StellarAttestProtocol extends AttestProtocolBase {
  protected config: StellarConfig
  private server: rpc.Server
  private networkPassphrase: string
  private protocolClient: ProtocolClient
  private authorityClient: AuthorityClient
  
  // Service modules
  private schemaService: StellarSchemaRegistry
  private attestationService: StellarAttestationService
  private authorityService: AttestProtocolAuthority

  /**
   * Creates a new instance of the Stellar Attest SDK
   * @param config SDK configuration options
   */
  constructor(config: StellarConfig) {
    super(config)
    this.config = config

    // Initialize Stellar SDK
    const defaultUrl = 'https://soroban-testnet.stellar.org'
    this.server = new rpc.Server(config.url ?? defaultUrl, {
      allowHttp: config.allowHttp ?? (config.url ?? defaultUrl).startsWith('http://'),
    })

    this.networkPassphrase = config.networkPassphrase ?? Networks.TESTNET

    // Initialize contract clients
    const clientOptions = {
      networkPassphrase: this.networkPassphrase,
      rpcUrl: config.url ?? defaultUrl,
      allowHttp: config.allowHttp ?? (config.url ?? defaultUrl).startsWith('http://'),
    }

    // Use contract addresses from deployments or config
    const protocolContractId = config.contractAddresses?.protocol ?? 
      ProtocolNetworks.testnet.contractId
    const authorityContractId = config.contractAddresses?.authority ?? 
      AuthorityNetworks.testnet.contractId

    this.protocolClient = new ProtocolClient({
      ...clientOptions,
      contractId: protocolContractId,
    })

    this.authorityClient = new AuthorityClient({
      ...clientOptions,
      contractId: authorityContractId,
    })

    // Initialize service modules
    this.schemaService = new StellarSchemaRegistry(config, this.protocolClient)
    this.attestationService = new StellarAttestationService(config, this.protocolClient)
    this.authorityService = new AttestProtocolAuthority(config, this.authorityClient)
  }

  protected getDefaultNetworkUrl(): string {
    return 'https://soroban-testnet.stellar.org'
  }

  /**
   * Initialize the protocol contract by setting the admin
   */
  async initialize(): Promise<AttestProtocolResponse<void>> {
    return this.safeExecute(
      async () => {
        const tx = await this.protocolClient.initialize({
          admin: this.config.publicKey
        })

        await tx.signAndSend()
      },
      () => {
        this.initialized = true
      }
    )
  }

  // Authority Management - Delegate to AuthorityService

  async registerAuthority(): Promise<AttestProtocolResponse<string>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return createSuccessResponse(this.config.publicKey)
  }

  async fetchAuthority(id: string): Promise<AttestProtocolResponse<Authority | null>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.authorityService.fetchAuthority(id)
  }

  async isIssuerAnAuthority(issuer: string): Promise<AttestProtocolResponse<boolean>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.authorityService.isAuthority(issuer)
  }

  // Schema Management - Delegate to SchemaService

  async createSchema(config: SchemaDefinition): Promise<AttestProtocolResponse<Schema>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.schemaService.createSchema(config)
  }

  async fetchSchemaById(id: string): Promise<AttestProtocolResponse<Schema | null>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.schemaService.fetchSchemaById(id)
  }

  async generateIdFromSchema(schema: SchemaDefinition): Promise<AttestProtocolResponse<string>> {
    return this.schemaService.generateIdFromSchema(schema)
  }

  async listSchemasByIssuer(
    params: ListSchemasByIssuerParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Schema>>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.schemaService.listSchemasByIssuer(params)
  }

  // Attestation Management - Delegate to AttestationService

  async issueAttestation(
    config: AttestationDefinition
  ): Promise<AttestProtocolResponse<Attestation>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.attestationService.issueAttestation(config)
  }

  async fetchAttestationById(id: string): Promise<AttestProtocolResponse<Attestation | null>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.attestationService.fetchAttestationById(id)
  }

  async listAttestationsByWallet(
    params: ListAttestationsByWalletParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.attestationService.listAttestationsByWallet(params)
  }

  async listAttestationsBySchema(
    params: ListAttestationsBySchemaParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.attestationService.listAttestationsBySchema(params)
  }

  async revokeAttestation(config: RevocationDefinition): Promise<AttestProtocolResponse<void>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.attestationService.revokeAttestation(config)
  }

  // Delegation (not implemented in current Stellar contracts)

  async attestByDelegation(
    config: DelegatedAttestationDefinition
  ): Promise<AttestProtocolResponse<Attestation>> {
    return this.attestationService.attestByDelegation(config)
  }

  async revokeByDelegation(
    config: DelegatedRevocationDefinition
  ): Promise<AttestProtocolResponse<void>> {
    return this.attestationService.revokeByDelegation(config)
  }

  // Stellar-specific helper methods

  /**
   * Get the underlying protocol contract client
   */
  getProtocolClient(): ProtocolClient {
    return this.protocolClient
  }

  /**
   * Get the underlying authority contract client
   */
  getAuthorityClient(): AuthorityClient {
    return this.authorityClient
  }

  /**
   * Get the schema service for direct access
   */
  getSchemaService(): StellarSchemaRegistry {
    return this.schemaService
  }

  /**
   * Get the attestation service for direct access
   */
  getAttestationService(): StellarAttestationService {
    return this.attestationService
  }

  /**
   * Get the authority service for direct access
   */
  getAuthorityService(): AttestProtocolAuthority {
    return this.authorityService
  }

  /**
   * Get an attestation by schema UID, subject, and reference
   */
  async getAttestation(
    schemaUid: string,
    subject: string,
    reference?: string
  ): Promise<AttestProtocolResponse<Attestation | null>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.attestationService.getAttestation(schemaUid, subject, reference)
  }
}