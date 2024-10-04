import { AttestSDKResponse } from '../core/types';
import { AttestSDKBase } from '../core';
import {
  CreateSchemaProps,
  GetAllSchemaUIDsProps,
  GetSchemaProps,
} from './props';
export class Schemas extends AttestSDKBase {
  /**
   * Creates and registers a new schema with an optional reference schema.
   *
   * @param props - The properties required to create the schema.
   *    - schema: The main schema to be registered.
   *    - reference?: An optional reference schema to validate against.
   * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier (UID) of the registered schema or an error message if validation fails.
   */
  async create(props: CreateSchemaProps): Promise<AttestSDKResponse<string>> {
    const { schema, reference, resolver } = props;

    const schemaIsValid = await this.validateSchema(schema);

    if (!schemaIsValid) {
      return {
        error: 'Invalid schema',
      };
    }

    if (reference) {
      const referenceIsValid = await this.validateSchema(reference);

      if (!referenceIsValid) {
        return {
          error: 'Invalid reference',
        };
      }
    }

    const uid = await this.storeSchema(schema);

    return {
      data: uid,
    };
  }

  /**
   * Retrieves a schema by its unique identifier (UID).
   *
   * @param props - The properties required to retrieve the schema.
   *    - uid: The unique identifier of the schema to be retrieved.
   * @returns A promise that resolves to an AttestSDKResponse object containing the schema or an error message if the schema is not found.
   */
  async get(props: GetSchemaProps): Promise<AttestSDKResponse<string>> {
    const { uid } = props;

    const schema = await this.fetchSchema(uid);

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
   * Retrieves all unique identifiers (UIDs) of registered schemas.
   *
   * @param props - The properties required to retrieve schema UIDs.
   *    - uids: An optional array of UIDs to filter the retrieval.
   * @returns A promise that resolves to an AttestSDKResponse object containing an array of schema UIDs.
   */
  protected async getAllUIDs(
    props: GetAllSchemaUIDsProps,
  ): Promise<AttestSDKResponse<string[]>> {
    const { uids } = props;
    const schemaUIDs = await this.fetchAllSchemaUIDs(uids);

    return {
      data: schemaUIDs,
    };
  }

  /**
   * Retrieves all registered schema records.
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