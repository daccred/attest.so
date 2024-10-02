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

  /**
   * Retrieves all unique identifiers (UIDs) of registered schemas.
   *
   * @returns A promise that resolves to an AttestSDKResponse object containing an array of schema UIDs.
   */
  protected async getAllUIDs(): Promise<AttestSDKResponse<string[]>> {
    const uids = await this.fetchAllSchemaUIDs();

    return {
      data: uids,
    };
  }

  /**
   * Retrieves all schema records.
   *
   * @returns A promise that resolves to an AttestSDKResponse object containing an array of all schema records.
   */
  protected async getAllSchemaRecords(): Promise<AttestSDKResponse<string[]>> {
    const records = await this.fetchAllSchemaRecords();

    return {
      data: records,
    };
  }
}
