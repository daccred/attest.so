import { AttestSDKBaseConfig, AttestSDKResponse } from '../core/types'
import { AttestSDKBase } from '../core'
import { CreateAttestationProps, AttestationUIDProp, GetAllAttestationsProps } from './props'
import { SolanaAttestationService } from '../core/chain-types/solana_attestation_service'
import idl from '../core/solana_attestation_service.json'
import { Idl } from '@coral-xyz/anchor'

export class Attestations extends AttestSDKBase<SolanaAttestationService> {
  constructor(config: Omit<AttestSDKBaseConfig, 'idl'>) {
    super({ idl: idl as Idl, ...config })
  }
  /**
   * Creates a new attestation based on the provided schema identifier.
   *
   * @param id The unique identifier of the schema for which the attestation is being created.
   * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier of the created attestation.
   */
  async create(props: CreateAttestationProps): Promise<AttestSDKResponse<string>> {
    const { schemaUID, data } = props
    // const valid = await this.verifySchema(schemaUID)

    // if (!valid) {
      return {
        error: 'Invalid schema',
      // }
    }

  }

  /**
   * Revokes an existing attestation by its unique identifier.
   *
   * @param id The unique identifier of the attestation to be revoked.
   * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier of the revoked attestation.
   */
  async revoke(props: AttestationUIDProp): Promise<AttestSDKResponse<string>> {
    const { attestationUID } = props

    const { error } = await this.verifyAttestationIsRevocable(attestationUID)

    if (error) return { error }

    const res = this.triggerResolver('resolver', {
      uid: attestationUID,
      status: 'revoked',
    })

    await this.updateAttestationStatus(attestationUID, 'revoked')

    return {
      data: attestationUID,
    }
  }

  /**
   * Retrieves the schema associated with a given schema identifier.
   *
   * @param id The unique identifier of the schema to retrieve.
   * @returns A promise that resolves to an AttestSDKResponse object containing the schema data.
   */
  protected async getSchema(id: string): Promise<AttestSDKResponse<string>> {
    // const schema = await this.fetchSchema(id)

    // if (!schema) {
    //   return {
    //     error: 'Schema not found',
    //   }
    // }

    return {
      data: 'schema',
    }


  }

  /**
   * Delegates an attestation to another entity.
   *
   * @param id The unique identifier of the attestation to delegate.
   * @param delegateTo The identifier of the entity to delegate the attestation to.
   * @returns A promise that resolves to an AttestSDKResponse object containing the delegation result.
   */
  protected async delegateAttestation(
    id: string,
    delegateTo: string
  ): Promise<AttestSDKResponse<boolean>> {
    const valid = await this.verifyAttestationUID(id)

    if (!valid) {
      return {
        error: 'Invalid attestation',
      }
    }

    const success = await this.performDelegation(id, delegateTo)

    return {
      data: success,
    }
  }

  /**
   * Retrieves a specific attestation by its unique identifier.
   *
   * @param id The unique identifier of the attestation to retrieve.
   * @returns A promise that resolves to an AttestSDKResponse object containing the attestation data.
   */
  protected async getAttestation(props: AttestationUIDProp): Promise<AttestSDKResponse<string>> {
    const { attestationUID } = props
    const attestation = await this.fetchAttestation(attestationUID)

    if (!attestation) {
      return {
        error: 'Attestation not found',
      }
    }

    return {
      data: attestation,
    }
  }

  /**
   * Retrieves all attestations associated with the current user or context.
   *
   * @returns A promise that resolves to an AttestSDKResponse object containing an array of attestation data.
   */
  protected async getAllAttestations(
    props: GetAllAttestationsProps
  ): Promise<AttestSDKResponse<string[]>> {
    const { schemaUID } = props
    const attestations = await this.fetchAllAttestations(schemaUID)

    return {
      data: attestations,
    }
  }

  /**
   * Checks if a given attestation is valid.
   *
   * @param id The unique identifier of the attestation to validate.
   * @returns A promise that resolves to an AttestSDKResponse object containing a boolean indicating the attestation's validity.
   */
  protected async isAttestationValid(
    props: AttestationUIDProp
  ): Promise<AttestSDKResponse<boolean>> {
    const { attestationUID } = props
    const valid = await this.verifyAttestationValidity(attestationUID)

    return {
      data: valid,
    }
  }

  /**
   * Retrieves the current timestamp from the attestation service.
   *
   * @returns A promise that resolves to an AttestSDKResponse object containing the current timestamp.
   */
  protected async getTimestamp(props: AttestationUIDProp): Promise<AttestSDKResponse<number>> {
    const { attestationUID } = props
    const timestamp = await this.fetchAttestationTimestamp(attestationUID)

    return {
      data: timestamp,
    }
  }

  /**
   * Retrieves the total number of attestations in the system.
   *
   * @returns A promise that resolves to an AttestSDKResponse object containing the number of attestations.
   */
  protected async getNumberOfAttestations(
    props: AttestationUIDProp
  ): Promise<AttestSDKResponse<number>> {
    const { attestationUID } = props
    const count = await this.fetchAttestationCount(attestationUID)

    return {
      data: count,
    }
  }
}
