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
  constructor(config: Omit<AttestSDKBaseConfig, 'idl'>) {
    this.attestation = new Attestations(config)
    this.schema = new Schemas(config)
  }
}

export default AttestSDK;
