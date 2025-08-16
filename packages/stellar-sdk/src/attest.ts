/**
 * Attestation operations for the Stellar Attest Protocol
 */

import {
  AttestProtocolResponse,
  Attestation,
  AttestationDefinition,
  RevocationDefinition,
  DelegatedAttestationDefinition,
  DelegatedRevocationDefinition,
  ListAttestationsByWalletParams,
  ListAttestationsBySchemaParams,
  PaginatedResponse,
  AttestProtocolErrorType,
  createSuccessResponse,
  createErrorResponse,
  createAttestProtocolError,
} from '@attestprotocol/core'

import { Client as ProtocolClient } from '@attestprotocol/stellar/dist/bindings/src/protocol'
import { Address, xdr, scValToNative } from '@stellar/stellar-sdk'
import { StellarConfig } from './types'

export class StellarAttestationService {
  private protocolClient: ProtocolClient
  private publicKey: string

  constructor(config: StellarConfig, protocolClient: ProtocolClient) {
    this.protocolClient = protocolClient
    this.publicKey = config.publicKey
  }

  /**
   * Issue a new attestation on the Stellar network
   */
  async issueAttestation(
    config: AttestationDefinition
  ): Promise<AttestProtocolResponse<Attestation>> {
    try {
      const validationError = this.validateAttestationDefinition(config)
      if (validationError) return createErrorResponse(validationError)

      if (!/^[0-9a-fA-F]{64}$/.test(config.schemaUid)) {
        throw createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          'Invalid schema UID format. Must be a 64-character hex string.'
        )
      }

      const caller = this.publicKey
      const schemaUid = Buffer.from(config.schemaUid, 'hex')
      const subject = config.subject
      const value = config.data
      const reference = config.reference || null

      const tx = await this.protocolClient.attest({
        caller,
        schema_uid: schemaUid,
        subject,
        value,
        reference
      })

      const result = await tx.signAndSend()
      const timestamp = Date.now()

      return createSuccessResponse({
        uid: result.transactionHash || Date.now().toString(),
        schemaUid: config.schemaUid,
        subject: config.subject,
        attester: this.publicKey,
        data: config.data,
        timestamp,
        expirationTime: config.expirationTime || null,
        revocationTime: null,
        revoked: false,
        reference: config.reference || null,
      })
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to issue attestation'
        )
      )
    }
  }

  /**
   * Fetch an attestation by its ID
   */
  async fetchAttestationById(id: string): Promise<AttestProtocolResponse<Attestation | null>> {
    try {
      // The current protocol doesn't have direct UID-based lookup
      // This would require indexing or parsing transaction history
      return createSuccessResponse(null)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to fetch attestation'
        )
      )
    }
  }

  /**
   * Get an attestation by schema UID, subject, and reference
   */
  async getAttestation(
    schemaUid: string,
    subject: string,
    reference?: string
  ): Promise<AttestProtocolResponse<Attestation | null>> {
    try {
      if (!/^[0-9a-fA-F]{64}$/.test(schemaUid)) {
        throw createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          'Invalid schema UID format. Must be a 64-character hex string.'
        )
      }

      const schemaUidBuffer = Buffer.from(schemaUid, 'hex')
      
      const tx = await this.protocolClient.get_attestation({
        schema_uid: schemaUidBuffer,
        subject,
        reference: reference || null
      })

      const result = await tx.simulate()
      
      if (!result.result?.returnValue) {
        return createSuccessResponse(null)
      }

      const attestationRecord = scValToNative(result.result.returnValue)
      
      return createSuccessResponse({
        uid: `${schemaUid}-${subject}-${reference || 'default'}`,
        schemaUid,
        subject,
        attester: this.publicKey, // This should come from the contract
        data: attestationRecord.value,
        timestamp: Date.now(), // This should come from the contract
        expirationTime: null,
        revocationTime: null,
        revoked: attestationRecord.revoked || false,
        reference: attestationRecord.reference || null,
      })
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to get attestation'
        )
      )
    }
  }

  /**
   * List attestations by wallet address
   */
  async listAttestationsByWallet(
    params: ListAttestationsByWalletParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>> {
    try {
      // This would require indexing or event querying in a real implementation
      const emptyResponse: PaginatedResponse<Attestation> = {
        items: [],
        total: 0,
        limit: params.limit ?? 10,
        offset: params.offset ?? 0,
        hasMore: false
      }
      
      return createSuccessResponse(emptyResponse)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to list attestations by wallet'
        )
      )
    }
  }

  /**
   * List attestations by schema UID
   */
  async listAttestationsBySchema(
    params: ListAttestationsBySchemaParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>> {
    try {
      // This would require indexing or event querying in a real implementation
      const emptyResponse: PaginatedResponse<Attestation> = {
        items: [],
        total: 0,
        limit: params.limit ?? 10,
        offset: params.offset ?? 0,
        hasMore: false
      }
      
      return createSuccessResponse(emptyResponse)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to list attestations by schema'
        )
      )
    }
  }

  /**
   * Revoke an attestation
   */
  async revokeAttestation(config: RevocationDefinition): Promise<AttestProtocolResponse<void>> {
    try {
      const validationError = this.validateRevocationDefinition(config)
      if (validationError) return createErrorResponse(validationError)

      // For Stellar, we need to parse the attestation UID to extract schema UID and subject
      // This is a simplified implementation - in practice, you'd need a proper mapping
      // For now, we'll return an error indicating this needs to be implemented
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NOT_FOUND_ERROR,
          'Revocation by attestation UID not yet implemented. Use revokeAttestationByComponents instead.'
        )
      )
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to revoke attestation'
        )
      )
    }
  }

  /**
   * Revoke an attestation by its components (Stellar-specific)
   */
  async revokeAttestationByComponents(
    schemaUid: string,
    subject: string,
    reference?: string
  ): Promise<AttestProtocolResponse<void>> {
    try {
      if (!/^[0-9a-fA-F]{64}$/.test(schemaUid)) {
        throw createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          'Invalid schema UID format. Must be a 64-character hex string.'
        )
      }

      const caller = this.publicKey
      const schemaUidBuffer = Buffer.from(schemaUid, 'hex')

      const tx = await this.protocolClient.revoke_attestation({
        caller,
        schema_uid: schemaUidBuffer,
        subject,
        reference: reference || null
      })

      await tx.signAndSend()

      return createSuccessResponse(undefined)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to revoke attestation'
        )
      )
    }
  }

  /**
   * Attest by delegation (not implemented in current Stellar contracts)
   */
  async attestByDelegation(
    config: DelegatedAttestationDefinition
  ): Promise<AttestProtocolResponse<Attestation>> {
    return createErrorResponse(
      createAttestProtocolError(
        AttestProtocolErrorType.NOT_FOUND_ERROR,
        'Delegation not implemented in Stellar contracts'
      )
    )
  }

  /**
   * Revoke by delegation (not implemented in current Stellar contracts)
   */
  async revokeByDelegation(
    config: DelegatedRevocationDefinition
  ): Promise<AttestProtocolResponse<void>> {
    return createErrorResponse(
      createAttestProtocolError(
        AttestProtocolErrorType.NOT_FOUND_ERROR,
        'Delegation not implemented in Stellar contracts'
      )
    )
  }

  /**
   * Validate attestation definition
   */
  private validateAttestationDefinition(config: AttestationDefinition): any {
    if (!config.schemaUid || config.schemaUid.trim() === '') {
      return createAttestProtocolError(
        AttestProtocolErrorType.VALIDATION_ERROR,
        'Schema UID is required'
      )
    }

    if (!config.subject || config.subject.trim() === '') {
      return createAttestProtocolError(
        AttestProtocolErrorType.VALIDATION_ERROR,
        'Subject is required'
      )
    }

    try {
      Address.fromString(config.subject)
    } catch {
      return createAttestProtocolError(
        AttestProtocolErrorType.VALIDATION_ERROR,
        'Invalid subject address format'
      )
    }

    if (!config.data || config.data.trim() === '') {
      return createAttestProtocolError(
        AttestProtocolErrorType.VALIDATION_ERROR,
        'Attestation data is required'
      )
    }

    return null
  }

  /**
   * Validate revocation definition
   */
  private validateRevocationDefinition(config: RevocationDefinition): any {
    if (!config.attestationUid || config.attestationUid.trim() === '') {
      return createAttestProtocolError(
        AttestProtocolErrorType.VALIDATION_ERROR,
        'Attestation UID is required'
      )
    }

    return null
  }
}