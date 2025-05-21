import {
  AttestationConfig,
  AttestSDKResponse,
  RevokeAttestationConfig,
  SchemaConfig,
  SolanaFetchAttestationResult,
  SolanaFetchAuthorityResult,
  SolanaFetchSchemaResult,
  SolanaRevokeAttestationConfig,
  StellarAttestationConfig,
  StellarAttestationConfigWithValue,
  StellarCreateSchemaResult,
  StellarFetchAttestationResult,
  StellarFetchAuthorityResult,
  StellarFetchSchemaResult,
  StellarSchemaConfig,
} from './types'
import * as anchor from '@coral-xyz/anchor'

/**
 * Abstract base class for the Attest SDK
 * This contains common functionality across chains
 */
export abstract class AttestSDKBase {
  abstract initialize(): Promise<void | AttestSDKResponse<void>>
  abstract fetchAuthority(
    x: string | number
  ): Promise<AttestSDKResponse<SolanaFetchAuthorityResult | StellarFetchAuthorityResult | null>>

  abstract registerAuthority(): Promise<AttestSDKResponse<anchor.web3.PublicKey | string>>

  abstract fetchSchema(
    schemaUID: anchor.web3.PublicKey | string
  ): Promise<AttestSDKResponse<SolanaFetchSchemaResult | StellarFetchSchemaResult | null>>

  abstract createSchema(
    config: SchemaConfig | StellarSchemaConfig
  ): Promise<AttestSDKResponse<anchor.web3.PublicKey | StellarCreateSchemaResult | string>>

  abstract fetchAttestation(
    attestation: anchor.web3.PublicKey | StellarAttestationConfig | string
  ): Promise<AttestSDKResponse<SolanaFetchAttestationResult | StellarFetchAttestationResult | null>>

  abstract attest(
    config: AttestationConfig | StellarAttestationConfigWithValue
  ): Promise<AttestSDKResponse<anchor.web3.PublicKey | string>>

  abstract revokeAttestation(
    props: SolanaRevokeAttestationConfig | StellarAttestationConfig | RevokeAttestationConfig
  ): Promise<AttestSDKResponse<anchor.web3.PublicKey | string>>
}
