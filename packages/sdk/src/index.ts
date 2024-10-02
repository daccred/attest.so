import { Attestations } from './attestations';
import { AttestSDKBaseConfig } from './core/types';
import { Schemas } from './schemas';

/**
 * Represents the AttestSDK, which provides access to attestations and schemas.
 */
class AttestSDK {
  /**
   * The configuration for the AttestSDK.
   */
  private config: AttestSDKBaseConfig;
  /**
   * An instance of Attestations for managing attestations.
   */
  attestation: Attestations;
  /**
   * An instance of Schemas for managing schemas.
   */
  schema: Schemas;

  /**
   * Initializes a new instance of the AttestSDK with the provided configuration.
   *
   * @param config The configuration for the AttestSDK.
   */
  constructor(config: AttestSDKBaseConfig) {
    this.config = config;
    this.attestation = new Attestations(this.config);
    this.schema = new Schemas(this.config);
  }
}

export default AttestSDK;
