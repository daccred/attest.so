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
}
