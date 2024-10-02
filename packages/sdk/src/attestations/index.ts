import { AttestSDKResponse } from '../core/types';
import { AttestSDKBase } from '../core';

export class Attestations extends AttestSDKBase {
  /**
   * Creates a new attestation based on the provided schema identifier.
   *
   * @param id The unique identifier of the schema for which the attestation is being created.
   * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier of the created attestation.
   */
  async create(id: string): Promise<AttestSDKResponse<string>> {
    const valid = await this.verifySchema(id);

    if (!valid) {
      return {
        error: 'Invalid schema',
      };
    }

    const uid = await this.generateUID();
    await this.storeAttestation(uid);

    return {
      data: uid,
    };
  }

  /**
   * Revokes an existing attestation by its unique identifier.
   *
   * @param id The unique identifier of the attestation to be revoked.
   * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier of the revoked attestation.
   */
  async revoke(id: string): Promise<AttestSDKResponse<string>> {
    const valid = await this.verifyAttestationUID(id);

    if (!valid) {
      return {
        error: 'Invalid attestation',
      };
    }

    const isRevocable = await this.verifyAttestationIsRevocable(id);

    if (!isRevocable) {
      return {
        error: 'Attestation is not revocable',
      };
    }

    await this.updateAttestationStatus(id, 'revoked');

    return {
      data: id,
    };
  }

  /**
   * Retrieves the schema associated with a given schema identifier.
   *
   * @param id The unique identifier of the schema to retrieve.
   * @returns A promise that resolves to an AttestSDKResponse object containing the schema data.
   */
  protected async getSchema(id: string): Promise<AttestSDKResponse<string>> {
    const schema = await this.fetchSchema(id);

    if (!schema) {
      return {
        error: 'Schema not found',
      };
    }

    return {
      data: schema,
    };
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
    delegateTo: string,
  ): Promise<AttestSDKResponse<boolean>> {
    const valid = await this.verifyAttestationUID(id);

    if (!valid) {
      return {
        error: 'Invalid attestation',
      };
    }

    const success = await this.performDelegation(id, delegateTo);

    return {
      data: success,
    };
  }

  /**
   * Retrieves a specific attestation by its unique identifier.
   *
   * @param id The unique identifier of the attestation to retrieve.
   * @returns A promise that resolves to an AttestSDKResponse object containing the attestation data.
   */
  protected async getAttestation(
    id: string,
  ): Promise<AttestSDKResponse<string>> {
    const attestation = await this.fetchAttestation(id);

    if (!attestation) {
      return {
        error: 'Attestation not found',
      };
    }

    return {
      data: attestation,
    };
  }

  /**
   * Retrieves all attestations associated with the current user or context.
   *
   * @returns A promise that resolves to an AttestSDKResponse object containing an array of attestation data.
   */
  protected async getAllAttestations(): Promise<AttestSDKResponse<string[]>> {
    const attestations = await this.fetchAllAttestations();

    return {
      data: attestations,
    };
  }

  /**
   * Checks if a given attestation is valid.
   *
   * @param id The unique identifier of the attestation to validate.
   * @returns A promise that resolves to an AttestSDKResponse object containing a boolean indicating the attestation's validity.
   */
  protected async isAttestationValid(
    id: string,
  ): Promise<AttestSDKResponse<boolean>> {
    const valid = await this.verifyAttestationValidity(id);

    return {
      data: valid,
    };
  }

  /**
   * Retrieves the current timestamp from the attestation service.
   *
   * @returns A promise that resolves to an AttestSDKResponse object containing the current timestamp.
   */
  protected async getTimestamp(): Promise<AttestSDKResponse<number>> {
    const timestamp = await this.fetchCurrentTimestamp();

    return {
      data: timestamp,
    };
  }

  /**
   * Retrieves the total number of attestations in the system.
   *
   * @returns A promise that resolves to an AttestSDKResponse object containing the number of attestations.
   */
  protected async getNumberOfAttestations(): Promise<
    AttestSDKResponse<number>
  > {
    const count = await this.fetchAttestationCount();

    return {
      data: count,
    };
  }
}
