type Config = {
    privateKey?: string;
  };
  
  export abstract class AttestSDKBase {
    private privateKey: string | undefined;
  
    constructor(config: Config) {
      this.privateKey = config.privateKey;
    }
  
    protected async generateUID(): Promise<string> {
      return 'magic-schema-uid';
    }
  
    protected async storeSchema(schema: string): Promise<string> {
      return 'magic-schema-uid';
    }
  
    protected async verifySchema(schema: string): Promise<boolean> {
      return true;
    }
  
    protected async storeAttestation(attestation: string): Promise<string> {
      return 'magic-attestation-uid';
    }
  
    protected async verifyAttestationUID(uid: string): Promise<boolean> {
      return true;
    }
  
    protected async verifyAttestationIsRevocable(uid: string): Promise<boolean> {
      return true;
    }
  
    protected async updateAttestationStatus(
      uid: string,
      status: string,
    ): Promise<boolean> {
      return true;
    }
  }
  