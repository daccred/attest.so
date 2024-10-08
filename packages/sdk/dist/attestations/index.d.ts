import { AttestSDKResponse } from '../core/types';
import { AttestSDKBase } from '../core';
export declare class Attestations extends AttestSDKBase {
    /**
     * Creates a new attestation based on the provided schema identifier.
     *
     * @param id The unique identifier of the schema for which the attestation is being created.
     * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier of the created attestation.
     */
    create(id: string): Promise<AttestSDKResponse<string>>;
    /**
     * Revokes an existing attestation by its unique identifier.
     *
     * @param id The unique identifier of the attestation to be revoked.
     * @returns A promise that resolves to an AttestSDKResponse object containing the unique identifier of the revoked attestation.
     */
    revoke(id: string): Promise<AttestSDKResponse<string>>;
    /**
     * Retrieves the schema associated with a given schema identifier.
     *
     * @param id The unique identifier of the schema to retrieve.
     * @returns A promise that resolves to an AttestSDKResponse object containing the schema data.
     */
    protected getSchema(id: string): Promise<AttestSDKResponse<string>>;
    /**
     * Delegates an attestation to another entity.
     *
     * @param id The unique identifier of the attestation to delegate.
     * @param delegateTo The identifier of the entity to delegate the attestation to.
     * @returns A promise that resolves to an AttestSDKResponse object containing the delegation result.
     */
    protected delegateAttestation(id: string, delegateTo: string): Promise<AttestSDKResponse<boolean>>;
    /**
     * Retrieves a specific attestation by its unique identifier.
     *
     * @param id The unique identifier of the attestation to retrieve.
     * @returns A promise that resolves to an AttestSDKResponse object containing the attestation data.
     */
    protected getAttestation(id: string): Promise<AttestSDKResponse<string>>;
    /**
     * Retrieves all attestations associated with the current user or context.
     *
     * @returns A promise that resolves to an AttestSDKResponse object containing an array of attestation data.
     */
    protected getAllAttestations(): Promise<AttestSDKResponse<string[]>>;
    /**
     * Checks if a given attestation is valid.
     *
     * @param id The unique identifier of the attestation to validate.
     * @returns A promise that resolves to an AttestSDKResponse object containing a boolean indicating the attestation's validity.
     */
    protected isAttestationValid(id: string): Promise<AttestSDKResponse<boolean>>;
    /**
     * Retrieves the current timestamp from the attestation service.
     *
     * @returns A promise that resolves to an AttestSDKResponse object containing the current timestamp.
     */
    protected getTimestamp(): Promise<AttestSDKResponse<number>>;
    /**
     * Retrieves the total number of attestations in the system.
     *
     * @returns A promise that resolves to an AttestSDKResponse object containing the number of attestations.
     */
    protected getNumberOfAttestations(): Promise<AttestSDKResponse<number>>;
}
