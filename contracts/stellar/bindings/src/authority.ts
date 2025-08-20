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
    contractId: "CBQXC5MBF2QGG4GIJCSFYPE6OR5UH653PCISYOELAC3RTVYPJG5OIJCU",
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


export interface Attestation {
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

export type DataKey = {tag: "Admin", values: void} | {tag: "Initialized", values: void} | {tag: "RewardToken", values: void} | {tag: "RewardAmount", values: void} | {tag: "TotalRewarded", values: void} | {tag: "UserRewards", values: void} | {tag: "TokenName", values: void} | {tag: "TokenSymbol", values: void} | {tag: "TokenDecimals", values: void} | {tag: "TotalSupply", values: void} | {tag: "Balance", values: void} | {tag: "Allowance", values: void};

export type DataKey = {tag: "Admin", values: void} | {tag: "Initialized", values: void} | {tag: "FeeToken", values: void} | {tag: "AttestationFee", values: void} | {tag: "FeeRecipient", values: void} | {tag: "TotalCollected", values: void} | {tag: "CollectedFees", values: void};

/**
 * Storage keys for the data associated with the allowlist extension
 */
export type AllowListStorageKey = {tag: "Allowed", values: readonly [string]};

/**
 * Storage keys for the data associated with the blocklist extension
 */
export type BlockListStorageKey = {tag: "Blocked", values: readonly [string]};


/**
 * Storage key that maps to [`AllowanceData`]
 */
export interface AllowanceKey {
  owner: string;
  spender: string;
}


/**
 * Storage container for the amount of tokens for which an allowance is granted
 * and the ledger number at which this allowance expires.
 */
export interface AllowanceData {
  amount: i128;
  live_until_ledger: u32;
}

/**
 * Storage keys for the data associated with `FungibleToken`
 */
export type StorageKey = {tag: "TotalSupply", values: void} | {tag: "Balance", values: readonly [string]} | {tag: "Allowance", values: readonly [AllowanceKey]};


/**
 * Storage container for token metadata
 */
export interface Metadata {
  decimals: u32;
  name: string;
  symbol: string;
}

/**
 * Storage key for accessing the SAC address
 */
export type SACAdminGenericDataKey = {tag: "Sac", values: void};

/**
 * Storage key for accessing the SAC address
 */
export type SACAdminWrapperDataKey = {tag: "Sac", values: void};

export const FungibleTokenError = {
  /**
   * Indicates an error related to the current balance of account from which
   * tokens are expected to be transferred.
   */
  100: {message:"InsufficientBalance"},
  /**
   * Indicates a failure with the allowance mechanism when a given spender
   * doesn't have enough allowance.
   */
  101: {message:"InsufficientAllowance"},
  /**
   * Indicates an invalid value for `live_until_ledger` when setting an
   * allowance.
   */
  102: {message:"InvalidLiveUntilLedger"},
  /**
   * Indicates an error when an input that must be >= 0
   */
  103: {message:"LessThanZero"},
  /**
   * Indicates overflow when adding two values
   */
  104: {message:"MathOverflow"},
  /**
   * Indicates access to uninitialized metadata
   */
  105: {message:"UnsetMetadata"},
  /**
   * Indicates that the operation would have caused `total_supply` to exceed
   * the `cap`.
   */
  106: {message:"ExceededCap"},
  /**
   * Indicates the supplied `cap` is not a valid cap value.
   */
  107: {message:"InvalidCap"},
  /**
   * Indicates the Cap was not set.
   */
  108: {message:"CapNotSet"},
  /**
   * Indicates the SAC address was not set.
   */
  109: {message:"SACNotSet"},
  /**
   * Indicates a SAC address different than expected.
   */
  110: {message:"SACAddressMismatch"},
  /**
   * Indicates a missing function parameter in the SAC contract context.
   */
  111: {message:"SACMissingFnParam"},
  /**
   * Indicates an invalid function parameter in the SAC contract context.
   */
  112: {message:"SACInvalidFnParam"},
  /**
   * The user is not allowed to perform this operation
   */
  113: {message:"UserNotAllowed"},
  /**
   * The user is blocked and cannot perform this operation
   */
  114: {message:"UserBlocked"}
}

/**
 * Storage keys for the data associated with the consecutive extension of
 * `NonFungibleToken`
 */
export type NFTConsecutiveStorageKey = {tag: "Approval", values: readonly [u32]} | {tag: "Owner", values: readonly [u32]} | {tag: "OwnershipBucket", values: readonly [u32]} | {tag: "BurnedToken", values: readonly [u32]};


export interface OwnerTokensKey {
  index: u32;
  owner: string;
}

/**
 * Storage keys for the data associated with the enumerable extension of
 * `NonFungibleToken`
 */
export type NFTEnumerableStorageKey = {tag: "TotalSupply", values: void} | {tag: "OwnerTokens", values: readonly [OwnerTokensKey]} | {tag: "OwnerTokensIndex", values: readonly [u32]} | {tag: "GlobalTokens", values: readonly [u32]} | {tag: "GlobalTokensIndex", values: readonly [u32]};


/**
 * Storage container for royalty information
 */
export interface RoyaltyInfo {
  basis_points: u32;
  receiver: string;
}

/**
 * Storage keys for royalty data
 */
export type NFTRoyaltiesStorageKey = {tag: "DefaultRoyalty", values: void} | {tag: "TokenRoyalty", values: readonly [u32]};


/**
 * Storage container for the token for which an approval is granted
 * and the ledger number at which this approval expires.
 */
export interface ApprovalData {
  approved: string;
  live_until_ledger: u32;
}


/**
 * Storage container for token metadata
 */
export interface Metadata {
  base_uri: string;
  name: string;
  symbol: string;
}

/**
 * Storage keys for the data associated with `NonFungibleToken`
 */
export type NFTStorageKey = {tag: "Owner", values: readonly [u32]} | {tag: "Balance", values: readonly [string]} | {tag: "Approval", values: readonly [u32]} | {tag: "ApprovalForAll", values: readonly [string, string]} | {tag: "Metadata", values: void};

export type NFTSequentialStorageKey = {tag: "TokenIdCounter", values: void};

export const NonFungibleTokenError = {
  /**
   * Indicates a non-existent `token_id`.
   */
  200: {message:"NonExistentToken"},
  /**
   * Indicates an error related to the ownership over a particular token.
   * Used in transfers.
   */
  201: {message:"IncorrectOwner"},
  /**
   * Indicates a failure with the `operator`s approval. Used in transfers.
   */
  202: {message:"InsufficientApproval"},
  /**
   * Indicates a failure with the `approver` of a token to be approved. Used
   * in approvals.
   */
  203: {message:"InvalidApprover"},
  /**
   * Indicates an invalid value for `live_until_ledger` when setting
   * approvals.
   */
  204: {message:"InvalidLiveUntilLedger"},
  /**
   * Indicates overflow when adding two values
   */
  205: {message:"MathOverflow"},
  /**
   * Indicates all possible `token_id`s are already in use.
   */
  206: {message:"TokenIDsAreDepleted"},
  /**
   * Indicates an invalid amount to batch mint in `consecutive` extension.
   */
  207: {message:"InvalidAmount"},
  /**
   * Indicates the token does not exist in owner's list.
   */
  208: {message:"TokenNotFoundInOwnerList"},
  /**
   * Indicates the token does not exist in global list.
   */
  209: {message:"TokenNotFoundInGlobalList"},
  /**
   * Indicates access to unset metadata.
   */
  210: {message:"UnsetMetadata"},
  /**
   * Indicates the length of the base URI exceeds the maximum allowed.
   */
  211: {message:"BaseUriMaxLenExceeded"},
  /**
   * Indicates the royalty amount is higher than 10_000 (100%) basis points.
   */
  212: {message:"InvalidRoyaltyAmount"}
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
  before_attest: ({attestation}: {attestation: ResolverAttestation}, options?: {
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
  after_attest: ({attestation}: {attestation: ResolverAttestation}, options?: {
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
        "AAAAAAAAADxDYWxsZWQgYmVmb3JlIGFuIGF0dGVzdGF0aW9uIGlzIGNyZWF0ZWQgKHJlc29sdmVyIGludGVyZmFjZSkAAAANYmVmb3JlX2F0dGVzdAAAAAAAAAEAAAAAAAAAC2F0dGVzdGF0aW9uAAAAB9AAAAATUmVzb2x2ZXJBdHRlc3RhdGlvbgAAAAABAAAD6QAAAAEAAAfQAAAADVJlc29sdmVyRXJyb3IAAAA=",
        "AAAAAAAAADtDYWxsZWQgYWZ0ZXIgYW4gYXR0ZXN0YXRpb24gaXMgY3JlYXRlZCAocmVzb2x2ZXIgaW50ZXJmYWNlKQAAAAAMYWZ0ZXJfYXR0ZXN0AAAAAQAAAAAAAAALYXR0ZXN0YXRpb24AAAAH0AAAABNSZXNvbHZlckF0dGVzdGF0aW9uAAAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADVJlc29sdmVyRXJyb3IAAAA=",
        "AAAAAQAAAAAAAAAAAAAAC0F0dGVzdGF0aW9uAAAAAAgAAAAAAAAACGF0dGVzdGVyAAAAEwAAAAAAAAAEZGF0YQAAAA4AAAAAAAAAD2V4cGlyYXRpb25fdGltZQAAAAAGAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAlyZXZvY2FibGUAAAAAAAABAAAAAAAAAApzY2hlbWFfdWlkAAAAAAPuAAAAIAAAAAAAAAAJdGltZXN0YW1wAAAAAAAABgAAAAAAAAADdWlkAAAAA+4AAAAg",
        "AAAAAQAAAAAAAAAAAAAAEFJlc29sdmVyTWV0YWRhdGEAAAAEAAAAAAAAAAtkZXNjcmlwdGlvbgAAAAAQAAAAAAAAAARuYW1lAAAAEAAAAAAAAAANcmVzb2x2ZXJfdHlwZQAAAAAAB9AAAAAMUmVzb2x2ZXJUeXBlAAAAAAAAAAd2ZXJzaW9uAAAAABA=",
        "AAAAAgAAAAAAAAAAAAAADFJlc29sdmVyVHlwZQAAAAcAAAAAAAAAAAAAAAdEZWZhdWx0AAAAAAAAAAAAAAAACUF1dGhvcml0eQAAAAAAAAAAAAAAAAAAC1Rva2VuUmV3YXJkAAAAAAAAAAAAAAAADUZlZUNvbGxlY3Rpb24AAAAAAAAAAAAAAAAAAAZIeWJyaWQAAAAAAAAAAAAAAAAAB1N0YWtpbmcAAAAAAAAAAAAAAAAGQ3VzdG9tAAA=",
        "AAAABAAAAAAAAAAAAAAADVJlc29sdmVyRXJyb3IAAAAAAAAIAAAAAAAAAA1Ob3RBdXRob3JpemVkAAAAAAAAAQAAAAAAAAASSW52YWxpZEF0dGVzdGF0aW9uAAAAAAACAAAAAAAAAA1JbnZhbGlkU2NoZW1hAAAAAAAAAwAAAAAAAAARSW5zdWZmaWNpZW50RnVuZHMAAAAAAAAEAAAAAAAAABNUb2tlblRyYW5zZmVyRmFpbGVkAAAAAAUAAAAAAAAADVN0YWtlUmVxdWlyZWQAAAAAAAAGAAAAAAAAABBWYWxpZGF0aW9uRmFpbGVkAAAABwAAAAAAAAALQ3VzdG9tRXJyb3IAAAAACA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAADAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAALSW5pdGlhbGl6ZWQAAAAAAAAAAAAAAAALUmV3YXJkVG9rZW4AAAAAAAAAAAAAAAAMUmV3YXJkQW1vdW50AAAAAAAAAAAAAAANVG90YWxSZXdhcmRlZAAAAAAAAAAAAAAAAAAAC1VzZXJSZXdhcmRzAAAAAAAAAAAAAAAACVRva2VuTmFtZQAAAAAAAAAAAAAAAAAAC1Rva2VuU3ltYm9sAAAAAAAAAAAAAAAADVRva2VuRGVjaW1hbHMAAAAAAAAAAAAAAAAAAAtUb3RhbFN1cHBseQAAAAAAAAAAAAAAAAdCYWxhbmNlAAAAAAAAAAAAAAAACUFsbG93YW5jZQAAAA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABwAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAALSW5pdGlhbGl6ZWQAAAAAAAAAAAAAAAAIRmVlVG9rZW4AAAAAAAAAAAAAAA5BdHRlc3RhdGlvbkZlZQAAAAAAAAAAAAAAAAAMRmVlUmVjaXBpZW50AAAAAAAAAAAAAAAOVG90YWxDb2xsZWN0ZWQAAAAAAAAAAAAAAAAADUNvbGxlY3RlZEZlZXMAAAA=",
        "AAAAAgAAAEFTdG9yYWdlIGtleXMgZm9yIHRoZSBkYXRhIGFzc29jaWF0ZWQgd2l0aCB0aGUgYWxsb3dsaXN0IGV4dGVuc2lvbgAAAAAAAAAAAAATQWxsb3dMaXN0U3RvcmFnZUtleQAAAAABAAAAAQAAACdTdG9yZXMgdGhlIGFsbG93ZWQgc3RhdHVzIG9mIGFuIGFjY291bnQAAAAAB0FsbG93ZWQAAAAAAQAAABM=",
        "AAAAAgAAAEFTdG9yYWdlIGtleXMgZm9yIHRoZSBkYXRhIGFzc29jaWF0ZWQgd2l0aCB0aGUgYmxvY2tsaXN0IGV4dGVuc2lvbgAAAAAAAAAAAAATQmxvY2tMaXN0U3RvcmFnZUtleQAAAAABAAAAAQAAACdTdG9yZXMgdGhlIGJsb2NrZWQgc3RhdHVzIG9mIGFuIGFjY291bnQAAAAAB0Jsb2NrZWQAAAAAAQAAABM=",
        "AAAAAQAAACpTdG9yYWdlIGtleSB0aGF0IG1hcHMgdG8gW2BBbGxvd2FuY2VEYXRhYF0AAAAAAAAAAAAMQWxsb3dhbmNlS2V5AAAAAgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdzcGVuZGVyAAAAABM=",
        "AAAAAQAAAINTdG9yYWdlIGNvbnRhaW5lciBmb3IgdGhlIGFtb3VudCBvZiB0b2tlbnMgZm9yIHdoaWNoIGFuIGFsbG93YW5jZSBpcyBncmFudGVkCmFuZCB0aGUgbGVkZ2VyIG51bWJlciBhdCB3aGljaCB0aGlzIGFsbG93YW5jZSBleHBpcmVzLgAAAAAAAAAADUFsbG93YW5jZURhdGEAAAAAAAACAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABA==",
        "AAAAAgAAADlTdG9yYWdlIGtleXMgZm9yIHRoZSBkYXRhIGFzc29jaWF0ZWQgd2l0aCBgRnVuZ2libGVUb2tlbmAAAAAAAAAAAAAAClN0b3JhZ2VLZXkAAAAAAAMAAAAAAAAAAAAAAAtUb3RhbFN1cHBseQAAAAABAAAAAAAAAAdCYWxhbmNlAAAAAAEAAAATAAAAAQAAAAAAAAAJQWxsb3dhbmNlAAAAAAAAAQAAB9AAAAAMQWxsb3dhbmNlS2V5",
        "AAAAAQAAACRTdG9yYWdlIGNvbnRhaW5lciBmb3IgdG9rZW4gbWV0YWRhdGEAAAAAAAAACE1ldGFkYXRhAAAAAwAAAAAAAAAIZGVjaW1hbHMAAAAEAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAGc3ltYm9sAAAAAAAQ",
        "AAAAAgAAAClTdG9yYWdlIGtleSBmb3IgYWNjZXNzaW5nIHRoZSBTQUMgYWRkcmVzcwAAAAAAAAAAAAAWU0FDQWRtaW5HZW5lcmljRGF0YUtleQAAAAAAAQAAAAAAAAAAAAAAA1NhYwA=",
        "AAAAAgAAAClTdG9yYWdlIGtleSBmb3IgYWNjZXNzaW5nIHRoZSBTQUMgYWRkcmVzcwAAAAAAAAAAAAAWU0FDQWRtaW5XcmFwcGVyRGF0YUtleQAAAAAAAQAAAAAAAAAAAAAAA1NhYwA=",
        "AAAABAAAAAAAAAAAAAAAEkZ1bmdpYmxlVG9rZW5FcnJvcgAAAAAADwAAAG5JbmRpY2F0ZXMgYW4gZXJyb3IgcmVsYXRlZCB0byB0aGUgY3VycmVudCBiYWxhbmNlIG9mIGFjY291bnQgZnJvbSB3aGljaAp0b2tlbnMgYXJlIGV4cGVjdGVkIHRvIGJlIHRyYW5zZmVycmVkLgAAAAAAE0luc3VmZmljaWVudEJhbGFuY2UAAAAAZAAAAGRJbmRpY2F0ZXMgYSBmYWlsdXJlIHdpdGggdGhlIGFsbG93YW5jZSBtZWNoYW5pc20gd2hlbiBhIGdpdmVuIHNwZW5kZXIKZG9lc24ndCBoYXZlIGVub3VnaCBhbGxvd2FuY2UuAAAAFUluc3VmZmljaWVudEFsbG93YW5jZQAAAAAAAGUAAABNSW5kaWNhdGVzIGFuIGludmFsaWQgdmFsdWUgZm9yIGBsaXZlX3VudGlsX2xlZGdlcmAgd2hlbiBzZXR0aW5nIGFuCmFsbG93YW5jZS4AAAAAAAAWSW52YWxpZExpdmVVbnRpbExlZGdlcgAAAAAAZgAAADJJbmRpY2F0ZXMgYW4gZXJyb3Igd2hlbiBhbiBpbnB1dCB0aGF0IG11c3QgYmUgPj0gMAAAAAAADExlc3NUaGFuWmVybwAAAGcAAAApSW5kaWNhdGVzIG92ZXJmbG93IHdoZW4gYWRkaW5nIHR3byB2YWx1ZXMAAAAAAAAMTWF0aE92ZXJmbG93AAAAaAAAACpJbmRpY2F0ZXMgYWNjZXNzIHRvIHVuaW5pdGlhbGl6ZWQgbWV0YWRhdGEAAAAAAA1VbnNldE1ldGFkYXRhAAAAAAAAaQAAAFJJbmRpY2F0ZXMgdGhhdCB0aGUgb3BlcmF0aW9uIHdvdWxkIGhhdmUgY2F1c2VkIGB0b3RhbF9zdXBwbHlgIHRvIGV4Y2VlZAp0aGUgYGNhcGAuAAAAAAALRXhjZWVkZWRDYXAAAAAAagAAADZJbmRpY2F0ZXMgdGhlIHN1cHBsaWVkIGBjYXBgIGlzIG5vdCBhIHZhbGlkIGNhcCB2YWx1ZS4AAAAAAApJbnZhbGlkQ2FwAAAAAABrAAAAHkluZGljYXRlcyB0aGUgQ2FwIHdhcyBub3Qgc2V0LgAAAAAACUNhcE5vdFNldAAAAAAAAGwAAAAmSW5kaWNhdGVzIHRoZSBTQUMgYWRkcmVzcyB3YXMgbm90IHNldC4AAAAAAAlTQUNOb3RTZXQAAAAAAABtAAAAMEluZGljYXRlcyBhIFNBQyBhZGRyZXNzIGRpZmZlcmVudCB0aGFuIGV4cGVjdGVkLgAAABJTQUNBZGRyZXNzTWlzbWF0Y2gAAAAAAG4AAABDSW5kaWNhdGVzIGEgbWlzc2luZyBmdW5jdGlvbiBwYXJhbWV0ZXIgaW4gdGhlIFNBQyBjb250cmFjdCBjb250ZXh0LgAAAAARU0FDTWlzc2luZ0ZuUGFyYW0AAAAAAABvAAAAREluZGljYXRlcyBhbiBpbnZhbGlkIGZ1bmN0aW9uIHBhcmFtZXRlciBpbiB0aGUgU0FDIGNvbnRyYWN0IGNvbnRleHQuAAAAEVNBQ0ludmFsaWRGblBhcmFtAAAAAAAAcAAAADFUaGUgdXNlciBpcyBub3QgYWxsb3dlZCB0byBwZXJmb3JtIHRoaXMgb3BlcmF0aW9uAAAAAAAADlVzZXJOb3RBbGxvd2VkAAAAAABxAAAANVRoZSB1c2VyIGlzIGJsb2NrZWQgYW5kIGNhbm5vdCBwZXJmb3JtIHRoaXMgb3BlcmF0aW9uAAAAAAAAC1VzZXJCbG9ja2VkAAAAAHI=",
        "AAAAAgAAAFlTdG9yYWdlIGtleXMgZm9yIHRoZSBkYXRhIGFzc29jaWF0ZWQgd2l0aCB0aGUgY29uc2VjdXRpdmUgZXh0ZW5zaW9uIG9mCmBOb25GdW5naWJsZVRva2VuYAAAAAAAAAAAAAAYTkZUQ29uc2VjdXRpdmVTdG9yYWdlS2V5AAAABAAAAAEAAAAAAAAACEFwcHJvdmFsAAAAAQAAAAQAAAABAAAAAAAAAAVPd25lcgAAAAAAAAEAAAAEAAAAAQAAAAAAAAAPT3duZXJzaGlwQnVja2V0AAAAAAEAAAAEAAAAAQAAAAAAAAALQnVybmVkVG9rZW4AAAAAAQAAAAQ=",
        "AAAAAQAAAAAAAAAAAAAADk93bmVyVG9rZW5zS2V5AAAAAAACAAAAAAAAAAVpbmRleAAAAAAAAAQAAAAAAAAABW93bmVyAAAAAAAAEw==",
        "AAAAAgAAAFhTdG9yYWdlIGtleXMgZm9yIHRoZSBkYXRhIGFzc29jaWF0ZWQgd2l0aCB0aGUgZW51bWVyYWJsZSBleHRlbnNpb24gb2YKYE5vbkZ1bmdpYmxlVG9rZW5gAAAAAAAAABdORlRFbnVtZXJhYmxlU3RvcmFnZUtleQAAAAAFAAAAAAAAAAAAAAALVG90YWxTdXBwbHkAAAAAAQAAAAAAAAALT3duZXJUb2tlbnMAAAAAAQAAB9AAAAAOT3duZXJUb2tlbnNLZXkAAAAAAAEAAAAAAAAAEE93bmVyVG9rZW5zSW5kZXgAAAABAAAABAAAAAEAAAAAAAAADEdsb2JhbFRva2VucwAAAAEAAAAEAAAAAQAAAAAAAAARR2xvYmFsVG9rZW5zSW5kZXgAAAAAAAABAAAABA==",
        "AAAAAQAAAClTdG9yYWdlIGNvbnRhaW5lciBmb3Igcm95YWx0eSBpbmZvcm1hdGlvbgAAAAAAAAAAAAALUm95YWx0eUluZm8AAAAAAgAAAAAAAAAMYmFzaXNfcG9pbnRzAAAABAAAAAAAAAAIcmVjZWl2ZXIAAAAT",
        "AAAAAgAAAB1TdG9yYWdlIGtleXMgZm9yIHJveWFsdHkgZGF0YQAAAAAAAAAAAAAWTkZUUm95YWx0aWVzU3RvcmFnZUtleQAAAAAAAgAAAAAAAAAAAAAADkRlZmF1bHRSb3lhbHR5AAAAAAABAAAAAAAAAAxUb2tlblJveWFsdHkAAAABAAAABA==",
        "AAAAAQAAAHZTdG9yYWdlIGNvbnRhaW5lciBmb3IgdGhlIHRva2VuIGZvciB3aGljaCBhbiBhcHByb3ZhbCBpcyBncmFudGVkCmFuZCB0aGUgbGVkZ2VyIG51bWJlciBhdCB3aGljaCB0aGlzIGFwcHJvdmFsIGV4cGlyZXMuAAAAAAAAAAAADEFwcHJvdmFsRGF0YQAAAAIAAAAAAAAACGFwcHJvdmVkAAAAEwAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAE",
        "AAAAAQAAACRTdG9yYWdlIGNvbnRhaW5lciBmb3IgdG9rZW4gbWV0YWRhdGEAAAAAAAAACE1ldGFkYXRhAAAAAwAAAAAAAAAIYmFzZV91cmkAAAAQAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAGc3ltYm9sAAAAAAAQ",
        "AAAAAgAAADxTdG9yYWdlIGtleXMgZm9yIHRoZSBkYXRhIGFzc29jaWF0ZWQgd2l0aCBgTm9uRnVuZ2libGVUb2tlbmAAAAAAAAAADU5GVFN0b3JhZ2VLZXkAAAAAAAAFAAAAAQAAAAAAAAAFT3duZXIAAAAAAAABAAAABAAAAAEAAAAAAAAAB0JhbGFuY2UAAAAAAQAAABMAAAABAAAAAAAAAAhBcHByb3ZhbAAAAAEAAAAEAAAAAQAAAAAAAAAOQXBwcm92YWxGb3JBbGwAAAAAAAIAAAATAAAAEwAAAAAAAAAAAAAACE1ldGFkYXRh",
        "AAAAAgAAAAAAAAAAAAAAF05GVFNlcXVlbnRpYWxTdG9yYWdlS2V5AAAAAAEAAAAAAAAAAAAAAA5Ub2tlbklkQ291bnRlcgAA",
        "AAAABAAAAAAAAAAAAAAAFU5vbkZ1bmdpYmxlVG9rZW5FcnJvcgAAAAAAAA0AAAAkSW5kaWNhdGVzIGEgbm9uLWV4aXN0ZW50IGB0b2tlbl9pZGAuAAAAEE5vbkV4aXN0ZW50VG9rZW4AAADIAAAAV0luZGljYXRlcyBhbiBlcnJvciByZWxhdGVkIHRvIHRoZSBvd25lcnNoaXAgb3ZlciBhIHBhcnRpY3VsYXIgdG9rZW4uClVzZWQgaW4gdHJhbnNmZXJzLgAAAAAOSW5jb3JyZWN0T3duZXIAAAAAAMkAAABFSW5kaWNhdGVzIGEgZmFpbHVyZSB3aXRoIHRoZSBgb3BlcmF0b3JgcyBhcHByb3ZhbC4gVXNlZCBpbiB0cmFuc2ZlcnMuAAAAAAAAFEluc3VmZmljaWVudEFwcHJvdmFsAAAAygAAAFVJbmRpY2F0ZXMgYSBmYWlsdXJlIHdpdGggdGhlIGBhcHByb3ZlcmAgb2YgYSB0b2tlbiB0byBiZSBhcHByb3ZlZC4gVXNlZAppbiBhcHByb3ZhbHMuAAAAAAAAD0ludmFsaWRBcHByb3ZlcgAAAADLAAAASkluZGljYXRlcyBhbiBpbnZhbGlkIHZhbHVlIGZvciBgbGl2ZV91bnRpbF9sZWRnZXJgIHdoZW4gc2V0dGluZwphcHByb3ZhbHMuAAAAAAAWSW52YWxpZExpdmVVbnRpbExlZGdlcgAAAAAAzAAAAClJbmRpY2F0ZXMgb3ZlcmZsb3cgd2hlbiBhZGRpbmcgdHdvIHZhbHVlcwAAAAAAAAxNYXRoT3ZlcmZsb3cAAADNAAAANkluZGljYXRlcyBhbGwgcG9zc2libGUgYHRva2VuX2lkYHMgYXJlIGFscmVhZHkgaW4gdXNlLgAAAAAAE1Rva2VuSURzQXJlRGVwbGV0ZWQAAAAAzgAAAEVJbmRpY2F0ZXMgYW4gaW52YWxpZCBhbW91bnQgdG8gYmF0Y2ggbWludCBpbiBgY29uc2VjdXRpdmVgIGV4dGVuc2lvbi4AAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAM8AAAAzSW5kaWNhdGVzIHRoZSB0b2tlbiBkb2VzIG5vdCBleGlzdCBpbiBvd25lcidzIGxpc3QuAAAAABhUb2tlbk5vdEZvdW5kSW5Pd25lckxpc3QAAADQAAAAMkluZGljYXRlcyB0aGUgdG9rZW4gZG9lcyBub3QgZXhpc3QgaW4gZ2xvYmFsIGxpc3QuAAAAAAAZVG9rZW5Ob3RGb3VuZEluR2xvYmFsTGlzdAAAAAAAANEAAAAjSW5kaWNhdGVzIGFjY2VzcyB0byB1bnNldCBtZXRhZGF0YS4AAAAADVVuc2V0TWV0YWRhdGEAAAAAAADSAAAAQUluZGljYXRlcyB0aGUgbGVuZ3RoIG9mIHRoZSBiYXNlIFVSSSBleGNlZWRzIHRoZSBtYXhpbXVtIGFsbG93ZWQuAAAAAAAAFUJhc2VVcmlNYXhMZW5FeGNlZWRlZAAAAAAAANMAAABHSW5kaWNhdGVzIHRoZSByb3lhbHR5IGFtb3VudCBpcyBoaWdoZXIgdGhhbiAxMF8wMDAgKDEwMCUpIGJhc2lzIHBvaW50cy4AAAAAFEludmFsaWRSb3lhbHR5QW1vdW50AAAA1A==" ]),
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