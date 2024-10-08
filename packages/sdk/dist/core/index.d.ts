import { AttestSDKBaseConfig } from './types';
export declare abstract class AttestSDKBase {
    private privateKey;
    constructor(config: AttestSDKBaseConfig);
    protected generateUID(): Promise<string>;
    protected storeSchema(schema: string): Promise<string>;
    protected verifySchema(schema: string): Promise<boolean>;
    protected storeAttestation(attestation: string): Promise<string>;
    protected verifyAttestationUID(uid: string): Promise<boolean>;
    protected verifyAttestationIsRevocable(uid: string): Promise<boolean>;
    protected updateAttestationStatus(uid: string, status: string): Promise<boolean>;
    protected fetchSchema(id: string): Promise<string | null>;
    protected performDelegation(id: string, delegateTo: string): Promise<boolean>;
    protected fetchAttestation(id: string): Promise<string | null>;
    protected fetchAllAttestations(): Promise<string[]>;
    protected verifyAttestationValidity(id: string): Promise<boolean>;
    protected fetchCurrentTimestamp(): Promise<number>;
    protected fetchAttestationCount(): Promise<number>;
    protected fetchAllSchemaUIDs(): Promise<string[]>;
    protected fetchAllSchemaRecords(): Promise<string[]>;
}
