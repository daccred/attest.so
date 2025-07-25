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
    contractId: "CCJDGGA754NBRTV63VBNEON6NKDJ3H7TRVELR6WX5KEJY7S7UANRT22H",
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
  18: {message:"InvalidReference"}
}


export interface ResolverAttestationRecord {
  attester: string;
  data: Buffer;
  expiration_time: Option<u64>;
  recipient: string;
  ref_uid: Option<Buffer>;
  revocable: boolean;
  revocation_time: Option<u64>;
  schema_uid: Buffer;
  time: u64;
  uid: Buffer;
  value: Option<i128>;
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
export type DataKey = {tag: "Admin", values: void} | {tag: "Authority", values: readonly [string]} | {tag: "Schema", values: readonly [Buffer]} | {tag: "Attestation", values: readonly [Buffer, string, Option<string>]};


/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                           StoredAttestation                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * 
 * Represents an attestation stored in the contract.
 * 
 * Contains all the metadata and content related to a specific attestation,
 * including timestamps, participants, and the actual attestation data.
 */
export interface StoredAttestation {
  /**
 * The address of the entity creating the attestation
 */
attester: string;
  /**
 * The actual attestation data
 * 
 * Typically serialized according to the schema definition.
 */
data: Buffer;
  /**
 * Optional timestamp when the attestation expires
 * 
 * If set, the attestation is considered invalid after this time.
 */
expiration_time: Option<u64>;
  /**
 * The address of the entity receiving the attestation
 */
recipient: string;
  /**
 * Optional reference to another attestation this one relates to
 */
ref_uid: Option<Buffer>;
  /**
 * Whether this attestation can be revoked by the attester
 */
revocable: boolean;
  /**
 * Optional timestamp when the attestation was revoked
 * 
 * If set, indicates this attestation has been explicitly invalidated.
 */
revocation_time: Option<u64>;
  /**
 * The unique identifier of the schema this attestation follows
 */
schema_uid: Buffer;
  /**
 * Timestamp when the attestation was created
 */
time: u64;
  /**
 * Optional numeric value associated with the attestation
 */
value: Option<i128>;
}


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
 * Schemas define the structure, validation rules, and behavior for attestations
 * that reference them.
 */
export interface Schema {
  /**
 * The address of the authority that created this schema
 */
authority: string;
  /**
 * The schema definition
 * 
 * Typically in JSON format, describing the structure and rules for attestations.
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
 * ║                          AttestationRecord                                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * 
 * Represents a record of an attestation with simplified fields.
 * 
 * Used for tracking attestations in a more compact form and for returning
 * attestation information to callers.
 */
export interface AttestationRecord {
  /**
 * Optional reference string to distinguish between multiple attestations
 * 
 * Allows for multiple attestations of the same schema for the same subject.
 */
reference: Option<string>;
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
 * The value or content of the attestation
 */
value: string;
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
   */
  attest: ({caller, schema_uid, subject, value, reference}: {caller: string, schema_uid: Buffer, subject: string, value: string, reference: Option<string>}, options?: {
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
   * Construct and simulate a revoke_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  revoke_attestation: ({caller, schema_uid, subject, reference}: {caller: string, schema_uid: Buffer, subject: string, reference: Option<string>}, options?: {
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
  get_attestation: ({schema_uid, subject, reference}: {schema_uid: Buffer, subject: string, reference: Option<string>}, options?: {
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
  }) => Promise<AssembledTransaction<Result<AttestationRecord>>>

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
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAEQAAAAAAAAAOVHJhbnNmZXJGYWlsZWQAAAAAAAEAAAAAAAAAFkF1dGhvcml0eU5vdFJlZ2lzdGVyZWQAAAAAAAIAAAAAAAAADlNjaGVtYU5vdEZvdW5kAAAAAAADAAAAAAAAABFBdHRlc3RhdGlvbkV4aXN0cwAAAAAAAAQAAAAAAAAAE0F0dGVzdGF0aW9uTm90Rm91bmQAAAAABQAAAAAAAAANTm90QXV0aG9yaXplZAAAAAAAAAYAAAAAAAAADVN0b3JhZ2VGYWlsZWQAAAAAAAAHAAAAAAAAAApJbnZhbGlkVWlkAAAAAAAJAAAAAAAAAA1SZXNvbHZlckVycm9yAAAAAAAACgAAAAAAAAATU2NoZW1hSGFzTm9SZXNvbHZlcgAAAAALAAAAAAAAAAtBZG1pbk5vdFNldAAAAAAMAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAA0AAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAAOAAAAAAAAABdBdHRlc3RhdGlvbk5vdFJldm9jYWJsZQAAAAAPAAAAAAAAABdJbnZhbGlkU2NoZW1hRGVmaW5pdGlvbgAAAAAQAAAAAAAAABdJbnZhbGlkQXR0ZXN0YXRpb25WYWx1ZQAAAAARAAAAAAAAABBJbnZhbGlkUmVmZXJlbmNlAAAAEg==",
        "AAAAAQAAAAAAAAAAAAAAGVJlc29sdmVyQXR0ZXN0YXRpb25SZWNvcmQAAAAAAAALAAAAAAAAAAhhdHRlc3RlcgAAABMAAAAAAAAABGRhdGEAAAAOAAAAAAAAAA9leHBpcmF0aW9uX3RpbWUAAAAD6AAAAAYAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAAB3JlZl91aWQAAAAD6AAAAA4AAAAAAAAACXJldm9jYWJsZQAAAAAAAAEAAAAAAAAAD3Jldm9jYXRpb25fdGltZQAAAAPoAAAABgAAAAAAAAAKc2NoZW1hX3VpZAAAAAAD7gAAACAAAAAAAAAABHRpbWUAAAAGAAAAAAAAAAN1aWQAAAAD7gAAACAAAAAAAAAABXZhbHVlAAAAAAAD6AAAAAs=",
        "AAAAAgAAAsbilZTilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZcK4pWRICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRGF0YUtleSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg4pWRCuKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVnQoKUmVwcmVzZW50cyB0aGUga2V5cyB1c2VkIGZvciBkYXRhIHN0b3JhZ2UgaW4gdGhlIGNvbnRyYWN0LgoKRWFjaCB2YXJpYW50IGNvcnJlc3BvbmRzIHRvIGEgZGlmZmVyZW50IHR5cGUgb2YgZGF0YSB0aGF0IGNhbiBiZSBzdG9yZWQKaW4gdGhlIGNvbnRyYWN0J3MgcGVyc2lzdGVudCBzdG9yYWdlLgAAAAAAAAAAAAdEYXRhS2V5AAAAAAQAAAAAAAAAKktleSBmb3Igc3RvcmluZyB0aGUgY29udHJhY3QgYWRtaW4gYWRkcmVzcwAAAAAABUFkbWluAAAAAAAAAQAAAElLZXkgZm9yIHN0b3JpbmcgYXV0aG9yaXR5IGluZm9ybWF0aW9uLCBpbmRleGVkIGJ5IHRoZSBhdXRob3JpdHkncyBhZGRyZXNzAAAAAAAACUF1dGhvcml0eQAAAAAAAAEAAAATAAAAAQAAAE1LZXkgZm9yIHN0b3Jpbmcgc2NoZW1hIGluZm9ybWF0aW9uLCBpbmRleGVkIGJ5IHRoZSBzY2hlbWEncyB1bmlxdWUgaWRlbnRpZmllcgAAAAAAAAZTY2hlbWEAAAAAAAEAAAPuAAAAIAAAAAEAAACJS2V5IGZvciBzdG9yaW5nIGF0dGVzdGF0aW9uIGRhdGEKCkluZGV4ZWQgYnkgc2NoZW1hIFVJRCwgcmVjaXBpZW50IGFkZHJlc3MsIGFuZCBvcHRpb25hbCByZWZlcmVuY2Ugc3RyaW5nCnRvIGFsbG93IGZvciBlZmZpY2llbnQgbG9va3Vwcy4AAAAAAAALQXR0ZXN0YXRpb24AAAAAAwAAA+4AAAAgAAAAEwAAA+gAAAAQ",
        "AAAAAQAAAt3ilZTilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZcK4pWRICAgICAgICAgICAgICAgICAgICAgICAgICAgU3RvcmVkQXR0ZXN0YXRpb24gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg4pWRCuKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVnQoKUmVwcmVzZW50cyBhbiBhdHRlc3RhdGlvbiBzdG9yZWQgaW4gdGhlIGNvbnRyYWN0LgoKQ29udGFpbnMgYWxsIHRoZSBtZXRhZGF0YSBhbmQgY29udGVudCByZWxhdGVkIHRvIGEgc3BlY2lmaWMgYXR0ZXN0YXRpb24sCmluY2x1ZGluZyB0aW1lc3RhbXBzLCBwYXJ0aWNpcGFudHMsIGFuZCB0aGUgYWN0dWFsIGF0dGVzdGF0aW9uIGRhdGEuAAAAAAAAAAAAABFTdG9yZWRBdHRlc3RhdGlvbgAAAAAAAAoAAAAyVGhlIGFkZHJlc3Mgb2YgdGhlIGVudGl0eSBjcmVhdGluZyB0aGUgYXR0ZXN0YXRpb24AAAAAAAhhdHRlc3RlcgAAABMAAABVVGhlIGFjdHVhbCBhdHRlc3RhdGlvbiBkYXRhCgpUeXBpY2FsbHkgc2VyaWFsaXplZCBhY2NvcmRpbmcgdG8gdGhlIHNjaGVtYSBkZWZpbml0aW9uLgAAAAAAAARkYXRhAAAADgAAAG9PcHRpb25hbCB0aW1lc3RhbXAgd2hlbiB0aGUgYXR0ZXN0YXRpb24gZXhwaXJlcwoKSWYgc2V0LCB0aGUgYXR0ZXN0YXRpb24gaXMgY29uc2lkZXJlZCBpbnZhbGlkIGFmdGVyIHRoaXMgdGltZS4AAAAAD2V4cGlyYXRpb25fdGltZQAAAAPoAAAABgAAADNUaGUgYWRkcmVzcyBvZiB0aGUgZW50aXR5IHJlY2VpdmluZyB0aGUgYXR0ZXN0YXRpb24AAAAACXJlY2lwaWVudAAAAAAAABMAAAA9T3B0aW9uYWwgcmVmZXJlbmNlIHRvIGFub3RoZXIgYXR0ZXN0YXRpb24gdGhpcyBvbmUgcmVsYXRlcyB0bwAAAAAAAAdyZWZfdWlkAAAAA+gAAAAOAAAAN1doZXRoZXIgdGhpcyBhdHRlc3RhdGlvbiBjYW4gYmUgcmV2b2tlZCBieSB0aGUgYXR0ZXN0ZXIAAAAACXJldm9jYWJsZQAAAAAAAAEAAAB4T3B0aW9uYWwgdGltZXN0YW1wIHdoZW4gdGhlIGF0dGVzdGF0aW9uIHdhcyByZXZva2VkCgpJZiBzZXQsIGluZGljYXRlcyB0aGlzIGF0dGVzdGF0aW9uIGhhcyBiZWVuIGV4cGxpY2l0bHkgaW52YWxpZGF0ZWQuAAAAD3Jldm9jYXRpb25fdGltZQAAAAPoAAAABgAAADxUaGUgdW5pcXVlIGlkZW50aWZpZXIgb2YgdGhlIHNjaGVtYSB0aGlzIGF0dGVzdGF0aW9uIGZvbGxvd3MAAAAKc2NoZW1hX3VpZAAAAAAD7gAAACAAAAAqVGltZXN0YW1wIHdoZW4gdGhlIGF0dGVzdGF0aW9uIHdhcyBjcmVhdGVkAAAAAAAEdGltZQAAAAYAAAA2T3B0aW9uYWwgbnVtZXJpYyB2YWx1ZSBhc3NvY2lhdGVkIHdpdGggdGhlIGF0dGVzdGF0aW9uAAAAAAAFdmFsdWUAAAAAAAPoAAAACw==",
        "AAAAAQAAAtvilZTilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZcK4pWRICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEF1dGhvcml0eSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg4pWRCuKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVnQoKUmVwcmVzZW50cyBhbiBhdXRob3JpdHkgdGhhdCBjYW4gY3JlYXRlIHNjaGVtYXMgYW5kIGF0dGVzdGF0aW9ucy4KCkF1dGhvcml0aWVzIGFyZSByZWdpc3RlcmVkIGVudGl0aWVzIHdpdGggc3BlY2lmaWMgcGVybWlzc2lvbnMgaW4gdGhlIHN5c3RlbQp0aGF0IGNhbiBjcmVhdGUgc2NoZW1hcyBhbmQgaXNzdWUgYXR0ZXN0YXRpb25zLgAAAAAAAAAACUF1dGhvcml0eQAAAAAAAAIAAAAkVGhlIFN0ZWxsYXIgYWRkcmVzcyBvZiB0aGUgYXV0aG9yaXR5AAAAB2FkZHJlc3MAAAAAEwAAAGhNZXRhZGF0YSBkZXNjcmliaW5nIHRoZSBhdXRob3JpdHkKClR5cGljYWxseSBpbiBKU09OIGZvcm1hdCwgY29udGFpbmluZyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgYXV0aG9yaXR5LgAAAAhtZXRhZGF0YQAAABA=",
        "AAAAAQAAAr3ilZTilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZcK4pWRICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU2NoZW1hICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg4pWRCuKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVnQoKUmVwcmVzZW50cyBhIHNjaGVtYSBkZWZpbml0aW9uIHRoYXQgYXR0ZXN0YXRpb25zIGNhbiBmb2xsb3cuCgpTY2hlbWFzIGRlZmluZSB0aGUgc3RydWN0dXJlLCB2YWxpZGF0aW9uIHJ1bGVzLCBhbmQgYmVoYXZpb3IgZm9yIGF0dGVzdGF0aW9ucwp0aGF0IHJlZmVyZW5jZSB0aGVtLgAAAAAAAAAAAAAGU2NoZW1hAAAAAAAEAAAANVRoZSBhZGRyZXNzIG9mIHRoZSBhdXRob3JpdHkgdGhhdCBjcmVhdGVkIHRoaXMgc2NoZW1hAAAAAAAACWF1dGhvcml0eQAAAAAAABMAAABlVGhlIHNjaGVtYSBkZWZpbml0aW9uCgpUeXBpY2FsbHkgaW4gSlNPTiBmb3JtYXQsIGRlc2NyaWJpbmcgdGhlIHN0cnVjdHVyZSBhbmQgcnVsZXMgZm9yIGF0dGVzdGF0aW9ucy4AAAAAAAAKZGVmaW5pdGlvbgAAAAAAEAAAAINPcHRpb25hbCBhZGRyZXNzIG9mIGEgcmVzb2x2ZXIgY29udHJhY3QgZm9yIHRoaXMgc2NoZW1hCgpJZiBwcmVzZW50LCB0aGlzIGNvbnRyYWN0IHdpbGwgYmUgY2FsbGVkIHRvIGhhbmRsZSBhdHRlc3RhdGlvbiBvcGVyYXRpb25zLgAAAAAIcmVzb2x2ZXIAAAPoAAAAEwAAADVXaGV0aGVyIGF0dGVzdGF0aW9ucyB1c2luZyB0aGlzIHNjaGVtYSBjYW4gYmUgcmV2b2tlZAAAAAAAAAlyZXZvY2FibGUAAAAAAAAB",
        "AAAAAQAAAsfilZTilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZcK4pWRICAgICAgICAgICAgICAgICAgICAgICAgICBBdHRlc3RhdGlvblJlY29yZCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg4pWRCuKVmuKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVnQoKUmVwcmVzZW50cyBhIHJlY29yZCBvZiBhbiBhdHRlc3RhdGlvbiB3aXRoIHNpbXBsaWZpZWQgZmllbGRzLgoKVXNlZCBmb3IgdHJhY2tpbmcgYXR0ZXN0YXRpb25zIGluIGEgbW9yZSBjb21wYWN0IGZvcm0gYW5kIGZvciByZXR1cm5pbmcKYXR0ZXN0YXRpb24gaW5mb3JtYXRpb24gdG8gY2FsbGVycy4AAAAAAAAAABFBdHRlc3RhdGlvblJlY29yZAAAAAAAAAUAAACRT3B0aW9uYWwgcmVmZXJlbmNlIHN0cmluZyB0byBkaXN0aW5ndWlzaCBiZXR3ZWVuIG11bHRpcGxlIGF0dGVzdGF0aW9ucwoKQWxsb3dzIGZvciBtdWx0aXBsZSBhdHRlc3RhdGlvbnMgb2YgdGhlIHNhbWUgc2NoZW1hIGZvciB0aGUgc2FtZSBzdWJqZWN0LgAAAAAAAAlyZWZlcmVuY2UAAAAAAAPoAAAAEAAAAClXaGV0aGVyIHRoaXMgYXR0ZXN0YXRpb24gaGFzIGJlZW4gcmV2b2tlZAAAAAAAAAdyZXZva2VkAAAAAAEAAAA8VGhlIHVuaXF1ZSBpZGVudGlmaWVyIG9mIHRoZSBzY2hlbWEgdGhpcyBhdHRlc3RhdGlvbiBmb2xsb3dzAAAACnNjaGVtYV91aWQAAAAAA+4AAAAgAAAAQVRoZSBhZGRyZXNzIG9mIHRoZSBlbnRpdHkgdGhhdCBpcyB0aGUgc3ViamVjdCBvZiB0aGlzIGF0dGVzdGF0aW9uAAAAAAAAB3N1YmplY3QAAAAAEwAAACdUaGUgdmFsdWUgb3IgY29udGVudCBvZiB0aGUgYXR0ZXN0YXRpb24AAAAABXZhbHVlAAAAAAAAEA==",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAAIcmVnaXN0ZXIAAAAEAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAEXNjaGVtYV9kZWZpbml0aW9uAAAAAAAAEAAAAAAAAAAIcmVzb2x2ZXIAAAPoAAAAEwAAAAAAAAAJcmV2b2NhYmxlAAAAAAAAAQAAAAEAAAPpAAAD7gAAACAAAAAD",
        "AAAAAAAAAAAAAAAGYXR0ZXN0AAAAAAAFAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACnNjaGVtYV91aWQAAAAAA+4AAAAgAAAAAAAAAAdzdWJqZWN0AAAAABMAAAAAAAAABXZhbHVlAAAAAAAAEAAAAAAAAAAJcmVmZXJlbmNlAAAAAAAD6AAAABAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAAScmV2b2tlX2F0dGVzdGF0aW9uAAAAAAAEAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACnNjaGVtYV91aWQAAAAAA+4AAAAgAAAAAAAAAAdzdWJqZWN0AAAAABMAAAAAAAAACXJlZmVyZW5jZQAAAAAAA+gAAAAQAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAAPZ2V0X2F0dGVzdGF0aW9uAAAAAAMAAAAAAAAACnNjaGVtYV91aWQAAAAAA+4AAAAgAAAAAAAAAAdzdWJqZWN0AAAAABMAAAAAAAAACXJlZmVyZW5jZQAAAAAAA+gAAAAQAAAAAQAAA+kAAAfQAAAAEUF0dGVzdGF0aW9uUmVjb3JkAAAAAAAAAw==" ]),
      options
    )
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<Result<void>>,
        register: this.txFromJSON<Result<Buffer>>,
        attest: this.txFromJSON<Result<void>>,
        revoke_attestation: this.txFromJSON<Result<void>>,
        get_attestation: this.txFromJSON<Result<AttestationRecord>>
  }
}