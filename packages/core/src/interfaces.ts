/**
 * Core interfaces for Attest Protocol SDKs
 * These interfaces define the contract that all chain-specific implementations must follow
 */

import {
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
  ChainConfig
} from './types'

/**
 * Core interface that all chain-specific SDKs must implement
 * This ensures a consistent API across all supported blockchains
 */
export interface IAttestProtocol {
  /**
   * Initialize the SDK with the provided configuration
   * @returns Promise resolving to void or error
   */
  initialize(): Promise<AttestProtocolResponse<void>>

  // Authority Management
  
  /**
   * Register the current wallet/account as an authority
   * @returns Promise resolving to the authority ID
   */
  registerAuthority(): Promise<AttestProtocolResponse<string>>

  /**
   * Fetch authority information by ID
   * @param id Authority identifier
   * @returns Promise resolving to authority data or null if not found
   */
  fetchAuthority(id: string): Promise<AttestProtocolResponse<Authority | null>>

  /**
   * Check if a given issuer is registered as an authority
   * @param issuer Issuer identifier
   * @returns Promise resolving to boolean indicating authority status
   */
  isIssuerAnAuthority(issuer: string): Promise<AttestProtocolResponse<boolean>>

  // Schema Management

  /**
   * Create a new schema
   * @param config Schema configuration
   * @returns Promise resolving to the created schema
   */
  createSchema(config: SchemaDefinition): Promise<AttestProtocolResponse<Schema>>

  /**
   * Fetch schema by its unique identifier
   * @param id Schema UID
   * @returns Promise resolving to schema data or null if not found
   */
  fetchSchemaById(id: string): Promise<AttestProtocolResponse<Schema | null>>

  /**
   * Generate a deterministic ID from schema definition
   * @param schema Schema definition object
   * @returns Promise resolving to the generated schema ID
   */
  generateIdFromSchema(schema: SchemaDefinition): Promise<AttestProtocolResponse<string>>

  /**
   * List schemas created by a specific issuer
   * @param params Query parameters including issuer and pagination
   * @returns Promise resolving to paginated list of schemas
   */
  listSchemasByIssuer(params: ListSchemasByIssuerParams): Promise<AttestProtocolResponse<PaginatedResponse<Schema>>>

  // Attestation Management

  /**
   * Issue a new attestation
   * @param config Attestation configuration
   * @returns Promise resolving to the created attestation
   */
  issueAttestation(config: AttestationDefinition): Promise<AttestProtocolResponse<Attestation>>

  /**
   * Fetch attestation by its unique identifier
   * @param id Attestation UID
   * @returns Promise resolving to attestation data or null if not found
   */
  fetchAttestationById(id: string): Promise<AttestProtocolResponse<Attestation | null>>

  /**
   * List attestations associated with a specific wallet address
   * @param params Query parameters including wallet and filters
   * @returns Promise resolving to paginated list of attestations
   */
  listAttestationsByWallet(params: ListAttestationsByWalletParams): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>>

  /**
   * List attestations for a specific schema
   * @param params Query parameters including schema UID and filters
   * @returns Promise resolving to paginated list of attestations
   */
  listAttestationsBySchema(params: ListAttestationsBySchemaParams): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>>

  /**
   * Revoke an existing attestation
   * @param config Revocation configuration
   * @returns Promise resolving to void on success
   */
  revokeAttestation(config: RevocationDefinition): Promise<AttestProtocolResponse<void>>

  // Delegation

  /**
   * Issue an attestation on behalf of another authority (delegation)
   * @param config Delegated attestation configuration
   * @returns Promise resolving to the created attestation
   */
  attestByDelegation(config: DelegatedAttestationDefinition): Promise<AttestProtocolResponse<Attestation>>

  /**
   * Revoke an attestation on behalf of another authority (delegation)
   * @param config Delegated revocation configuration
   * @returns Promise resolving to void on success
   */
  revokeByDelegation(config: DelegatedRevocationDefinition): Promise<AttestProtocolResponse<void>>
}

/**
 * Configuration interface for SDK initialization
 * Chain-specific SDKs should extend this interface with their specific requirements
 */
export interface IProtocolConfig extends ChainConfig {
  /**
   * Network URL endpoint
   */
  rpcUrl?: string

  /**
   * Optional contract addresses or program IDs
   */
  contractAddresses?: Record<string, string>

  /**
   * Optional network configuration
   */
  network?: string

  /**
   * Additional chain-specific configuration
   */
  [key: string]: any
}

/**
 * Optional interface for SDKs that support batch operations
 */
export interface IBatchOperations {
  /**
   * Issue multiple attestations in a single transaction
   * @param attestations Array of attestation configurations
   * @returns Promise resolving to array of created attestations
   */
  batchIssueAttestations(attestations: AttestationDefinition[]): Promise<AttestProtocolResponse<Attestation[]>>

  /**
   * Revoke multiple attestations in a single transaction
   * @param revocations Array of revocation configurations
   * @returns Promise resolving to void on success
   */
  batchRevokeAttestations(revocations: RevocationDefinition[]): Promise<AttestProtocolResponse<void>>
}

/**
 * Optional interface for SDKs that support off-chain signatures
 */
export interface IOffChainOperations {
  /**
   * Create an off-chain attestation signature
   * @param config Attestation configuration
   * @returns Promise resolving to signature data
   */
  createOffChainAttestation(config: AttestationDefinition): Promise<AttestProtocolResponse<string>>

  /**
   * Verify an off-chain attestation signature
   * @param attestation Attestation data
   * @param signature Signature to verify
   * @returns Promise resolving to verification result
   */
  verifyOffChainAttestation(attestation: Attestation, signature: string): Promise<AttestProtocolResponse<boolean>>
}

/**
 * Optional interface for SDKs that support event listening
 */
export interface IEventListener {
  /**
   * Subscribe to attestation events
   * @param callback Function to call when events occur
   * @returns Promise resolving to subscription ID
   */
  subscribeToAttestationEvents(callback: (event: any) => void): Promise<AttestProtocolResponse<string>>

  /**
   * Subscribe to schema events
   * @param callback Function to call when events occur
   * @returns Promise resolving to subscription ID
   */
  subscribeToSchemaEvents(callback: (event: any) => void): Promise<AttestProtocolResponse<string>>

  /**
   * Unsubscribe from events
   * @param subscriptionId Subscription ID to cancel
   * @returns Promise resolving to void on success
   */
  unsubscribe(subscriptionId: string): Promise<AttestProtocolResponse<void>>
}