import { Buffer } from "buffer";
import { Address } from '@stellar/stellar-sdk';
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from '@stellar/stellar-sdk/contract';
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Typepoint,
  Duration,
} from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk'
export * as contract from '@stellar/stellar-sdk/contract'
export * as rpc from '@stellar/stellar-sdk/rpc'

if (typeof window !== 'undefined') {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCVXRP5PUMR6RQWXEM2G766JHBWBGLG4YLFE3MFDIPYHTHX667CVK3FN",
  }
} as const

export const Errors = {
  1: {message:"TransferFailed"},
  2: {message:"AuthorityNotRegistered"},
  3: {message:"SchemaNotFound"},
  4: {message:"AttestationExists"},
  5: {message:"AttestationNotFound"},
  6: {message:"NotAuthorized"},
  7: {message:"StorageFailed"},
  9: {message:"InvalidUid"},
  10: {message:"ResolverError"},
  11: {message:"SchemaHasNoResolver"},
  12: {message:"AdminNotSet"},
  13: {message:"AlreadyInitialized"},
  14: {message:"NotInitialized"},
  15: {message:"AttestationNotRevocable"},
  16: {message:"InvalidSchemaDefinition"},
  17: {message:"InvalidAttestationValue"},
  18: {message:"InvalidReference"},
  19: {message:"InvalidNonce"},
  20: {message:"ExpiredSignature"},
  21: {message:"InvalidSignature"},
  22: {message:"AttestationExpired"},
  23: {message:"InvalidDeadline"},
  24: {message:"ResolverCallFailed"},
  25: {message:"InvalidSignaturePoint"},
  26: {message:"BlsPubKeyNotRegistered"}
}


export interface ResolverAttestation {
  attester: string;
  data: Buffer;
  expiration_time: u64;
  recipient: string;
  ref_uid: Buffer;
  revocable: boolean;
  revocation_time: u64;
  schema_uid: Buffer;
  time: u64;
  uid: Buffer;
  value: i128;
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                                 DataKey                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * 
 * Represents the keys used for data storage in the contract.
 * 
 * Each variant corresponds to a different type of data that can be stored
 * in the contract's persistent storage.
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "Authority", values: readonly [string]} | {tag: "Schema", values: readonly [Buffer]} | {tag: "AttestationUID", values: readonly [Buffer]} | {tag: "AttesterNonce", values: readonly [string]} | {tag: "AttesterPublicKey", values: readonly [string]};


/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                               Authority                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * 
 * Represents an authority that can create schemas and attestations.
 * 
 * Authorities are registered entities with specific permissions in the system
 * that can create schemas and issue attestations.
 */
export interface Authority {
  /**
 * The Stellar address of the authority
 */
address: string;
  /**
 * Metadata describing the authority
 * 
 * Typically in JSON format, containing information about the authority.
 */
metadata: string;
}


/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                                 Schema                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * 
 * Represents a schema definition that attestations can follow.
 * 
 * Schemas define the structure and validation rules for attestations.
 * The definition field supports multiple formats:
 * - XDR-encoded: Stellar-native binary format for structured data
 * - JSON: Human-readable structured format
 */
export interface Schema {
  /**
 * The address of the authority that created this schema
 */
authority: string;
  /**
 * The schema definition in any supported format
 * 
 * Supports XDR-encoded structured data or JSON
 */
definition: string;
  /**
 * Optional address of a resolver contract for this schema
 * 
 * If present, this contract will be called to handle attestation operations.
 */
resolver: Option<string>;
  /**
 * Whether attestations using this schema can be revoked
 */
revocable: boolean;
}


/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      DelegatedAttestationRequest                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * 
 * Represents a request for delegated attestations.
 * 
 * This allows an attester to sign an attestation off-chain, which can then be
 * submitted on-chain by any party (who will pay the transaction fees).
 */
export interface DelegatedAttestationRequest {
  /**
 * The address of the original attester (who signed off-chain)
 */
attester: string;
  /**
 * Expiration timestamp for this signed request
 * 
 * After this time, the signature is no longer valid and cannot be submitted.
 */
deadline: u64;
  /**
 * Optional expiration time for the attestation itself
 */
expiration_time: Option<u64>;
  /**
 * The nonce for this attestation (must be the next expected nonce for the attester)
 */
nonce: u64;
  /**
 * The unique identifier of the schema this attestation follows
 */
schema_uid: Buffer;
  /**
 * BLS12-381 G1 signature of the request data (96 bytes)
 */
signature: Buffer;
  /**
 * The address of the entity that is the subject of this attestation
 */
subject: string;
  /**
 * The value or content of the attestation
 */
value: string;
}


/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      DelegatedRevocationRequest                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * 
 * Represents a request for delegated revocation.
 * 
 * This allows an attester to sign a revocation off-chain, which can then be
 * submitted on-chain by any party.
 */
export interface DelegatedRevocationRequest {
  /**
 * The unique identifier of the attestation to revoke
 */
attestation_uid: Buffer;
  /**
 * Expiration timestamp for this signed request
 */
deadline: u64;
  /**
 * The nonce of the attestation to revoke
 */
nonce: u64;
  /**
 * The address of the original attester (who signed off-chain)
 */
revoker: string;
  /**
 * The unique identifier of the schema
 */
schema_uid: Buffer;
  /**
 * BLS12-381 G1 signature of the request data (96 bytes)
 */
signature: Buffer;
  /**
 * The address of the entity that is the subject of the attestation to revoke
 */
subject: string;
}


/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                            Attestation                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * 
 * Represents an attestation with support for both direct and delegated attestations.
 * 
 * Used for tracking attestations and supporting multiple attestations per schema/subject
 * pair through nonces.
 */
export interface Attestation {
  /**
 * The address of the entity that created this attestation
 * 
 * In direct attestations, this is the caller.
 * In delegated attestations, this is the original signer.
 */
attester: string;
  /**
 * Optional expiration timestamp
 * 
 * If set, the attestation is considered invalid after this time.
 */
expiration_time: Option<u64>;
  /**
 * Unique nonce for this attestation
 * 
 * Allows for multiple attestations of the same schema for the same subject,
 * and prevents replay attacks in delegated attestations.
 */
nonce: u64;
  /**
 * Optional timestamp when the attestation was revoked
 */
revocation_time: Option<u64>;
  /**
 * Whether this attestation has been revoked
 */
revoked: boolean;
  /**
 * The unique identifier of the schema this attestation follows
 */
schema_uid: Buffer;
  /**
 * The address of the entity that is the subject of this attestation
 */
subject: string;
  /**
 * Timestamp when the attestation was created
 */
timestamp: u64;
  /**
 * The unique identifier of the attestation
 */
uid: Buffer;
  /**
 * The value or content of the attestation
 */
value: string;
}


/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                            BLS Public Key                                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * 
 * Represents a BLS12-381 public key for an attester.
 * 
 * Each wallet address can have exactly one BLS public key. No updates or revocations.
 */
export interface BlsPublicKey {
  /**
 * The BLS12-381 G2 public key (192 bytes compressed)
 */
key: Buffer;
  /**
 * Timestamp when this key was registered
 */
registered_at: u64;
}

export interface Client {
  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({admin}: {admin: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register: ({caller, schema_definition, resolver, revocable}: {caller: string, schema_definition: string, resolver: Option<string>, revocable: boolean}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<Buffer>>>

  /**
   * Construct and simulate a attest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creates an attestation using the nonce-based system
   */
  attest: ({attester, schema_uid, subject, value, expiration_time}: {attester: string, schema_uid: Buffer, subject: string, value: string, expiration_time: Option<u64>}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<Buffer>>>

  /**
   * Construct and simulate a revoke_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  revoke_attestation: ({revoker, attestation_uid}: {revoker: string, attestation_uid: Buffer}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_attestation: ({attestation_uid}: {attestation_uid: Buffer}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<Attestation>>>

  /**
   * Construct and simulate a attest_by_delegation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creates an attestation using a delegated signature
   * Anyone can submit this transaction, paying the fees
   */
  attest_by_delegation: ({submitter, request}: {submitter: string, request: DelegatedAttestationRequest}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a revoke_by_delegation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Revokes an attestation using a delegated signature
   */
  revoke_by_delegation: ({submitter, request}: {submitter: string, request: DelegatedRevocationRequest}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_attester_nonce transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gets the next nonce for an attester
   */
  get_attester_nonce: ({attester}: {attester: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a register_bls_key transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Registers a BLS public key for an attester
   */
  register_bls_key: ({attester, public_key}: {attester: string, public_key: Buffer}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_bls_key transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gets the BLS public key for an attester
   */
  get_bls_key: ({attester}: {attester: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<BlsPublicKey>>

  /**
   * Construct and simulate a get_dst_for_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gets the domain separation tag for delegated attestations.
   */
  get_dst_for_attestation: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Buffer>>

  /**
   * Construct and simulate a get_dst_for_revocation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gets the domain separation tag for delegated revocations.
   */
  get_dst_for_revocation: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Buffer>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAGQAAAAAAAAAOVHJhbnNmZXJGYWlsZWQAAAAAAAEAAAAAAAAAFkF1dGhvcml0eU5vdFJlZ2lzdGVyZWQAAAAAAAIAAAAAAAAADlNjaGVtYU5vdEZvdW5kAAAAAAADAAAAAAAAABFBdHRlc3RhdGlvbkV4aXN0cwAAAAAAAAQAAAAAAAAAE0F0dGVzdGF0aW9uTm90Rm91bmQAAAAABQAAAAAAAAANTm90QXV0aG9yaXplZAAAAAAAAAYAAAAAAAAADVN0b3JhZ2VGYWlsZWQAAAAAAAAHAAAAAAAAAApJbnZhbGlkVWlkAAAAAAAJAAAAAAAAAA1SZXNvbHZlckVycm9yAAAAAAAACgAAAAAAAAATU2NoZW1hSGFzTm9SZXNvbHZlcgAAAAALAAAAAAAAAAtBZG1pbk5vdFNldAAAAAAMAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAA0AAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAAOAAAAAAAAABdBdHRlc3RhdGlvbk5vdFJldm9jYWJsZQAAAAAPAAAAAAAAABdJbnZhbGlkU2NoZW1hRGVmaW5pdGlvbgAAAAAQAAAAAAAAABdJbnZhbGlkQXR0ZXN0YXRpb25WYWx1ZQAAAAARAAAAAAAAABBJbnZhbGlkUmVmZXJlbmNlAAAAEgAAAAAAAAAMSW52YWxpZE5vbmNlAAAAEwAAAAAAAAAQRXhwaXJlZFNpZ25hdHVyZQAAABQAAAAAAAAAEEludmFsaWRTaWduYXR1cmUAAAAVAAAAAAAAABJBdHRlc3RhdGlvbkV4cGlyZWQAAAAAABYAAAAAAAAAD0ludmFsaWREZWFkbGluZQAAAAAXAAAAAAAAABJSZXNvbHZlckNhbGxGYWlsZWQAAAAAABgAAAAAAAAAFUludmFsaWRTaWduYXR1cmVQb2ludAAAAAAAABkAAAAAAAAAFkJsc1B1YktleU5vdFJlZ2lzdGVyZWQAAAAAABo=",
        "AAAAAQAAAAAAAAAAAAAAE1Jlc29sdmVyQXR0ZXN0YXRpb24AAAAACwAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAAAAAARkYXRhAAAADgAAAAAAAAAPZXhwaXJhdGlvbl90aW1lAAAAAAYAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAAB3JlZl91aWQAAAAADgAAAAAAAAAJcmV2b2NhYmxlAAAAAAAAAQAAAAAAAAAPcmV2b2NhdGlvbl90aW1lAAAAAAYAAAAAAAAACnNjaGVtYV91aWQAAAAAA+4AAAAgAAAAAAAAAAR0aW1lAAAABgAAAAAAAAADdWlkAAAAA+4AAAAgAAAAAAAAAAV2YWx1ZQAAAAAAAAs=",
        "AAAAAgAAAsbilZTilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZcK4pWRICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRGF0YUtleSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg4pWRCuKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVnQoKUmVwcmVzZW50cyB0aGUga2V5cyB1c2VkIGZvciBkYXRhIHN0b3JhZ2UgaW4gdGhlIGNvbnRyYWN0LgoKRWFjaCB2YXJpYW50IGNvcnJlc3BvbmRzIHRvIGEgZGlmZmVyZW50IHR5cGUgb2YgZGF0YSB0aGF0IGNhbiBiZSBzdG9yZWQKaW4gdGhlIGNvbnRyYWN0J3MgcGVyc2lzdGVudCBzdG9yYWdlLgAAAAAAAAAAAAdEYXRhS2V5AAAAAAYAAAAAAAAAKktleSBmb3Igc3RvcmluZyB0aGUgY29udHJhY3QgYWRtaW4gYWRkcmVzcwAAAAAABUFkbWluAAAAAAAAAQAAAElLZXkgZm9yIHN0b3JpbmcgYXV0aG9yaXR5IGluZm9ybWF0aW9uLCBpbmRleGVkIGJ5IHRoZSBhdXRob3JpdHkncyBhZGRyZXNzAAAAAAAACUF1dGhvcml0eQAAAAAAAAEAAAATAAAAAQAAAFhLZXkgZm9yIHN0b3Jpbmcgc3RydWN0dXJlZCBzY2hlbWEgaW5mb3JtYXRpb24sIGluZGV4ZWQgYnkgdGhlIHNjaGVtYSdzIHVuaXF1ZSBpZGVudGlmaWVyAAAABlNjaGVtYQAAAAAAAQAAA+4AAAAgAAAAAQAAAE5LZXkgZm9yIHN0b3JpbmcgYXR0ZXN0YXRpb24gZGF0YQoKSW5kZXhlZCBieSBhdHRlc3RhdGlvbiBVSUQgZm9yIGRpcmVjdCBsb29rdXAAAAAAAA5BdHRlc3RhdGlvblVJRAAAAAAAAQAAA+4AAAAgAAAAAQAAAGtLZXkgZm9yIHN0b3JpbmcgdGhlIGN1cnJlbnQgbm9uY2UgZm9yIGFuIGF0dGVzdGVyCgpVc2VkIHRvIHByZXZlbnQgcmVwbGF5IGF0dGFja3MgaW4gZGVsZWdhdGVkIGF0dGVzdGF0aW9ucwAAAAANQXR0ZXN0ZXJOb25jZQAAAAAAAAEAAAATAAAAAQAAAGhLZXkgZm9yIHN0b3JpbmcgdGhlIEJMUyBwdWJsaWMga2V5IGZvciBhbiBhdHRlc3RlcgoKT25lLXRvLW9uZSBtYXBwaW5nOiB3YWxsZXQgYWRkcmVzcyAtPiBCTFMgcHVibGljIGtleQAAABFBdHRlc3RlclB1YmxpY0tleQAAAAAAAAEAAAAT",
        "AAAAAQAAAtvilZTilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZcK4pWRICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEF1dGhvcml0eSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg4pWRCuKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVnQoKUmVwcmVzZW50cyBhbiBhdXRob3JpdHkgdGhhdCBjYW4gY3JlYXRlIHNjaGVtYXMgYW5kIGF0dGVzdGF0aW9ucy4KCkF1dGhvcml0aWVzIGFyZSByZWdpc3RlcmVkIGVudGl0aWVzIHdpdGggc3BlY2lmaWMgcGVybWlzc2lvbnMgaW4gdGhlIHN5c3RlbQp0aGF0IGNhbiBjcmVhdGUgc2NoZW1hcyBhbmQgaXNzdWUgYXR0ZXN0YXRpb25zLgAAAAAAAAAACUF1dGhvcml0eQAAAAAAAAIAAAAkVGhlIFN0ZWxsYXIgYWRkcmVzcyBvZiB0aGUgYXV0aG9yaXR5AAAAB2FkZHJlc3MAAAAAEwAAAGhNZXRhZGF0YSBkZXNjcmliaW5nIHRoZSBhdXRob3JpdHkKClR5cGljYWxseSBpbiBKU09OIGZvcm1hdCwgY29udGFpbmluZyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgYXV0aG9yaXR5LgAAAAhtZXRhZGF0YQAAABA=",
        "AAAAAQAAAzfilZTilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZcK4pWRICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU2NoZW1hICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg4pWRCuKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVnQoKUmVwcmVzZW50cyBhIHNjaGVtYSBkZWZpbml0aW9uIHRoYXQgYXR0ZXN0YXRpb25zIGNhbiBmb2xsb3cuCgpTY2hlbWFzIGRlZmluZSB0aGUgc3RydWN0dXJlIGFuZCB2YWxpZGF0aW9uIHJ1bGVzIGZvciBhdHRlc3RhdGlvbnMuClRoZSBkZWZpbml0aW9uIGZpZWxkIHN1cHBvcnRzIG11bHRpcGxlIGZvcm1hdHM6Ci0gWERSLWVuY29kZWQ6IFN0ZWxsYXItbmF0aXZlIGJpbmFyeSBmb3JtYXQgZm9yIHN0cnVjdHVyZWQgZGF0YQotIEpTT046IEh1bWFuLXJlYWRhYmxlIHN0cnVjdHVyZWQgZm9ybWF0AAAAAAAAAAAGU2NoZW1hAAAAAAAEAAAANVRoZSBhZGRyZXNzIG9mIHRoZSBhdXRob3JpdHkgdGhhdCBjcmVhdGVkIHRoaXMgc2NoZW1hAAAAAAAACWF1dGhvcml0eQAAAAAAABMAAABbVGhlIHNjaGVtYSBkZWZpbml0aW9uIGluIGFueSBzdXBwb3J0ZWQgZm9ybWF0CgpTdXBwb3J0cyBYRFItZW5jb2RlZCBzdHJ1Y3R1cmVkIGRhdGEgb3IgSlNPTgAAAAAKZGVmaW5pdGlvbgAAAAAAEAAAAINPcHRpb25hbCBhZGRyZXNzIG9mIGEgcmVzb2x2ZXIgY29udHJhY3QgZm9yIHRoaXMgc2NoZW1hCgpJZiBwcmVzZW50LCB0aGlzIGNvbnRyYWN0IHdpbGwgYmUgY2FsbGVkIHRvIGhhbmRsZSBhdHRlc3RhdGlvbiBvcGVyYXRpb25zLgAAAAAIcmVzb2x2ZXIAAAPoAAAAEwAAADVXaGV0aGVyIGF0dGVzdGF0aW9ucyB1c2luZyB0aGlzIHNjaGVtYSBjYW4gYmUgcmV2b2tlZAAAAAAAAAlyZXZvY2FibGUAAAAAAAAB",
        "AAAAAQAAAt/ilZTilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZcK4pWRICAgICAgICAgICAgICAgICAgICAgIERlbGVnYXRlZEF0dGVzdGF0aW9uUmVxdWVzdCAgICAgICAgICAgICAgICAgICAgICAgICAg4pWRCuKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVnQoKUmVwcmVzZW50cyBhIHJlcXVlc3QgZm9yIGRlbGVnYXRlZCBhdHRlc3RhdGlvbnMuCgpUaGlzIGFsbG93cyBhbiBhdHRlc3RlciB0byBzaWduIGFuIGF0dGVzdGF0aW9uIG9mZi1jaGFpbiwgd2hpY2ggY2FuIHRoZW4gYmUKc3VibWl0dGVkIG9uLWNoYWluIGJ5IGFueSBwYXJ0eSAod2hvIHdpbGwgcGF5IHRoZSB0cmFuc2FjdGlvbiBmZWVzKS4AAAAAAAAAABtEZWxlZ2F0ZWRBdHRlc3RhdGlvblJlcXVlc3QAAAAACAAAADtUaGUgYWRkcmVzcyBvZiB0aGUgb3JpZ2luYWwgYXR0ZXN0ZXIgKHdobyBzaWduZWQgb2ZmLWNoYWluKQAAAAAIYXR0ZXN0ZXIAAAATAAAAeEV4cGlyYXRpb24gdGltZXN0YW1wIGZvciB0aGlzIHNpZ25lZCByZXF1ZXN0CgpBZnRlciB0aGlzIHRpbWUsIHRoZSBzaWduYXR1cmUgaXMgbm8gbG9uZ2VyIHZhbGlkIGFuZCBjYW5ub3QgYmUgc3VibWl0dGVkLgAAAAhkZWFkbGluZQAAAAYAAAAzT3B0aW9uYWwgZXhwaXJhdGlvbiB0aW1lIGZvciB0aGUgYXR0ZXN0YXRpb24gaXRzZWxmAAAAAA9leHBpcmF0aW9uX3RpbWUAAAAD6AAAAAYAAABRVGhlIG5vbmNlIGZvciB0aGlzIGF0dGVzdGF0aW9uIChtdXN0IGJlIHRoZSBuZXh0IGV4cGVjdGVkIG5vbmNlIGZvciB0aGUgYXR0ZXN0ZXIpAAAAAAAABW5vbmNlAAAAAAAABgAAADxUaGUgdW5pcXVlIGlkZW50aWZpZXIgb2YgdGhlIHNjaGVtYSB0aGlzIGF0dGVzdGF0aW9uIGZvbGxvd3MAAAAKc2NoZW1hX3VpZAAAAAAD7gAAACAAAAA1QkxTMTItMzgxIEcxIHNpZ25hdHVyZSBvZiB0aGUgcmVxdWVzdCBkYXRhICg5NiBieXRlcykAAAAAAAAJc2lnbmF0dXJlAAAAAAAD7gAAAGAAAABBVGhlIGFkZHJlc3Mgb2YgdGhlIGVudGl0eSB0aGF0IGlzIHRoZSBzdWJqZWN0IG9mIHRoaXMgYXR0ZXN0YXRpb24AAAAAAAAHc3ViamVjdAAAAAATAAAAJ1RoZSB2YWx1ZSBvciBjb250ZW50IG9mIHRoZSBhdHRlc3RhdGlvbgAAAAAFdmFsdWUAAAAAAAAQ",
        "AAAAAQAAArfilZTilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZcK4pWRICAgICAgICAgICAgICAgICAgICAgIERlbGVnYXRlZFJldm9jYXRpb25SZXF1ZXN0ICAgICAgICAgICAgICAgICAgICAgICAgICAg4pWRCuKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVnQoKUmVwcmVzZW50cyBhIHJlcXVlc3QgZm9yIGRlbGVnYXRlZCByZXZvY2F0aW9uLgoKVGhpcyBhbGxvd3MgYW4gYXR0ZXN0ZXIgdG8gc2lnbiBhIHJldm9jYXRpb24gb2ZmLWNoYWluLCB3aGljaCBjYW4gdGhlbiBiZQpzdWJtaXR0ZWQgb24tY2hhaW4gYnkgYW55IHBhcnR5LgAAAAAAAAAAGkRlbGVnYXRlZFJldm9jYXRpb25SZXF1ZXN0AAAAAAAHAAAAMlRoZSB1bmlxdWUgaWRlbnRpZmllciBvZiB0aGUgYXR0ZXN0YXRpb24gdG8gcmV2b2tlAAAAAAAPYXR0ZXN0YXRpb25fdWlkAAAAA+4AAAAgAAAALEV4cGlyYXRpb24gdGltZXN0YW1wIGZvciB0aGlzIHNpZ25lZCByZXF1ZXN0AAAACGRlYWRsaW5lAAAABgAAACZUaGUgbm9uY2Ugb2YgdGhlIGF0dGVzdGF0aW9uIHRvIHJldm9rZQAAAAAABW5vbmNlAAAAAAAABgAAADtUaGUgYWRkcmVzcyBvZiB0aGUgb3JpZ2luYWwgYXR0ZXN0ZXIgKHdobyBzaWduZWQgb2ZmLWNoYWluKQAAAAAHcmV2b2tlcgAAAAATAAAAI1RoZSB1bmlxdWUgaWRlbnRpZmllciBvZiB0aGUgc2NoZW1hAAAAAApzY2hlbWFfdWlkAAAAAAPuAAAAIAAAADVCTFMxMi0zODEgRzEgc2lnbmF0dXJlIG9mIHRoZSByZXF1ZXN0IGRhdGEgKDk2IGJ5dGVzKQAAAAAAAAlzaWduYXR1cmUAAAAAAAPuAAAAYAAAAEpUaGUgYWRkcmVzcyBvZiB0aGUgZW50aXR5IHRoYXQgaXMgdGhlIHN1YmplY3Qgb2YgdGhlIGF0dGVzdGF0aW9uIHRvIHJldm9rZQAAAAAAB3N1YmplY3QAAAAAEw==",
        "AAAAAQAAAtzilZTilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZcK4pWRICAgICAgICAgICAgICAgICAgICAgICAgICAgIEF0dGVzdGF0aW9uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg4pWRCuKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVnQoKUmVwcmVzZW50cyBhbiBhdHRlc3RhdGlvbiB3aXRoIHN1cHBvcnQgZm9yIGJvdGggZGlyZWN0IGFuZCBkZWxlZ2F0ZWQgYXR0ZXN0YXRpb25zLgoKVXNlZCBmb3IgdHJhY2tpbmcgYXR0ZXN0YXRpb25zIGFuZCBzdXBwb3J0aW5nIG11bHRpcGxlIGF0dGVzdGF0aW9ucyBwZXIgc2NoZW1hL3N1YmplY3QKcGFpciB0aHJvdWdoIG5vbmNlcy4AAAAAAAAAC0F0dGVzdGF0aW9uAAAAAAoAAACcVGhlIGFkZHJlc3Mgb2YgdGhlIGVudGl0eSB0aGF0IGNyZWF0ZWQgdGhpcyBhdHRlc3RhdGlvbgoKSW4gZGlyZWN0IGF0dGVzdGF0aW9ucywgdGhpcyBpcyB0aGUgY2FsbGVyLgpJbiBkZWxlZ2F0ZWQgYXR0ZXN0YXRpb25zLCB0aGlzIGlzIHRoZSBvcmlnaW5hbCBzaWduZXIuAAAACGF0dGVzdGVyAAAAEwAAAF1PcHRpb25hbCBleHBpcmF0aW9uIHRpbWVzdGFtcAoKSWYgc2V0LCB0aGUgYXR0ZXN0YXRpb24gaXMgY29uc2lkZXJlZCBpbnZhbGlkIGFmdGVyIHRoaXMgdGltZS4AAAAAAAAPZXhwaXJhdGlvbl90aW1lAAAAA+gAAAAGAAAAo1VuaXF1ZSBub25jZSBmb3IgdGhpcyBhdHRlc3RhdGlvbgoKQWxsb3dzIGZvciBtdWx0aXBsZSBhdHRlc3RhdGlvbnMgb2YgdGhlIHNhbWUgc2NoZW1hIGZvciB0aGUgc2FtZSBzdWJqZWN0LAphbmQgcHJldmVudHMgcmVwbGF5IGF0dGFja3MgaW4gZGVsZWdhdGVkIGF0dGVzdGF0aW9ucy4AAAAABW5vbmNlAAAAAAAABgAAADNPcHRpb25hbCB0aW1lc3RhbXAgd2hlbiB0aGUgYXR0ZXN0YXRpb24gd2FzIHJldm9rZWQAAAAAD3Jldm9jYXRpb25fdGltZQAAAAPoAAAABgAAAClXaGV0aGVyIHRoaXMgYXR0ZXN0YXRpb24gaGFzIGJlZW4gcmV2b2tlZAAAAAAAAAdyZXZva2VkAAAAAAEAAAA8VGhlIHVuaXF1ZSBpZGVudGlmaWVyIG9mIHRoZSBzY2hlbWEgdGhpcyBhdHRlc3RhdGlvbiBmb2xsb3dzAAAACnNjaGVtYV91aWQAAAAAA+4AAAAgAAAAQVRoZSBhZGRyZXNzIG9mIHRoZSBlbnRpdHkgdGhhdCBpcyB0aGUgc3ViamVjdCBvZiB0aGlzIGF0dGVzdGF0aW9uAAAAAAAAB3N1YmplY3QAAAAAEwAAACpUaW1lc3RhbXAgd2hlbiB0aGUgYXR0ZXN0YXRpb24gd2FzIGNyZWF0ZWQAAAAAAAl0aW1lc3RhbXAAAAAAAAAGAAAAKFRoZSB1bmlxdWUgaWRlbnRpZmllciBvZiB0aGUgYXR0ZXN0YXRpb24AAAADdWlkAAAAA+4AAAAgAAAAJ1RoZSB2YWx1ZSBvciBjb250ZW50IG9mIHRoZSBhdHRlc3RhdGlvbgAAAAAFdmFsdWUAAAAAAAAQ",
        "AAAAAQAAAqTilZTilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZcK4pWRICAgICAgICAgICAgICAgICAgICAgICAgICAgIEJMUyBQdWJsaWMgS2V5ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg4pWRCuKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVnQoKUmVwcmVzZW50cyBhIEJMUzEyLTM4MSBwdWJsaWMga2V5IGZvciBhbiBhdHRlc3Rlci4KCkVhY2ggd2FsbGV0IGFkZHJlc3MgY2FuIGhhdmUgZXhhY3RseSBvbmUgQkxTIHB1YmxpYyBrZXkuIE5vIHVwZGF0ZXMgb3IgcmV2b2NhdGlvbnMuAAAAAAAAAAxCbHNQdWJsaWNLZXkAAAACAAAAMlRoZSBCTFMxMi0zODEgRzIgcHVibGljIGtleSAoMTkyIGJ5dGVzIGNvbXByZXNzZWQpAAAAAAADa2V5AAAAA+4AAADAAAAAJlRpbWVzdGFtcCB3aGVuIHRoaXMga2V5IHdhcyByZWdpc3RlcmVkAAAAAAANcmVnaXN0ZXJlZF9hdAAAAAAAAAY=",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAAIcmVnaXN0ZXIAAAAEAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAEXNjaGVtYV9kZWZpbml0aW9uAAAAAAAAEAAAAAAAAAAIcmVzb2x2ZXIAAAPoAAAAEwAAAAAAAAAJcmV2b2NhYmxlAAAAAAAAAQAAAAEAAAPpAAAD7gAAACAAAAAD",
        "AAAAAAAAADNDcmVhdGVzIGFuIGF0dGVzdGF0aW9uIHVzaW5nIHRoZSBub25jZS1iYXNlZCBzeXN0ZW0AAAAABmF0dGVzdAAAAAAABQAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAAAAAApzY2hlbWFfdWlkAAAAAAPuAAAAIAAAAAAAAAAHc3ViamVjdAAAAAATAAAAAAAAAAV2YWx1ZQAAAAAAABAAAAAAAAAAD2V4cGlyYXRpb25fdGltZQAAAAPoAAAABgAAAAEAAAPpAAAD7gAAACAAAAAD",
        "AAAAAAAAAAAAAAAScmV2b2tlX2F0dGVzdGF0aW9uAAAAAAACAAAAAAAAAAdyZXZva2VyAAAAABMAAAAAAAAAD2F0dGVzdGF0aW9uX3VpZAAAAAPuAAAAIAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAAPZ2V0X2F0dGVzdGF0aW9uAAAAAAEAAAAAAAAAD2F0dGVzdGF0aW9uX3VpZAAAAAPuAAAAIAAAAAEAAAPpAAAH0AAAAAtBdHRlc3RhdGlvbgAAAAAD",
        "AAAAAAAAAGZDcmVhdGVzIGFuIGF0dGVzdGF0aW9uIHVzaW5nIGEgZGVsZWdhdGVkIHNpZ25hdHVyZQpBbnlvbmUgY2FuIHN1Ym1pdCB0aGlzIHRyYW5zYWN0aW9uLCBwYXlpbmcgdGhlIGZlZXMAAAAAABRhdHRlc3RfYnlfZGVsZWdhdGlvbgAAAAIAAAAAAAAACXN1Ym1pdHRlcgAAAAAAABMAAAAAAAAAB3JlcXVlc3QAAAAH0AAAABtEZWxlZ2F0ZWRBdHRlc3RhdGlvblJlcXVlc3QAAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAADJSZXZva2VzIGFuIGF0dGVzdGF0aW9uIHVzaW5nIGEgZGVsZWdhdGVkIHNpZ25hdHVyZQAAAAAAFHJldm9rZV9ieV9kZWxlZ2F0aW9uAAAAAgAAAAAAAAAJc3VibWl0dGVyAAAAAAAAEwAAAAAAAAAHcmVxdWVzdAAAAAfQAAAAGkRlbGVnYXRlZFJldm9jYXRpb25SZXF1ZXN0AAAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAACNHZXRzIHRoZSBuZXh0IG5vbmNlIGZvciBhbiBhdHRlc3RlcgAAAAASZ2V0X2F0dGVzdGVyX25vbmNlAAAAAAABAAAAAAAAAAhhdHRlc3RlcgAAABMAAAABAAAABg==",
        "AAAAAAAAACpSZWdpc3RlcnMgYSBCTFMgcHVibGljIGtleSBmb3IgYW4gYXR0ZXN0ZXIAAAAAABByZWdpc3Rlcl9ibHNfa2V5AAAAAgAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAAAAAApwdWJsaWNfa2V5AAAAAAPuAAAAwAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAACdHZXRzIHRoZSBCTFMgcHVibGljIGtleSBmb3IgYW4gYXR0ZXN0ZXIAAAAAC2dldF9ibHNfa2V5AAAAAAEAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAEAAAPoAAAH0AAAAAxCbHNQdWJsaWNLZXk=",
        "AAAAAAAAADpHZXRzIHRoZSBkb21haW4gc2VwYXJhdGlvbiB0YWcgZm9yIGRlbGVnYXRlZCBhdHRlc3RhdGlvbnMuAAAAAAAXZ2V0X2RzdF9mb3JfYXR0ZXN0YXRpb24AAAAAAAAAAAEAAAAO",
        "AAAAAAAAADlHZXRzIHRoZSBkb21haW4gc2VwYXJhdGlvbiB0YWcgZm9yIGRlbGVnYXRlZCByZXZvY2F0aW9ucy4AAAAAAAAWZ2V0X2RzdF9mb3JfcmV2b2NhdGlvbgAAAAAAAAAAAAEAAAAO" ]),
      options
    )
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<Result<void>>,
        register: this.txFromJSON<Result<Buffer>>,
        attest: this.txFromJSON<Result<Buffer>>,
        revoke_attestation: this.txFromJSON<Result<void>>,
        get_attestation: this.txFromJSON<Result<Attestation>>,
        attest_by_delegation: this.txFromJSON<Result<void>>,
        revoke_by_delegation: this.txFromJSON<Result<void>>,
        get_attester_nonce: this.txFromJSON<u64>,
        register_bls_key: this.txFromJSON<Result<void>>,
        get_bls_key: this.txFromJSON<Option<BlsPublicKey>>,
        get_dst_for_attestation: this.txFromJSON<Buffer>,
        get_dst_for_revocation: this.txFromJSON<Buffer>
  }
}