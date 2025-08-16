/**
 * Authority operations for the Stellar Attest Protocol
 */

import {
  AttestProtocolResponse,
  Authority,
  AttestProtocolErrorType,
  createSuccessResponse,
  createErrorResponse,
  createAttestProtocolError,
} from '@attestprotocol/core'

import { 
  Client as AuthorityClient,
  SchemaRules,
  AttestationRecord 
} from '@attestprotocol/stellar/dist/bindings/src/authority'
import { Address, scValToNative } from '@stellar/stellar-sdk'
import { StellarConfig } from './types'

export class StellarAuthorityService {
  private authorityClient: AuthorityClient
  private publicKey: string

  constructor(config: StellarConfig, authorityClient: AuthorityClient) {
    this.authorityClient = authorityClient
    this.publicKey = config.publicKey
  }

  /**
   * Initialize the authority contract
   */
  async initialize(admin: string, tokenContractId: string): Promise<AttestProtocolResponse<void>> {
    try {
      const tx = await this.authorityClient.initialize({
        admin,
        token_contract_id: tokenContractId
      })

      await tx.signAndSend()

      return createSuccessResponse(undefined)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to initialize authority contract'
        )
      )
    }
  }

  /**
   * Register an authority (admin function)
   */
  async adminRegisterAuthority(
    authToReg: string,
    metadata: string
  ): Promise<AttestProtocolResponse<void>> {
    try {
      const tx = await this.authorityClient.admin_register_authority({
        admin: this.publicKey,
        auth_to_reg: authToReg,
        metadata
      })

      await tx.signAndSend()

      return createSuccessResponse(undefined)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to register authority'
        )
      )
    }
  }

  /**
   * Register an authority (public function with fees)
   */
  async registerAuthority(
    authorityToReg: string,
    metadata: string
  ): Promise<AttestProtocolResponse<void>> {
    try {
      const tx = await this.authorityClient.register_authority({
        caller: this.publicKey,
        authority_to_reg: authorityToReg,
        metadata
      })

      await tx.signAndSend()

      return createSuccessResponse(undefined)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to register authority'
        )
      )
    }
  }

  /**
   * Check if an address is an authority
   */
  async isAuthority(authority: string): Promise<AttestProtocolResponse<boolean>> {
    try {
      const tx = await this.authorityClient.is_authority({ authority })
      const result = await tx.simulate()

      if (!result.result?.returnValue) {
        return createSuccessResponse(false)
      }

      const isAuth = scValToNative(result.result.returnValue)
      return createSuccessResponse(isAuth)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to check authority status'
        )
      )
    }
  }

  /**
   * Register schema rules (admin function)
   */
  async adminRegisterSchema(
    schemaUid: Buffer,
    rules: SchemaRules
  ): Promise<AttestProtocolResponse<void>> {
    try {
      const tx = await this.authorityClient.admin_register_schema({
        admin: this.publicKey,
        schema_uid: schemaUid,
        rules
      })

      await tx.signAndSend()

      return createSuccessResponse(undefined)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to register schema rules'
        )
      )
    }
  }

  /**
   * Set schema levy (admin function)
   */
  async adminSetSchemaLevy(
    schemaUid: Buffer,
    levyAmount: bigint,
    levyRecipient: string
  ): Promise<AttestProtocolResponse<void>> {
    try {
      const tx = await this.authorityClient.admin_set_schema_levy({
        admin: this.publicKey,
        schema_uid: schemaUid,
        levy_amount: levyAmount,
        levy_recipient: levyRecipient
      })

      await tx.signAndSend()

      return createSuccessResponse(undefined)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to set schema levy'
        )
      )
    }
  }

  /**
   * Set registration fee (admin function)
   */
  async adminSetRegistrationFee(
    feeAmount: bigint,
    tokenId: string
  ): Promise<AttestProtocolResponse<void>> {
    try {
      const tx = await this.authorityClient.admin_set_registration_fee({
        admin: this.publicKey,
        fee_amount: feeAmount,
        token_id: tokenId
      })

      await tx.signAndSend()

      return createSuccessResponse(undefined)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to set registration fee'
        )
      )
    }
  }

  /**
   * Process attestation through authority contract
   */
  async attest(attestation: AttestationRecord): Promise<AttestProtocolResponse<boolean>> {
    try {
      const tx = await this.authorityClient.attest({ attestation })
      const result = await tx.signAndSend()

      if (!result.returnValue) {
        return createSuccessResponse(false)
      }

      const success = scValToNative(result.returnValue)
      return createSuccessResponse(success)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to process attestation'
        )
      )
    }
  }

  /**
   * Process revocation through authority contract
   */
  async revoke(attestation: AttestationRecord): Promise<AttestProtocolResponse<boolean>> {
    try {
      const tx = await this.authorityClient.revoke({ attestation })
      const result = await tx.signAndSend()

      if (!result.returnValue) {
        return createSuccessResponse(false)
      }

      const success = scValToNative(result.returnValue)
      return createSuccessResponse(success)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to process revocation'
        )
      )
    }
  }

  /**
   * Withdraw collected levies
   */
  async withdrawLevies(): Promise<AttestProtocolResponse<void>> {
    try {
      const tx = await this.authorityClient.withdraw_levies({
        caller: this.publicKey
      })

      await tx.signAndSend()

      return createSuccessResponse(undefined)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to withdraw levies'
        )
      )
    }
  }

  /**
   * Get schema rules
   */
  async getSchemaRules(schemaUid: Buffer): Promise<AttestProtocolResponse<SchemaRules | null>> {
    try {
      const tx = await this.authorityClient.get_schema_rules({ schema_uid: schemaUid })
      const result = await tx.simulate()

      if (!result.result?.returnValue) {
        return createSuccessResponse(null)
      }

      const rules = scValToNative(result.result.returnValue)
      return createSuccessResponse(rules)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to get schema rules'
        )
      )
    }
  }

  /**
   * Get collected levies for an authority
   */
  async getCollectedLevies(authority: string): Promise<AttestProtocolResponse<bigint>> {
    try {
      const tx = await this.authorityClient.get_collected_levies({ authority })
      const result = await tx.simulate()

      if (!result.result?.returnValue) {
        return createSuccessResponse(BigInt(0))
      }

      const levies = scValToNative(result.result.returnValue)
      return createSuccessResponse(BigInt(levies))
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to get collected levies'
        )
      )
    }
  }

  /**
   * Get token ID
   */
  async getTokenId(): Promise<AttestProtocolResponse<string>> {
    try {
      const tx = await this.authorityClient.get_token_id()
      const result = await tx.simulate()

      if (!result.result?.returnValue) {
        throw new Error('No token ID returned')
      }

      const tokenId = scValToNative(result.result.returnValue)
      return createSuccessResponse(tokenId)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to get token ID'
        )
      )
    }
  }

  /**
   * Get admin address
   */
  async getAdminAddress(): Promise<AttestProtocolResponse<string>> {
    try {
      const tx = await this.authorityClient.get_admin_address()
      const result = await tx.simulate()

      if (!result.result?.returnValue) {
        throw new Error('No admin address returned')
      }

      const admin = scValToNative(result.result.returnValue)
      return createSuccessResponse(admin)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to get admin address'
        )
      )
    }
  }

  /**
   * Fetch authority information
   */
  async fetchAuthority(id: string): Promise<AttestProtocolResponse<Authority | null>> {
    try {
      const isAuthResult = await this.isAuthority(id)
      
      if (isAuthResult.error || !isAuthResult.data) {
        return createSuccessResponse(null)
      }

      // For now, return basic authority info
      // In a real implementation, we'd need to get metadata from contract storage or events
      return createSuccessResponse({
        id,
        isVerified: true,
        metadata: 'Authority metadata', // This should come from contract storage
      })
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to fetch authority'
        )
      )
    }
  }
}