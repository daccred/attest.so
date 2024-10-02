import { AttgestSDKResponse } from '../core/types';
import { AttestSDKBase } from '../core';

export class Schemas extends AttestSDKBase {
  async register(id: string): Promise<AttgestSDKResponse<string>> {
    const uid = await this.generateUID();
    await this.storeSchema(uid);

    return {
      data: uid,
    };
  }

  async retrieve(id: string): Promise<AttgestSDKResponse<string>> {
    const uid = await this.generateUID();
    await this.storeSchema(uid);

    return {
      data: uid,
    };
  }
}
