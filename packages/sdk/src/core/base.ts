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
  StellarFetchAttestationResult,
  StellarFetchAuthorityResult,
  StellarFetchSchemaResult,
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
    config: SchemaConfig
  ): Promise<AttestSDKResponse<anchor.web3.PublicKey | string>>

  abstract fetchAttestation(
    attestation: anchor.web3.PublicKey | string
  ): Promise<AttestSDKResponse<SolanaFetchAttestationResult | StellarFetchAttestationResult | null>>

  abstract attest(
    config: AttestationConfig | StellarAttestationConfig
  ): Promise<AttestSDKResponse<anchor.web3.PublicKey | string>>

  abstract revokeAttestation(
    props: SolanaRevokeAttestationConfig | RevokeAttestationConfig
  ): Promise<AttestSDKResponse<anchor.web3.PublicKey | string>>
}
