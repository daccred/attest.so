import { AttgestSDKResponse } from '../core/types';
import { AttestSDKBase } from '../core';

export class Attestations extends AttestSDKBase {
  async create(id: string): Promise<AttgestSDKResponse<string>> {
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

  async revoke(id: string): Promise<AttgestSDKResponse<string>> {
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
