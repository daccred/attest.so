import {
  AttestationConfig,
  AttestSDKResponse,
  RevokeAttestationConfig,
  SchemaConfig,
  SolanaFetchAttestationResult,
  SolanaFetchAuthorityResult,
  SolanaFetchSchemaResult,
} from './types'
import * as anchor from '@coral-xyz/anchor'

/**
 * Abstract base class for the Attest SDK
 * This contains common functionality across chains
 */
export abstract class AttestSDKBase {
  abstract initialize(): Promise<void>
  abstract fetchAuthority(
    x: string | number
  ): Promise<AttestSDKResponse<SolanaFetchAuthorityResult | null>>

  abstract registerAuthority(): Promise<AttestSDKResponse<anchor.web3.PublicKey | string>>

  abstract fetchSchema(
    schemaUID: anchor.web3.PublicKey | string
  ): Promise<AttestSDKResponse<SolanaFetchSchemaResult | null>>

  abstract createSchema(
    config: SchemaConfig
  ): Promise<AttestSDKResponse<anchor.web3.PublicKey | string>>

  abstract fetchAttestation(
    attestation: anchor.web3.PublicKey | string
  ): Promise<AttestSDKResponse<SolanaFetchAttestationResult | null>>

  abstract attest(
    config: AttestationConfig
  ): Promise<AttestSDKResponse<anchor.web3.PublicKey | string>>

  abstract revokeAttestation(
    props: RevokeAttestationConfig
  ): Promise<AttestSDKResponse<anchor.web3.PublicKey | string>>
}
