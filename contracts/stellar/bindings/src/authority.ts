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
    contractId: "CBCOY75QHFUJM4CFVZV355RRMX2655O4BA5MD3DZ2PVLSH3D3JYW6JSX",
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
  11: {message:"WithdrawalFailed"},
  12: {message:"UnauthorizedVerifier"},
  13: {message:"VerifierInactive"},
  14: {message:"ExceedsVerificationLevel"},
  15: {message:"InvalidVerificationLevel"},
  16: {message:"VerifierNotFound"},
  17: {message:"InvalidAuthorityData"}
}


export interface Attestation {
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
 * Payment record for organizations that paid the verification fee
 */
export interface PaymentRecord {
  amount_paid: i128;
  recipient: string;
  ref_id: string;
  timestamp: u64;
}


/**
 * Data stored for an authority that paid for verification
 */
export interface RegisteredAuthorityData {
  address: string;
  metadata: string;
  ref_id: string;
  registration_time: u64;
}

export type DataKey = {tag: "Admin", values: void} | {tag: "Initialized", values: void} | {tag: "RegistrationFee", values: void} | {tag: "PaymentRecord", values: void} | {tag: "Authority", values: void} | {tag: "TokenId", values: void} | {tag: "TokenWasmHash", values: void} | {tag: "CollectedLevies", values: void} | {tag: "CollectedFees", values: void} | {tag: "RegAuthPrefix", values: void} | {tag: "CollLevyPrefix", values: void};


export interface ResolverAttestationData {
  attester: string;
  data: Buffer;
  expiration_time: u64;
  recipient: string;
  revocable: boolean;
  schema_uid: Buffer;
  timestamp: u64;
  uid: Buffer;
}


export interface ResolverMetadata {
  description: string;
  name: string;
  resolver_type: ResolverType;
  version: string;
}

export type ResolverType = {tag: "Default", values: void} | {tag: "Authority", values: void} | {tag: "TokenReward", values: void} | {tag: "FeeCollection", values: void} | {tag: "Hybrid", values: void} | {tag: "Staking", values: void} | {tag: "Custom", values: void};

export const ResolverError = {
  1: {message:"NotAuthorized"},
  2: {message:"InvalidAttestation"},
  3: {message:"InvalidSchema"},
  4: {message:"InsufficientFunds"},
  5: {message:"TokenTransferFailed"},
  6: {message:"StakeRequired"},
  7: {message:"ValidationFailed"},
  8: {message:"CustomError"}
}

export interface Client {
  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({admin, token_contract_id, token_wasm_hash}: {admin: string, token_contract_id: string, token_wasm_hash: Buffer}, options?: {
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
  attest: ({attestation}: {attestation: Attestation}, options?: {
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
  revoke: ({attestation}: {attestation: Attestation}, options?: {
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
   * Construct and simulate a withdraw_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw collected XLM fees for an authority
   */
  withdraw_fees: ({caller}: {caller: string}, options?: {
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
   * Construct and simulate a get_collected_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get collected XLM fees for an authority
   */
  get_collected_fees: ({authority}: {authority: string}, options?: {
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

  /**
   * Construct and simulate a transfer_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Transfer ownership of the contract to a new address
   * 
   * # Arguments
   * * `env` - The Soroban environment
   * * `current_owner` - The current owner address (must be authenticated)
   * * `new_owner` - The address to transfer ownership to
   * 
   * # Returns
   * * `Ok(())` - If ownership transfer is successful
   * * `Err(Error)` - If not authorized or validation fails
   */
  transfer_ownership: ({current_owner, new_owner}: {current_owner: string, new_owner: string}, options?: {
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
   * Construct and simulate a renounce_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Renounce ownership of the contract (permanent action)
   * 
   * # Arguments
   * * `env` - The Soroban environment
   * * `current_owner` - The current owner address (must be authenticated)
   * 
   * # Returns
   * * `Ok(())` - If ownership renunciation is successful
   * * `Err(Error)` - If not authorized
   * 
   * # Warning
   * This is irreversible! After renouncing ownership, all admin functions become inaccessible.
   */
  renounce_ownership: ({current_owner}: {current_owner: string}, options?: {
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
   * Construct and simulate a get_owner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the current owner of the contract
   * 
   * # Arguments
   * * `env` - The Soroban environment
   * 
   * # Returns
   * * `Ok(Address)` - The current owner address
   * * `Err(Error)` - If no owner is set (contract not initialized)
   */
  get_owner: (options?: {
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
   * Construct and simulate a is_owner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if an address is the current owner
   * 
   * # Arguments
   * * `env` - The Soroban environment
   * * `address` - The address to check
   * 
   * # Returns
   * * `bool` - True if the address is the owner, false otherwise
   */
  is_owner: ({address}: {address: string}, options?: {
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
  }) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a pay_verification_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Pay verification fee to become eligible for authority registration
   */
  pay_verification_fee: ({payer, ref_id, token_address}: {payer: string, ref_id: string, token_address: string}, options?: {
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
   * Construct and simulate a has_confirmed_payment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if an address has confirmed payment
   */
  has_confirmed_payment: ({payer}: {payer: string}, options?: {
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
  }) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_payment_record transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get payment record for an address
   */
  get_payment_record: ({payer}: {payer: string}, options?: {
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
  }) => Promise<AssembledTransaction<Option<PaymentRecord>>>

  /**
   * Construct and simulate a admin_withdraw_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin function to withdraw collected fees
   */
  admin_withdraw_fees: ({admin, token_address, amount}: {admin: string, token_address: string, amount: i128}, options?: {
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
   * Construct and simulate a before_attest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Called before an attestation is created (resolver interface)
   */
  before_attest: ({attestation}: {attestation: ResolverAttestationData}, options?: {
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
   * Construct and simulate a after_attest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Called after an attestation is created (resolver interface)
   */
  after_attest: ({attestation}: {attestation: ResolverAttestationData}, options?: {
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
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAEQAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAANTm90QXV0aG9yaXplZAAAAAAAAAMAAAAAAAAAFVJlY2lwaWVudE5vdEF1dGhvcml0eQAAAAAAAAQAAAAAAAAAFEF0dGVzdGVyTm90QXV0aG9yaXR5AAAABQAAAAAAAAATU2NoZW1hTm90UmVnaXN0ZXJlZAAAAAAGAAAAAAAAABJJbnZhbGlkU2NoZW1hUnVsZXMAAAAAAAcAAAAAAAAAE0luc3VmZmljaWVudFBheW1lbnQAAAAACAAAAAAAAAARTm90aGluZ1RvV2l0aGRyYXcAAAAAAAAJAAAAAAAAABNUb2tlblRyYW5zZmVyRmFpbGVkAAAAAAoAAAAAAAAAEFdpdGhkcmF3YWxGYWlsZWQAAAALAAAAAAAAABRVbmF1dGhvcml6ZWRWZXJpZmllcgAAAAwAAAAAAAAAEFZlcmlmaWVySW5hY3RpdmUAAAANAAAAAAAAABhFeGNlZWRzVmVyaWZpY2F0aW9uTGV2ZWwAAAAOAAAAAAAAABhJbnZhbGlkVmVyaWZpY2F0aW9uTGV2ZWwAAAAPAAAAAAAAABBWZXJpZmllck5vdEZvdW5kAAAAEAAAAAAAAAAUSW52YWxpZEF1dGhvcml0eURhdGEAAAAR",
        "AAAAAQAAAAAAAAAAAAAAC0F0dGVzdGF0aW9uAAAAAAoAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAAAAAAEZGF0YQAAAA4AAAAAAAAAD2V4cGlyYXRpb25fdGltZQAAAAPoAAAABgAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAHcmVmX3VpZAAAAAPoAAAADgAAAAAAAAAJcmV2b2NhYmxlAAAAAAAAAQAAAAAAAAAKc2NoZW1hX3VpZAAAAAAD7gAAACAAAAAAAAAABHRpbWUAAAAGAAAAAAAAAAN1aWQAAAAD7gAAACAAAAAAAAAABXZhbHVlAAAAAAAD6AAAAAs=",
        "AAAAAQAAAD9QYXltZW50IHJlY29yZCBmb3Igb3JnYW5pemF0aW9ucyB0aGF0IHBhaWQgdGhlIHZlcmlmaWNhdGlvbiBmZWUAAAAAAAAAAA1QYXltZW50UmVjb3JkAAAAAAAABAAAAAAAAAALYW1vdW50X3BhaWQAAAAACwAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAGcmVmX2lkAAAAAAAQAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAG",
        "AAAAAQAAADdEYXRhIHN0b3JlZCBmb3IgYW4gYXV0aG9yaXR5IHRoYXQgcGFpZCBmb3IgdmVyaWZpY2F0aW9uAAAAAAAAAAAXUmVnaXN0ZXJlZEF1dGhvcml0eURhdGEAAAAABAAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAAAAAAhtZXRhZGF0YQAAABAAAAAAAAAABnJlZl9pZAAAAAAAEAAAAAAAAAARcmVnaXN0cmF0aW9uX3RpbWUAAAAAAAAG",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACwAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAALSW5pdGlhbGl6ZWQAAAAAAAAAAAAAAAAPUmVnaXN0cmF0aW9uRmVlAAAAAAAAAAAAAAAADVBheW1lbnRSZWNvcmQAAAAAAAAAAAAAAAAAAAlBdXRob3JpdHkAAAAAAAAAAAAAAAAAAAdUb2tlbklkAAAAAAAAAAAAAAAADVRva2VuV2FzbUhhc2gAAAAAAAAAAAAAAAAAAA9Db2xsZWN0ZWRMZXZpZXMAAAAAAAAAAAAAAAANQ29sbGVjdGVkRmVlcwAAAAAAAAAAAAAAAAAADVJlZ0F1dGhQcmVmaXgAAAAAAAAAAAAAAAAAAA5Db2xsTGV2eVByZWZpeAAA",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAABF0b2tlbl9jb250cmFjdF9pZAAAAAAAABMAAAAAAAAAD3Rva2VuX3dhc21faGFzaAAAAAPuAAAAIAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAAYYWRtaW5fcmVnaXN0ZXJfYXV0aG9yaXR5AAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAthdXRoX3RvX3JlZwAAAAATAAAAAAAAAAhtZXRhZGF0YQAAABAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAAScmVnaXN0ZXJfYXV0aG9yaXR5AAAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAEGF1dGhvcml0eV90b19yZWcAAAATAAAAAAAAAAhtZXRhZGF0YQAAABAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAAMaXNfYXV0aG9yaXR5AAAAAQAAAAAAAAAJYXV0aG9yaXR5AAAAAAAAEwAAAAEAAAPpAAAAAQAAAAM=",
        "AAAAAAAAAAAAAAAGYXR0ZXN0AAAAAAABAAAAAAAAAAthdHRlc3RhdGlvbgAAAAfQAAAAC0F0dGVzdGF0aW9uAAAAAAEAAAPpAAAAAQAAAAM=",
        "AAAAAAAAAAAAAAAGcmV2b2tlAAAAAAABAAAAAAAAAAthdHRlc3RhdGlvbgAAAAfQAAAAC0F0dGVzdGF0aW9uAAAAAAEAAAPpAAAAAQAAAAM=",
        "AAAAAAAAAAAAAAAPd2l0aGRyYXdfbGV2aWVzAAAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAACxXaXRoZHJhdyBjb2xsZWN0ZWQgWExNIGZlZXMgZm9yIGFuIGF1dGhvcml0eQAAAA13aXRoZHJhd19mZWVzAAAAAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAAUZ2V0X2NvbGxlY3RlZF9sZXZpZXMAAAABAAAAAAAAAAlhdXRob3JpdHkAAAAAAAATAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAACdHZXQgY29sbGVjdGVkIFhMTSBmZWVzIGZvciBhbiBhdXRob3JpdHkAAAAAEmdldF9jb2xsZWN0ZWRfZmVlcwAAAAAAAQAAAAAAAAAJYXV0aG9yaXR5AAAAAAAAEwAAAAEAAAPpAAAACwAAAAM=",
        "AAAAAAAAAAAAAAAMZ2V0X3Rva2VuX2lkAAAAAAAAAAEAAAPpAAAAEwAAAAM=",
        "AAAAAAAAAAAAAAARZ2V0X2FkbWluX2FkZHJlc3MAAAAAAAAAAAAAAQAAA+kAAAATAAAAAw==",
        "AAAAAAAAAVBUcmFuc2ZlciBvd25lcnNoaXAgb2YgdGhlIGNvbnRyYWN0IHRvIGEgbmV3IGFkZHJlc3MKCiMgQXJndW1lbnRzCiogYGVudmAgLSBUaGUgU29yb2JhbiBlbnZpcm9ubWVudAoqIGBjdXJyZW50X293bmVyYCAtIFRoZSBjdXJyZW50IG93bmVyIGFkZHJlc3MgKG11c3QgYmUgYXV0aGVudGljYXRlZCkKKiBgbmV3X293bmVyYCAtIFRoZSBhZGRyZXNzIHRvIHRyYW5zZmVyIG93bmVyc2hpcCB0bwoKIyBSZXR1cm5zCiogYE9rKCgpKWAgLSBJZiBvd25lcnNoaXAgdHJhbnNmZXIgaXMgc3VjY2Vzc2Z1bAoqIGBFcnIoRXJyb3IpYCAtIElmIG5vdCBhdXRob3JpemVkIG9yIHZhbGlkYXRpb24gZmFpbHMAAAASdHJhbnNmZXJfb3duZXJzaGlwAAAAAAACAAAAAAAAAA1jdXJyZW50X293bmVyAAAAAAAAEwAAAAAAAAAJbmV3X293bmVyAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAXNSZW5vdW5jZSBvd25lcnNoaXAgb2YgdGhlIGNvbnRyYWN0IChwZXJtYW5lbnQgYWN0aW9uKQoKIyBBcmd1bWVudHMKKiBgZW52YCAtIFRoZSBTb3JvYmFuIGVudmlyb25tZW50CiogYGN1cnJlbnRfb3duZXJgIC0gVGhlIGN1cnJlbnQgb3duZXIgYWRkcmVzcyAobXVzdCBiZSBhdXRoZW50aWNhdGVkKQoKIyBSZXR1cm5zCiogYE9rKCgpKWAgLSBJZiBvd25lcnNoaXAgcmVudW5jaWF0aW9uIGlzIHN1Y2Nlc3NmdWwKKiBgRXJyKEVycm9yKWAgLSBJZiBub3QgYXV0aG9yaXplZAoKIyBXYXJuaW5nClRoaXMgaXMgaXJyZXZlcnNpYmxlISBBZnRlciByZW5vdW5jaW5nIG93bmVyc2hpcCwgYWxsIGFkbWluIGZ1bmN0aW9ucyBiZWNvbWUgaW5hY2Nlc3NpYmxlLgAAAAAScmVub3VuY2Vfb3duZXJzaGlwAAAAAAABAAAAAAAAAA1jdXJyZW50X293bmVyAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAMpHZXQgdGhlIGN1cnJlbnQgb3duZXIgb2YgdGhlIGNvbnRyYWN0CgojIEFyZ3VtZW50cwoqIGBlbnZgIC0gVGhlIFNvcm9iYW4gZW52aXJvbm1lbnQKCiMgUmV0dXJucwoqIGBPayhBZGRyZXNzKWAgLSBUaGUgY3VycmVudCBvd25lciBhZGRyZXNzCiogYEVycihFcnJvcilgIC0gSWYgbm8gb3duZXIgaXMgc2V0IChjb250cmFjdCBub3QgaW5pdGlhbGl6ZWQpAAAAAAAJZ2V0X293bmVyAAAAAAAAAAAAAAEAAAPpAAAAEwAAAAM=",
        "AAAAAAAAAMJDaGVjayBpZiBhbiBhZGRyZXNzIGlzIHRoZSBjdXJyZW50IG93bmVyCgojIEFyZ3VtZW50cwoqIGBlbnZgIC0gVGhlIFNvcm9iYW4gZW52aXJvbm1lbnQKKiBgYWRkcmVzc2AgLSBUaGUgYWRkcmVzcyB0byBjaGVjawoKIyBSZXR1cm5zCiogYGJvb2xgIC0gVHJ1ZSBpZiB0aGUgYWRkcmVzcyBpcyB0aGUgb3duZXIsIGZhbHNlIG90aGVyd2lzZQAAAAAACGlzX293bmVyAAAAAQAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAQAAAAE=",
        "AAAAAAAAAEJQYXkgdmVyaWZpY2F0aW9uIGZlZSB0byBiZWNvbWUgZWxpZ2libGUgZm9yIGF1dGhvcml0eSByZWdpc3RyYXRpb24AAAAAABRwYXlfdmVyaWZpY2F0aW9uX2ZlZQAAAAMAAAAAAAAABXBheWVyAAAAAAAAEwAAAAAAAAAGcmVmX2lkAAAAAAAQAAAAAAAAAA10b2tlbl9hZGRyZXNzAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAClDaGVjayBpZiBhbiBhZGRyZXNzIGhhcyBjb25maXJtZWQgcGF5bWVudAAAAAAAABVoYXNfY29uZmlybWVkX3BheW1lbnQAAAAAAAABAAAAAAAAAAVwYXllcgAAAAAAABMAAAABAAAAAQ==",
        "AAAAAAAAACFHZXQgcGF5bWVudCByZWNvcmQgZm9yIGFuIGFkZHJlc3MAAAAAAAASZ2V0X3BheW1lbnRfcmVjb3JkAAAAAAABAAAAAAAAAAVwYXllcgAAAAAAABMAAAABAAAD6AAAB9AAAAANUGF5bWVudFJlY29yZAAAAA==",
        "AAAAAAAAAClBZG1pbiBmdW5jdGlvbiB0byB3aXRoZHJhdyBjb2xsZWN0ZWQgZmVlcwAAAAAAABNhZG1pbl93aXRoZHJhd19mZWVzAAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAANdG9rZW5fYWRkcmVzcwAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAADxDYWxsZWQgYmVmb3JlIGFuIGF0dGVzdGF0aW9uIGlzIGNyZWF0ZWQgKHJlc29sdmVyIGludGVyZmFjZSkAAAANYmVmb3JlX2F0dGVzdAAAAAAAAAEAAAAAAAAAC2F0dGVzdGF0aW9uAAAAB9AAAAAXUmVzb2x2ZXJBdHRlc3RhdGlvbkRhdGEAAAAAAQAAA+kAAAABAAAH0AAAAA1SZXNvbHZlckVycm9yAAAA",
        "AAAAAAAAADtDYWxsZWQgYWZ0ZXIgYW4gYXR0ZXN0YXRpb24gaXMgY3JlYXRlZCAocmVzb2x2ZXIgaW50ZXJmYWNlKQAAAAAMYWZ0ZXJfYXR0ZXN0AAAAAQAAAAAAAAALYXR0ZXN0YXRpb24AAAAH0AAAABdSZXNvbHZlckF0dGVzdGF0aW9uRGF0YQAAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA1SZXNvbHZlckVycm9yAAAA",
        "AAAAAQAAAAAAAAAAAAAAF1Jlc29sdmVyQXR0ZXN0YXRpb25EYXRhAAAAAAgAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAAAAAAEZGF0YQAAAA4AAAAAAAAAD2V4cGlyYXRpb25fdGltZQAAAAAGAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAlyZXZvY2FibGUAAAAAAAABAAAAAAAAAApzY2hlbWFfdWlkAAAAAAPuAAAAIAAAAAAAAAAJdGltZXN0YW1wAAAAAAAABgAAAAAAAAADdWlkAAAAA+4AAAAg",
        "AAAAAQAAAAAAAAAAAAAAEFJlc29sdmVyTWV0YWRhdGEAAAAEAAAAAAAAAAtkZXNjcmlwdGlvbgAAAAAQAAAAAAAAAARuYW1lAAAAEAAAAAAAAAANcmVzb2x2ZXJfdHlwZQAAAAAAB9AAAAAMUmVzb2x2ZXJUeXBlAAAAAAAAAAd2ZXJzaW9uAAAAABA=",
        "AAAAAgAAAAAAAAAAAAAADFJlc29sdmVyVHlwZQAAAAcAAAAAAAAAAAAAAAdEZWZhdWx0AAAAAAAAAAAAAAAACUF1dGhvcml0eQAAAAAAAAAAAAAAAAAAC1Rva2VuUmV3YXJkAAAAAAAAAAAAAAAADUZlZUNvbGxlY3Rpb24AAAAAAAAAAAAAAAAAAAZIeWJyaWQAAAAAAAAAAAAAAAAAB1N0YWtpbmcAAAAAAAAAAAAAAAAGQ3VzdG9tAAA=",
        "AAAABAAAAAAAAAAAAAAADVJlc29sdmVyRXJyb3IAAAAAAAAIAAAAAAAAAA1Ob3RBdXRob3JpemVkAAAAAAAAAQAAAAAAAAASSW52YWxpZEF0dGVzdGF0aW9uAAAAAAACAAAAAAAAAA1JbnZhbGlkU2NoZW1hAAAAAAAAAwAAAAAAAAARSW5zdWZmaWNpZW50RnVuZHMAAAAAAAAEAAAAAAAAABNUb2tlblRyYW5zZmVyRmFpbGVkAAAAAAUAAAAAAAAADVN0YWtlUmVxdWlyZWQAAAAAAAAGAAAAAAAAABBWYWxpZGF0aW9uRmFpbGVkAAAABwAAAAAAAAALQ3VzdG9tRXJyb3IAAAAACA==" ]),
      options
    )
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<Result<void>>,
        admin_register_authority: this.txFromJSON<Result<void>>,
        register_authority: this.txFromJSON<Result<void>>,
        is_authority: this.txFromJSON<Result<boolean>>,
        attest: this.txFromJSON<Result<boolean>>,
        revoke: this.txFromJSON<Result<boolean>>,
        withdraw_levies: this.txFromJSON<Result<void>>,
        withdraw_fees: this.txFromJSON<Result<void>>,
        get_collected_levies: this.txFromJSON<Result<i128>>,
        get_collected_fees: this.txFromJSON<Result<i128>>,
        get_token_id: this.txFromJSON<Result<string>>,
        get_admin_address: this.txFromJSON<Result<string>>,
        transfer_ownership: this.txFromJSON<Result<void>>,
        renounce_ownership: this.txFromJSON<Result<void>>,
        get_owner: this.txFromJSON<Result<string>>,
        is_owner: this.txFromJSON<boolean>,
        pay_verification_fee: this.txFromJSON<Result<void>>,
        has_confirmed_payment: this.txFromJSON<boolean>,
        get_payment_record: this.txFromJSON<Option<PaymentRecord>>,
        admin_withdraw_fees: this.txFromJSON<Result<void>>,
        before_attest: this.txFromJSON<Result<boolean>>,
        after_attest: this.txFromJSON<Result<void>>
  }
}