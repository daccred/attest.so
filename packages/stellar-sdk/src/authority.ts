/**
 * This module provides the Authority operations for the Stellar Attest Protocol.
 *
 * It serves as an implementation of our resolver standard, as defined in the
 * `@resolver.rs` file. The primary purpose of this module is to facilitate
 * internal operations that involve verified authorities within the Stellar
 * Attestation Protocol. These authorities have been authenticated through
 * their `stellar.toml` files, ensuring they meet the necessary criteria for
 * participation in the protocol.
 *
 * By adhering to the resolver standard, this module ensures that all authority
 * operations are conducted with the highest level of security and compliance,
 * leveraging the robust framework established in the resolver interface.
 * This includes critical functions such as attestation validation, economic
 * model enforcement, and post-processing hooks, all of which are essential
 * for maintaining the integrity and reliability of the Stellar Attestation
 * Protocol.
 *
 * @see {@link @resolver.rs} for the resolver standard implementation details.
 * @see {@link stellar.toml} for authority authentication criteria.
 */

import {
  AttestProtocolResponse,
  Authority,
  AttestProtocolErrorType,
  createSuccessResponse,
  createErrorResponse,
  createAttestProtocolError,
} from '@attestprotocol/core'

import { Client as AuthorityClient, Attestation } from '@attestprotocol/stellar/authority'
import { Address, scValToNative } from '@stellar/stellar-sdk'
import { StellarConfig } from './types'

export class AttestProtocolAuthority {
  private authorityClient: AuthorityClient
  private publicKey: string

  constructor(config: StellarConfig, authorityClient: AuthorityClient) {
    this.authorityClient = authorityClient
    this.publicKey = config.publicKey
  }

  /**
   * Initialize the authority contract
   */
  async initialize(
    admin: string,
    tokenContractId: string,
    tokenWasmHash: Buffer
  ): Promise<AttestProtocolResponse<void>> {
    try {
      const tx = await this.authorityClient.initialize({
        admin,
        token_contract_id: tokenContractId,
        token_wasm_hash: tokenWasmHash,
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
  async adminRegisterAuthority(authToReg: string, metadata: string): Promise<AttestProtocolResponse<void>> {
    try {
      const tx = await this.authorityClient.admin_register_authority({
        admin: this.publicKey,
        auth_to_reg: authToReg,
        metadata,
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
  async registerAuthority(authorityToReg: string, metadata: string): Promise<AttestProtocolResponse<void>> {
    try {
      const tx = await this.authorityClient.register_authority({
        caller: this.publicKey,
        authority_to_reg: authorityToReg,
        metadata,
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
  async isAuthority(authority: string): Promise<AttestProtocolResponse<any>> {
    try {
      const tx = await this.authorityClient.is_authority({ authority })
      const result = await tx.simulate()

      // Return the full result for SDK consumers to decide what they need
      return createSuccessResponse(result)
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
   * Set registration fee (admin function)
   * @deprecated This method is no longer available in the contract
   */
  async adminSetRegistrationFee(_feeAmount: bigint, _tokenId: string): Promise<AttestProtocolResponse<void>> {
    return createErrorResponse(
      createAttestProtocolError(
        AttestProtocolErrorType.NOT_FOUND_ERROR,
        'Setting registration fee is no longer supported in the contract'
      )
    )
  }

  /**
   * Process attestation through authority contract
   */
  async attest(attestation: Attestation): Promise<AttestProtocolResponse<any>> {
    try {
      const tx = await this.authorityClient.attest({ attestation })
      const result = await tx.signAndSend()

      // Return the full result for SDK consumers to decide what they need
      return createSuccessResponse(result)
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
  async revoke(attestation: Attestation): Promise<AttestProtocolResponse<any>> {
    try {
      const tx = await this.authorityClient.revoke({ attestation })
      const result = await tx.signAndSend()

      // Return the full result for SDK consumers to decide what they need
      return createSuccessResponse(result)
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
  async withdrawLevies(): Promise<AttestProtocolResponse<any>> {
    try {
      const tx = await this.authorityClient.withdraw_levies({
        caller: this.publicKey,
      })

      const result = await tx.signAndSend()

      // Return the full result for SDK consumers to decide what they need
      return createSuccessResponse(result)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(AttestProtocolErrorType.NETWORK_ERROR, error.message || 'Failed to withdraw levies')
      )
    }
  }

  /**
   * Get collected levies for an authority
   */
  async getCollectedLevies(authority: string): Promise<AttestProtocolResponse<any>> {
    try {
      const tx = await this.authorityClient.get_collected_levies({ authority })
      const result = await tx.simulate()

      // Return the full result for SDK consumers to decide what they need
      return createSuccessResponse(result)
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
  async getTokenId(): Promise<AttestProtocolResponse<any>> {
    try {
      const tx = await this.authorityClient.get_token_id()
      const result = await tx.simulate()

      // Return the full result for SDK consumers to decide what they need
      return createSuccessResponse(result)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(AttestProtocolErrorType.NETWORK_ERROR, error.message || 'Failed to get token ID')
      )
    }
  }

  /**
   * Get admin address
   */
  async getAdminAddress(): Promise<AttestProtocolResponse<any>> {
    try {
      const tx = await this.authorityClient.get_admin_address()
      const result = await tx.simulate()

      // Return the full result for SDK consumers to decide what they need
      return createSuccessResponse(result)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(AttestProtocolErrorType.NETWORK_ERROR, error.message || 'Failed to get admin address')
      )
    }
  }

  /**
   * Fetch authority information
   */
  async fetchAuthority(id: string): Promise<AttestProtocolResponse<any>> {
    try {
      const isAuthResult = await this.isAuthority(id)

      if (isAuthResult.error) {
        return isAuthResult
      }

      // Return the full result for SDK consumers to decide what they need
      return createSuccessResponse(isAuthResult)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(AttestProtocolErrorType.NETWORK_ERROR, error.message || 'Failed to fetch authority')
      )
    }
  }
}
