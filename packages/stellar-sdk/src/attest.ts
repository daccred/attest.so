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

import { Client as ProtocolClient } from '@attestprotocol/stellar/dist/protocol'
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
  async issueAttestation(config: AttestationDefinition): Promise<AttestProtocolResponse<Attestation>> {
    try {
      const validationError = this.validateAttestationDefinition(config)
      if (validationError) return createErrorResponse(validationError)

      if (!/^[0-9a-fA-F]{64}$/.test(config.schemaUid)) {
        throw createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          'Invalid schema UID format. Must be a 64-character hex string.'
        )
      }

      const attester = this.publicKey
      const schemaUid = Buffer.from(config.schemaUid, 'hex')
      const value = config.data
      const expiration_time = config.expirationTime || undefined

      // In the new protocol, attester is also the subject
      // TODO: Add support for attestations about other subjects via delegated attestations
      if (config.subject !== this.publicKey) {
        throw createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          'Direct attestations can only be made where attester is the subject. Use delegated attestation for other subjects.'
        )
      }

      const tx = await this.protocolClient.attest({
        attester,
        schema_uid: schemaUid,
        value,
        expiration_time,
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
        createAttestProtocolError(AttestProtocolErrorType.NETWORK_ERROR, error.message || 'Failed to issue attestation')
      )
    }
  }

  /**
   * Validate attestation definition
   */
  private validateAttestationDefinition(config: AttestationDefinition): any {
    if (!config.schemaUid || config.schemaUid.trim() === '') {
      return createAttestProtocolError(AttestProtocolErrorType.VALIDATION_ERROR, 'Schema UID is required')
    }

    if (!config.subject || config.subject.trim() === '') {
      return createAttestProtocolError(AttestProtocolErrorType.VALIDATION_ERROR, 'Subject is required')
    }

    // Validate subject as Stellar address
    try {
      Address.fromString(config.subject)
    } catch {
      return createAttestProtocolError(AttestProtocolErrorType.VALIDATION_ERROR, 'Invalid subject address format')
    }

    return null
  }

  /**
   * Fetch an attestation by its ID
   */
  async fetchAttestationById(id: string): Promise<AttestProtocolResponse<Attestation | null>> {
    try {
      // Convert the attestation UID string to Buffer
      const attestationUidBuffer = Buffer.from(id, 'hex')

      const tx = await this.protocolClient.get_attestation({
        attestation_uid: attestationUidBuffer,
      })

      const result = await tx.simulate()

      if (!result.result?.returnValue) {
        return createSuccessResponse(null)
      }

      const attestationRecord = scValToNative(result.result.returnValue)

      return createSuccessResponse({
        uid: id,
        schemaUid: Buffer.from(attestationRecord.schema_uid).toString('hex'),
        subject: attestationRecord.subject,
        attester: attestationRecord.attester,
        data: attestationRecord.value,
        timestamp: attestationRecord.timestamp || Date.now(),
        expirationTime: attestationRecord.expiration_time || null,
        revocationTime: attestationRecord.revocation_time || null,
        revoked: attestationRecord.revoked || false,
        reference: null, // Not in the new protocol
      })
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(AttestProtocolErrorType.NETWORK_ERROR, error.message || 'Failed to fetch attestation')
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

      // The new protocol doesn't support getting attestations by schema/subject/reference
      // It requires the attestation UID directly
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NOT_FOUND_ERROR,
          'Getting attestation by schema/subject/reference not supported. Use fetchAttestationById with attestation UID instead.'
        )
      )

      // Code unreachable due to early return above
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(AttestProtocolErrorType.NETWORK_ERROR, error.message || 'Failed to get attestation')
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
        hasMore: false,
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
        hasMore: false,
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

      // Convert the attestation UID string to Buffer
      const attestationUidBuffer = Buffer.from(config.attestationUid, 'hex')
      const revoker = this.publicKey

      const tx = await this.protocolClient.revoke({
        revoker,
        attestation_uid: attestationUidBuffer,
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
   * Revoke an attestation by its components (Stellar-specific)
   * @deprecated Use revokeAttestation with attestation UID instead
   */
  async revokeAttestationByComponents(
    _schemaUid: string,
    _subject: string,
    _reference?: string
  ): Promise<AttestProtocolResponse<void>> {
    try {
      // This method is deprecated as the new protocol requires attestation UID
      // Not the individual components
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NOT_FOUND_ERROR,
          'This method is deprecated. Use revokeAttestation with attestation UID instead.'
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
   * Attest by delegation (not implemented in current Stellar contracts)
   */
  async attestByDelegation(_config: DelegatedAttestationDefinition): Promise<AttestProtocolResponse<Attestation>> {
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
  async revokeByDelegation(_config: DelegatedRevocationDefinition): Promise<AttestProtocolResponse<void>> {
    return createErrorResponse(
      createAttestProtocolError(
        AttestProtocolErrorType.NOT_FOUND_ERROR,
        'Delegation not implemented in Stellar contracts'
      )
    )
  }

  /**
   * Validate revocation definition
   */
  private validateRevocationDefinition(config: RevocationDefinition): any {
    if (!config.attestationUid || config.attestationUid.trim() === '') {
      return createAttestProtocolError(AttestProtocolErrorType.VALIDATION_ERROR, 'Attestation UID is required')
    }

    return null
  }
}
