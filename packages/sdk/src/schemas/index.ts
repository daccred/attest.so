import { AttestSDKResponse } from '../core/types'
import { AttestSDKBase } from '../core'
import { PublicKey } from '@solana/web3.js'

export class Schemas extends AttestSDKBase {
  /**
   * Creates and registers a new schema with an optional reference schema.
   *
   * @param props - The properties required to create the schema.
   *    - schema: The main schema to be registered.
   *    - reference?: An optional reference schema to validate against.
   * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier (UID) of the registered schema or an error message if validation fails.
   */
  async register({
    schemaName,
    schemaContent,
    resolverAddress = null,
    revocable = true,
  }: {
    schemaName: string
    schemaContent: string
    resolverAddress?: PublicKey | null
    revocable?: boolean
  }): Promise<AttestSDKResponse<PublicKey>> {
    try {
      const res = await this.registerSchema({
        schemaName,
        schemaContent,
        resolverAddress,
        revocable,
      })

      return {
        data: res,
      }
    } catch (err) {
      return {
        error: err,
      }
    }
  }

  /**
   * Retrieves a schema by its unique identifier (UID).
   *
   * @param props - The properties required to retrieve the schema.
   *    - uid: The unique identifier of the schema to be retrieved.
   * @returns A promise that resolves to an AttestSDKResponse object containing the schema or an error message if the schema is not found.
   */
  async fetch(schemaUID: string): Promise<AttestSDKResponse<string>> {
    try {
      const res = await this.fetchSchema(schemaUID)

      return {
        data: res,
      }
    } catch (err) {
      return {
        error: err,
      }
    }
  }

  /**
   * Retrieves all unique identifiers (UIDs) of registered schemas.
   *
   * @param props - The properties required to retrieve schema UIDs.
   *    - uids: An optional array of UIDs to filter the retrieval.
   * @returns A promise that resolves to an AttestSDKResponse object containing an array of schema UIDs.
   */
  protected async getAllUIDs(): Promise<AttestSDKResponse<string[]>> {
    const uids = await this.fetchAllSchemaUIDs()

    return {
      data: uids,
    }
  }

  /**
   * Retrieves all registered schema records.
   *
   * @returns A promise that resolves to an AttestSDKResponse object containing an array of all schema records.
   */
  protected async getAllSchemaRecords(): Promise<AttestSDKResponse<string[]>> {
    const records = await this.fetchAllSchemaRecords()

    return {
      data: records,
    }
  }
}