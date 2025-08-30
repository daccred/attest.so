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
  Attestation 
} from '@attestprotocol/stellar/dist/authority'
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
  async initialize(admin: string, tokenContractId: string, tokenWasmHash: Buffer): Promise<AttestProtocolResponse<void>> {
    try {
      const tx = await this.authorityClient.initialize({
        admin,
        token_contract_id: tokenContractId,
        token_wasm_hash: tokenWasmHash
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
   * Set registration fee (admin function)
   * @deprecated This method is no longer available in the contract
   */
  async adminSetRegistrationFee(
    _feeAmount: bigint,
    _tokenId: string
  ): Promise<AttestProtocolResponse<void>> {
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
  async attest(attestation: Attestation): Promise<AttestProtocolResponse<boolean>> {
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
  async revoke(attestation: Attestation): Promise<AttestProtocolResponse<boolean>> {
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