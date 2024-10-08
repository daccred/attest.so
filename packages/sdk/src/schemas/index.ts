import { AttestSDKResponse } from '../core/types'
import { AttestSDKBase } from '../core'
import { PublicKey } from '@solana/web3.js'

export class Schemas extends AttestSDKBase {
  /**
   * Registers a new schema with a unique identifier.
   *
   * @param id The identifier for the schema to be registered.
   * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier of the registered schema.
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
   * Retrieves a schema by its unique identifier.
   *
   * @param id The unique identifier of the schema to be retrieved.
   * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier of the retrieved schema.
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
   * @returns A promise that resolves to an AttestSDKResponse object containing an array of schema UIDs.
   */
  protected async getAllUIDs(): Promise<AttestSDKResponse<string[]>> {
    const uids = await this.fetchAllSchemaUIDs()

    return {
      data: uids,
    }
  }

  /**
   * Retrieves all schema records.
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
