import { AttestSDKResponse } from '../core/types';
import { AttestSDKBase } from '../core';

export class Schemas extends AttestSDKBase {
  /**
   * Registers a new schema with a unique identifier.
   * 
   * @param id The identifier for the schema to be registered.
   * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier of the registered schema.
   */
  async register(id: string): Promise<AttestSDKResponse<string>> {
    const uid = await this.generateUID();
    await this.storeSchema(uid);

    return {
      data: uid,
    };
  }

  /**
   * Retrieves a schema by its unique identifier.
   * 
   * @param id The unique identifier of the schema to be retrieved.
   * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier of the retrieved schema.
   */
  async retrieve(id: string): Promise<AttestSDKResponse<string>> {
    const uid = await this.generateUID();
    await this.storeSchema(uid);

    return {
      data: uid,
    };
  }
}
