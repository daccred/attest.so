import { AttestSDKBaseConfig, AttestSDKResponse } from './types';

export abstract class AttestSDKBase {
  private privateKey: string | undefined;

  protected DEFAULT_RESOLVER = 'https://schema.attest.so/resolver';

  constructor(config: AttestSDKBaseConfig) {
    this.privateKey = config.privateKey;
  }

  protected async generateUID(): Promise<string> {
    // Implementation to generate UID
    return 'magic-uid' + Math.random().toString(36).substring(2, 15);
  }

  protected async storeSchema(schema: string): Promise<string> {
    // Implementation to store schema
    return this.generateUID();
  }

  protected async validateSchema(schema: string): Promise<boolean> {
    // Implementation to verify schema
    return true;
  }

  protected async verifySchema(schemaUID: string): Promise<string | null> {
    // Implementation to verify schema
    return 'schema';
  }

  protected async createAttestation(
    schemaUID: string,
    data: any,
    resolver?: string,
  ): Promise<string | null> {
    // trigger resolver

    const response = await this.triggerResolver(
      resolver || this.DEFAULT_RESOLVER,
      data,
    );

    return this.generateUID();
  }

  protected async triggerResolver(
    resolver: string,
    data: any,
  ): Promise<string> {
    // trigger resolver

    return 'response';
  }

  protected async storeAttestation(attestation: string): Promise<string> {
    // Implementation to store attestation
    return this.generateUID();
  }

  protected async verifyAttestationUID(uid: string): Promise<boolean> {
    // Implementation to verify attestation UID
    return true;
  }

  protected async verifyAttestationIsRevocable(
    uid: string,
  ): Promise<AttestSDKResponse<string>> {
    // Implementation to verify attestation revocable

    const valid = await this.verifyAttestationUID(uid);

    if (!valid) {
      return {
        error: 'Invalid attestation',
      };
    }

    return {
      data: 'revocable',
    };
  }

  protected async updateAttestationStatus(
    uid: string,
    status: string,
  ): Promise<boolean> {
    return true;
  }

  protected async fetchSchema(uid: string): Promise<string | null> {
    // Implementation to fetch schema data
    return null;
  }

  protected async performDelegation(
    id: string,
    delegateTo: string,
  ): Promise<boolean> {
    // Implementation to perform attestation delegation
    return true;
  }

  protected async fetchAttestation(uid: string): Promise<any | null> {
    // Implementation to fetch attestation data
    return null;
  }

  protected async fetchAllAttestations(schemaUID: string): Promise<string[]> {
    // Implementation to fetch all attestations
    return [];
  }

  protected async verifyAttestationValidity(id: string): Promise<boolean> {
    // Implementation to verify attestation validity
    return true;
  }

  protected async fetchAttestationTimestamp(
    attestationUID: string,
  ): Promise<number> {
    // Implementation to fetch current timestamp
    return Date.now();
  }

  protected async fetchAttestationCount(uid: string): Promise<number> {
    // Implementation to fetch total number of attestations
    return 0;
  }

  protected async fetchAllSchemaUIDs(uids?: string[]): Promise<string[]> {
    // Implementation to fetch all schema UIDs
    return [];
  }

  protected async fetchAllSchemaRecords(): Promise<string[]> {
    // Implementation to fetch all schema records
    return [];
  }
}
