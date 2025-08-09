/**
 * Starknet implementation of the Attest Protocol SDK
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
  createAttestProtocolError
} from '@attestprotocol/core'

import {
  StarknetConfig,
  StarknetSchemaConfig,
  StarknetAttestationConfig,
  StarknetRevokeAttestationConfig,
  StarknetFetchAuthorityResult,
  StarknetFetchSchemaResult,
  StarknetFetchAttestationResult,
  StarknetDelegatedAttestationConfig,
  StarknetDelegatedRevocationConfig
} from './types'

import {
  Account,
  Contract,
  RpcProvider,
  stark,
  uint256,
  CallData,
  InvokeTransactionReceiptResponse
} from 'starknet'

// Default contract address - should be updated when contracts are deployed
const DEFAULT_CONTRACT_ADDRESS = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

/**
 * Starknet implementation of the Attest SDK
 */
export class StarknetAttestProtocol extends AttestProtocolBase {
  private provider: RpcProvider
  private account: Account
  private contract: Contract
  private contractAddress: string

  constructor(config: StarknetConfig) {
    super(config)

    const providerUrl = config.url || 'https://starknet-goerli.g.alchemy.com/v2/your-api-key'
    this.provider = new RpcProvider({ 
      nodeUrl: providerUrl
    })

    this.account = new Account(
      this.provider,
      config.accountAddress,
      config.privateKey
    )

    this.contractAddress = config.contractAddress || DEFAULT_CONTRACT_ADDRESS

    // Initialize contract - in a real implementation, this would use the actual ABI
    this.contract = new Contract(
      [], // ABI would go here
      this.contractAddress,
      this.provider
    )
  }

  protected getDefaultNetworkUrl(): string {
    return 'https://starknet-goerli.g.alchemy.com/v2/demo'
  }

  /**
   * Initialize the SDK
   */
  async initialize(): Promise<AttestProtocolResponse<void>> {
    return this.safeExecute(async () => {
      // Verify account exists and has balance
      try {
        // Simple validation - in a real implementation you'd check balance
        if (!this.account.address) {
          throw new Error('Invalid account address')
        }
      } catch (error) {
        throw createAttestProtocolError(
          AttestProtocolErrorType.AUTHORIZATION_ERROR,
          'Account not found or insufficient balance'
        )
      }

      this.initialized = true
    })
  }

  // Authority Management

  async registerAuthority(): Promise<AttestProtocolResponse<string>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // Call register_authority function on the contract
      const calldata = CallData.compile([])

      const { transaction_hash } = await this.account.execute({
        contractAddress: this.contractAddress,
        entrypoint: 'register_authority',
        calldata
      })

      await this.provider.waitForTransaction(transaction_hash)
      return this.account.address
    })
  }

  async fetchAuthority(id: string): Promise<AttestProtocolResponse<Authority | null>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      try {
        const result = await this.contract.call('get_authority', [id])

        if (result) {
          // Simplified response - in real implementation you'd parse the actual contract response
          return {
            id: id,
            isVerified: true,
            metadata: 'Authority metadata',
            registrationTime: Date.now()
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
      const calldata = CallData.compile([
        config.content,
        config.resolver || '0',
        config.revocable ? 1 : 0
      ])

      const { transaction_hash } = await this.account.execute({
        contractAddress: this.contractAddress,
        entrypoint: 'create_schema',
        calldata
      })

      const receipt = await this.provider.waitForTransaction(transaction_hash) as InvokeTransactionReceiptResponse

      // Extract schema UID from events or return value
      let schemaUid = transaction_hash // Fallback to transaction hash

      // In a real implementation, you would parse the events to get the actual schema UID
      
      return {
        uid: schemaUid,
        definition: config.content,
        authority: this.account.address,
        revocable: config.revocable ?? true,
        resolver: config.resolver || null,
        levy: config.levy || null
      }
    })
  }

  async fetchSchemaById(id: string): Promise<AttestProtocolResponse<Schema | null>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      try {
        const result = await this.contract.call('get_schema', [id])

        if (result) {
          // Simplified response - in real implementation you'd parse the actual contract response
          return {
            uid: id,
            definition: 'Schema definition',
            authority: this.account.address,
            revocable: true,
            resolver: null,
            levy: null
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
      // Generate a deterministic ID based on schema content and authority
      const content = `${this.account.address}:${schema.name}:${schema.content}`
      const encoder = new TextEncoder()
      const data = encoder.encode(content)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    })
  }

  async listSchemasByIssuer(params: ListSchemasByIssuerParams): Promise<AttestProtocolResponse<PaginatedResponse<Schema>>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // This would require indexing or event querying in a real implementation
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
      const calldata = CallData.compile([
        config.schemaUid,
        config.subject,
        config.data,
        config.expirationTime || 0,
        config.reference || ''
      ])

      const { transaction_hash } = await this.account.execute({
        contractAddress: this.contractAddress,
        entrypoint: 'create_attestation',
        calldata
      })

      await this.provider.waitForTransaction(transaction_hash)

      const timestamp = Date.now()

      return {
        uid: transaction_hash, // In practice, this would be extracted from events
        schemaUid: config.schemaUid,
        subject: config.subject,
        attester: this.account.address,
        data: config.data,
        timestamp,
        expirationTime: config.expirationTime || null,
        revocationTime: null,
        revoked: false,
        reference: config.reference || null
      }
    })
  }

  async fetchAttestationById(id: string): Promise<AttestProtocolResponse<Attestation | null>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      try {
        const result = await this.contract.call('get_attestation', [id])

        if (result) {
          // Simplified response - in real implementation you'd parse the actual contract response
          return {
            uid: id,
            schemaUid: 'schema-uid',
            subject: 'subject-address',
            attester: this.account.address,
            data: 'attestation data',
            timestamp: Date.now(),
            expirationTime: null,
            revocationTime: null,
            revoked: false,
            reference: null
          }
        }
      } catch (error) {
        // Attestation not found
      }

      return null
    })
  }

  async listAttestationsByWallet(params: ListAttestationsByWalletParams): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // This would require indexing or event querying in a real implementation
      return this.createPaginatedResponse([], 0, params.limit ?? 10, params.offset ?? 0)
    })
  }

  async listAttestationsBySchema(params: ListAttestationsBySchemaParams): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // This would require indexing or event querying in a real implementation
      return this.createPaginatedResponse([], 0, params.limit ?? 10, params.offset ?? 0)
    })
  }

  async revokeAttestation(config: RevocationDefinition): Promise<AttestProtocolResponse<void>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    const validationError = this.validateRevocationDefinition(config)
    if (validationError) return createErrorResponse(validationError)

    return this.safeExecute(async () => {
      const calldata = CallData.compile([
        config.attestationUid,
        config.reference || ''
      ])

      const { transaction_hash } = await this.account.execute({
        contractAddress: this.contractAddress,
        entrypoint: 'revoke_attestation',
        calldata
      })

      await this.provider.waitForTransaction(transaction_hash)
    })
  }

  // Delegation

  async attestByDelegation(config: DelegatedAttestationDefinition): Promise<AttestProtocolResponse<Attestation>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // Implementation would depend on delegation logic in Starknet contracts
      throw createAttestProtocolError(
        AttestProtocolErrorType.NOT_FOUND_ERROR,
        'Delegation not fully implemented'
      )
    })
  }

  async revokeByDelegation(config: DelegatedRevocationDefinition): Promise<AttestProtocolResponse<void>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // Implementation would depend on delegation logic in Starknet contracts
      throw createAttestProtocolError(
        AttestProtocolErrorType.NOT_FOUND_ERROR,
        'Delegation not fully implemented'
      )
    })
  }

  // Starknet-specific helper methods

  /**
   * Normalize Starknet address format
   */
  protected normalizeAddress(address: string): string {
    // Ensure address starts with 0x and is proper length
    if (!address.startsWith('0x')) {
      address = '0x' + address
    }
    return address.toLowerCase()
  }

  /**
   * Get account balance
   */
  async getAccountBalance(): Promise<AttestProtocolResponse<string>> {
    return this.safeExecute(async () => {
      // Simplified implementation - in real implementation you'd call provider.getBalance
      return '1000000000000000000' // 1 ETH in wei
    })
  }

  /**
   * Get contract nonce for the account
   */
  async getAccountNonce(): Promise<AttestProtocolResponse<string>> {
    return this.safeExecute(async () => {
      // Simplified implementation - in real implementation you'd call provider.getNonce
      return '0'
    })
  }
}