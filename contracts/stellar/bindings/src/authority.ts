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
    contractId: "CC673T4LKURVLKJFRECXAEILKLXX74FQQTFIR5FLKZJJDDZ5Y5NLWF7O",
  }
} as const

export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"NotAuthorized"},
  4: {message:"RecipientNotAuthority"},
  5: {message:"AttesterNotAuthority"},
  6: {message:"SchemaNotRegistered"},
  7: {message:"InvalidSchemaRules"},
  8: {message:"InsufficientPayment"},
  9: {message:"NothingToWithdraw"},
  10: {message:"TokenTransferFailed"},
  11: {message:"WithdrawalFailed"}
}


export interface AttestationRecord {
  attester: string;
  data: Buffer;
  expiration_time: Option<u64>;
  recipient: string;
  ref_uid: Option<Buffer>;
  revocable: boolean;
  schema_uid: Buffer;
  time: u64;
  uid: Buffer;
  value: Option<i128>;
}


/**
 * Data stored for an authority registered by the admin.
 */
export interface RegisteredAuthorityData {
  address: string;
  metadata: string;
  registration_time: u64;
}


/**
 * Data stored for schema levy information.
 */
export interface SchemaRules {
  levy_amount: Option<i128>;
  levy_recipient: Option<string>;
}

export type DataKey = {tag: "Admin", values: void} | {tag: "TokenId", values: void} | {tag: "RegistrationFee", values: void} | {tag: "Initialized", values: void} | {tag: "RegAuthPrefix", values: void} | {tag: "SchemaRulePrefix", values: void} | {tag: "CollLevyPrefix", values: void};

export interface Client {
  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({admin, token_contract_id}: {admin: string, token_contract_id: string}, options?: {
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
   * Construct and simulate a admin_register_authority transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin_register_authority: ({admin, auth_to_reg, metadata}: {admin: string, auth_to_reg: string, metadata: string}, options?: {
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
   * Construct and simulate a admin_register_schema transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin_register_schema: ({admin, schema_uid, rules}: {admin: string, schema_uid: Buffer, rules: SchemaRules}, options?: {
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
   * Construct and simulate a admin_set_schema_levy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin_set_schema_levy: ({admin, schema_uid, levy_amount, levy_recipient}: {admin: string, schema_uid: Buffer, levy_amount: i128, levy_recipient: string}, options?: {
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
   * Construct and simulate a admin_set_registration_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin_set_registration_fee: ({admin, fee_amount, token_id}: {admin: string, fee_amount: i128, token_id: string}, options?: {
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
   * Construct and simulate a register_authority transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_authority: ({caller, authority_to_reg, metadata}: {caller: string, authority_to_reg: string, metadata: string}, options?: {
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
   * Construct and simulate a is_authority transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_authority: ({authority}: {authority: string}, options?: {
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
  }) => Promise<AssembledTransaction<Result<boolean>>>

  /**
   * Construct and simulate a attest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  attest: ({attestation}: {attestation: AttestationRecord}, options?: {
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
  }) => Promise<AssembledTransaction<Result<boolean>>>

  /**
   * Construct and simulate a revoke transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  revoke: ({attestation}: {attestation: AttestationRecord}, options?: {
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
  }) => Promise<AssembledTransaction<Result<boolean>>>

  /**
   * Construct and simulate a withdraw_levies transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  withdraw_levies: ({caller}: {caller: string}, options?: {
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
   * Construct and simulate a get_schema_rules transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_schema_rules: ({schema_uid}: {schema_uid: Buffer}, options?: {
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
  }) => Promise<AssembledTransaction<Result<Option<SchemaRules>>>>

  /**
   * Construct and simulate a get_collected_levies transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_collected_levies: ({authority}: {authority: string}, options?: {
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
  }) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_token_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_token_id: (options?: {
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
  }) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a get_admin_address transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin_address: (options?: {
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
  }) => Promise<AssembledTransaction<Result<string>>>

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
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACwAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAANTm90QXV0aG9yaXplZAAAAAAAAAMAAAAAAAAAFVJlY2lwaWVudE5vdEF1dGhvcml0eQAAAAAAAAQAAAAAAAAAFEF0dGVzdGVyTm90QXV0aG9yaXR5AAAABQAAAAAAAAATU2NoZW1hTm90UmVnaXN0ZXJlZAAAAAAGAAAAAAAAABJJbnZhbGlkU2NoZW1hUnVsZXMAAAAAAAcAAAAAAAAAE0luc3VmZmljaWVudFBheW1lbnQAAAAACAAAAAAAAAARTm90aGluZ1RvV2l0aGRyYXcAAAAAAAAJAAAAAAAAABNUb2tlblRyYW5zZmVyRmFpbGVkAAAAAAoAAAAAAAAAEFdpdGhkcmF3YWxGYWlsZWQAAAAL",
        "AAAAAQAAAAAAAAAAAAAAEUF0dGVzdGF0aW9uUmVjb3JkAAAAAAAACgAAAAAAAAAIYXR0ZXN0ZXIAAAATAAAAAAAAAARkYXRhAAAADgAAAAAAAAAPZXhwaXJhdGlvbl90aW1lAAAAA+gAAAAGAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAdyZWZfdWlkAAAAA+gAAAAOAAAAAAAAAAlyZXZvY2FibGUAAAAAAAABAAAAAAAAAApzY2hlbWFfdWlkAAAAAAPuAAAAIAAAAAAAAAAEdGltZQAAAAYAAAAAAAAAA3VpZAAAAAPuAAAAIAAAAAAAAAAFdmFsdWUAAAAAAAPoAAAACw==",
        "AAAAAQAAADVEYXRhIHN0b3JlZCBmb3IgYW4gYXV0aG9yaXR5IHJlZ2lzdGVyZWQgYnkgdGhlIGFkbWluLgAAAAAAAAAAAAAXUmVnaXN0ZXJlZEF1dGhvcml0eURhdGEAAAAAAwAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAAAAAAhtZXRhZGF0YQAAABAAAAAAAAAAEXJlZ2lzdHJhdGlvbl90aW1lAAAAAAAABg==",
        "AAAAAQAAAChEYXRhIHN0b3JlZCBmb3Igc2NoZW1hIGxldnkgaW5mb3JtYXRpb24uAAAAAAAAAAtTY2hlbWFSdWxlcwAAAAACAAAAAAAAAAtsZXZ5X2Ftb3VudAAAAAPoAAAACwAAAAAAAAAObGV2eV9yZWNpcGllbnQAAAAAA+gAAAAT",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABwAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAHVG9rZW5JZAAAAAAAAAAAAAAAAA9SZWdpc3RyYXRpb25GZWUAAAAAAAAAAAAAAAALSW5pdGlhbGl6ZWQAAAAAAAAAAAAAAAANUmVnQXV0aFByZWZpeAAAAAAAAAAAAAAAAAAAEFNjaGVtYVJ1bGVQcmVmaXgAAAAAAAAAAAAAAA5Db2xsTGV2eVByZWZpeAAA",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAABF0b2tlbl9jb250cmFjdF9pZAAAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAAYYWRtaW5fcmVnaXN0ZXJfYXV0aG9yaXR5AAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAthdXRoX3RvX3JlZwAAAAATAAAAAAAAAAhtZXRhZGF0YQAAABAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAAVYWRtaW5fcmVnaXN0ZXJfc2NoZW1hAAAAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAApzY2hlbWFfdWlkAAAAAAPuAAAAIAAAAAAAAAAFcnVsZXMAAAAAAAfQAAAAC1NjaGVtYVJ1bGVzAAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAAVYWRtaW5fc2V0X3NjaGVtYV9sZXZ5AAAAAAAABAAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAApzY2hlbWFfdWlkAAAAAAPuAAAAIAAAAAAAAAALbGV2eV9hbW91bnQAAAAACwAAAAAAAAAObGV2eV9yZWNpcGllbnQAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAAaYWRtaW5fc2V0X3JlZ2lzdHJhdGlvbl9mZWUAAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAKZmVlX2Ftb3VudAAAAAAACwAAAAAAAAAIdG9rZW5faWQAAAATAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAAScmVnaXN0ZXJfYXV0aG9yaXR5AAAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAEGF1dGhvcml0eV90b19yZWcAAAATAAAAAAAAAAhtZXRhZGF0YQAAABAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAAMaXNfYXV0aG9yaXR5AAAAAQAAAAAAAAAJYXV0aG9yaXR5AAAAAAAAEwAAAAEAAAPpAAAAAQAAAAM=",
        "AAAAAAAAAAAAAAAGYXR0ZXN0AAAAAAABAAAAAAAAAAthdHRlc3RhdGlvbgAAAAfQAAAAEUF0dGVzdGF0aW9uUmVjb3JkAAAAAAAAAQAAA+kAAAABAAAAAw==",
        "AAAAAAAAAAAAAAAGcmV2b2tlAAAAAAABAAAAAAAAAAthdHRlc3RhdGlvbgAAAAfQAAAAEUF0dGVzdGF0aW9uUmVjb3JkAAAAAAAAAQAAA+kAAAABAAAAAw==",
        "AAAAAAAAAAAAAAAPd2l0aGRyYXdfbGV2aWVzAAAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAAQZ2V0X3NjaGVtYV9ydWxlcwAAAAEAAAAAAAAACnNjaGVtYV91aWQAAAAAA+4AAAAgAAAAAQAAA+kAAAPoAAAH0AAAAAtTY2hlbWFSdWxlcwAAAAAD",
        "AAAAAAAAAAAAAAAUZ2V0X2NvbGxlY3RlZF9sZXZpZXMAAAABAAAAAAAAAAlhdXRob3JpdHkAAAAAAAATAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAAAAAAAAMZ2V0X3Rva2VuX2lkAAAAAAAAAAEAAAPpAAAAEwAAAAM=",
        "AAAAAAAAAAAAAAARZ2V0X2FkbWluX2FkZHJlc3MAAAAAAAAAAAAAAQAAA+kAAAATAAAAAw==" ]),
      options
    )
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<Result<void>>,
        admin_register_authority: this.txFromJSON<Result<void>>,
        admin_register_schema: this.txFromJSON<Result<void>>,
        admin_set_schema_levy: this.txFromJSON<Result<void>>,
        admin_set_registration_fee: this.txFromJSON<Result<void>>,
        register_authority: this.txFromJSON<Result<void>>,
        is_authority: this.txFromJSON<Result<boolean>>,
        attest: this.txFromJSON<Result<boolean>>,
        revoke: this.txFromJSON<Result<boolean>>,
        withdraw_levies: this.txFromJSON<Result<void>>,
        get_schema_rules: this.txFromJSON<Result<Option<SchemaRules>>>,
        get_collected_levies: this.txFromJSON<Result<i128>>,
        get_token_id: this.txFromJSON<Result<string>>,
        get_admin_address: this.txFromJSON<Result<string>>
  }
}