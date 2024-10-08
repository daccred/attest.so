import { AttestSDKResponse } from '../core/types';
import { AttestSDKBase } from '../core';
export declare class Schemas extends AttestSDKBase {
    /**
     * Registers a new schema with a unique identifier.
     *
     * @param id The identifier for the schema to be registered.
     * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier of the registered schema.
     */
    register(id: string): Promise<AttestSDKResponse<string>>;
    /**
     * Retrieves a schema by its unique identifier.
     *
     * @param id The unique identifier of the schema to be retrieved.
     * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier of the retrieved schema.
     */
    retrieve(id: string): Promise<AttestSDKResponse<string>>;
    /**
     * Retrieves all unique identifiers (UIDs) of registered schemas.
     *
     * @returns A promise that resolves to an AttestSDKResponse object containing an array of schema UIDs.
     */
    protected getAllUIDs(): Promise<AttestSDKResponse<string[]>>;
    /**
     * Retrieves all schema records.
     *
     * @returns A promise that resolves to an AttestSDKResponse object containing an array of all schema records.
     */
    protected getAllSchemaRecords(): Promise<AttestSDKResponse<string[]>>;
}
