import { Attestations } from './attestations';
import { AttestSDKBaseConfig } from './core/types';
import { Schemas } from './schemas';

class AttestSDK {
  private config: AttestSDKBaseConfig;
  attestations: Attestations;
  schemas: Schemas;

  constructor(config: AttestSDKBaseConfig) {
    this.config = config;
    this.attestations = new Attestations(this.config);
    this.schemas = new Schemas(this.config);
  }
}

export default AttestSDK;



