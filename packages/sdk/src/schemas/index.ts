import { AttestSDKBaseConfig, AttestSDKResponse } from '../core/types'
import { AttestSDKBase } from '../core'
import { PublicKey, Transaction } from '@solana/web3.js'
import { Idl } from '@coral-xyz/anchor'

import idl from '../core/schema_registry.json'
import { SchemaRegistry } from '../core/chain-types/schema_registry'

export class Schemas extends AttestSDKBase<SchemaRegistry> {
  constructor(config: Omit<AttestSDKBaseConfig, 'idl'>) {
    super({ idl: idl as Idl, ...config })
  }

  /**
   * Creates and registers a new schema with an optional reference schema.
   *
   * @param props - The properties required to create the schema.
   *    - schema: The main schema to be registered.
   *    - reference?: An optional reference schema to validate against.
   * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier (UID) of the registered schema or an error message if validation fails.
   */
  async generate({
    schemaName,
    schemaContent,
    resolverAddress = null,
    revocable = true,
  }: {
    schemaName: string
    schemaContent: string
    resolverAddress?: PublicKey | null
    revocable?: boolean
  }): Promise<
    AttestSDKResponse<{
      uid: PublicKey
      tx: Transaction
    }>
  > {
    try {
      const [schemaDataPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('schema'), this.wallet.publicKey.toBuffer(), Buffer.from(schemaName)],
        this.program.programId
      )

      const instruction = await this.program.methods
        .register(schemaName, schemaContent, resolverAddress, revocable)
        .accounts({
          deployer: this.wallet.publicKey,
        })
        .instruction()

      const schemaUID = schemaDataPDA

      const transaction = new Transaction().add(instruction)
      transaction.feePayer = this.wallet.publicKey
      const blockhash = await this.connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash.blockhash

      return {
        data: {
          uid: schemaUID,
          tx: transaction,
        },
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
      const schemaAccount = await this.program.account.schemaData.fetch(schemaUID)

      return {
        data: schemaAccount.schema,
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
  async getAllSchemaForWallet() {
    return await this.fetchAllSchemaForWallet()
  }

  /**
   * Retrieves all registered schema records.
   *
   * @returns A promise that resolves to an AttestSDKResponse object containing an array of all schema records.
   */
  async getAllSchemaRecords() {
    return await this.fetchAllSchemaRecords()
  }
}