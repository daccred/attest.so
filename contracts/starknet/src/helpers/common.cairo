use starknet::ContractAddress;

// A representation of an empty/uninitialized UID.
pub const EMPTY_UID: u256 = 0;

// A zero expiration represents an non-expiring attestation.
pub const NO_EXPIRATION_TIME: u64 = 0;

pub mod Errors {
    pub const AccessDenied: felt252 = 'AccessDenied';
    pub const DeadlineExpired: felt252 = 'DeadlineExpired';
    pub const InvalidEAS: felt252 = 'InvalidEAS';
    pub const InvalidLength: felt252 = 'InvalidLength';
    pub const InvalidSignature: felt252 = 'InvalidSignature';
    pub const NotFound: felt252 = 'NotFound';
    pub const AlreadyExists: felt252 = 'AlreadyExists';
    pub const AlreadyRevoked: felt252 = 'AlreadyRevoked';
    pub const AlreadyRevokedOffchain: felt252 = 'AlreadyRevokedOffchain';
    pub const AlreadyTimestamped: felt252 = 'AlreadyTimestamped';
    pub const InsufficientValue: felt252 = 'InsufficientValue';
    pub const InvalidAttestation: felt252 = 'InvalidAttestation';
    pub const InvalidAttestations: felt252 = 'InvalidAttestations';
    pub const InvalidExpirationTime: felt252 = 'InvalidExpirationTime';
    pub const InvalidOffset: felt252 = 'InvalidOffset';
    pub const InvalidRegistry: felt252 = 'InvalidRegistry';
    pub const InvalidRevocation: felt252 = 'InvalidRevocation';
    pub const InvalidRevocations: felt252 = 'InvalidRevocations';
    pub const InvalidSchema: felt252 = 'InvalidSchema';
    pub const InvalidVerifier: felt252 = 'InvalidVerifier';
    pub const Irrevocable: felt252 = 'Irrevocable';
    pub const NotPayable: felt252 = 'NotPayable';
    pub const WrongSchema: felt252 = 'WrongSchema';

}

/// @notice A struct representing ECDSA signature data.
#[derive(Copy, Drop, Serde)]
pub struct Signature {
//     uint8 v; // The recovery ID.
//     bytes32 r; // The x-coordinate of the nonce R.
//     bytes32 s; // The signature data.
}

// /// @notice A struct representing a single attestation.
// struct Attestation {
//     bytes32 uid; // A unique identifier of the attestation.
//     bytes32 schema; // The unique identifier of the schema.
//     uint64 time; // The time when the attestation was created (Unix timestamp).
//     uint64 expirationTime; // The time when the attestation expires (Unix timestamp).
//     uint64 revocationTime; // The time when the attestation was revoked (Unix timestamp).
//     bytes32 refUID; // The UID of the related attestation.
//     address recipient; // The recipient of the attestation.
//     address attester; // The attester/sender of the attestation.
//     bool revocable; // Whether the attestation is revocable.
//     bytes data; // Custom attestation data.
// }
#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Attestation {
    uid: u256,
    schema: u256, // string
    time: u64, // IResolver
    expirationTime: u64,
    refUID: u256,
    recipient: ContractAddress,
    attester: ContractAddress,
    revocable: bool,
    data: felt252
}

// /// @notice A helper function to work with unchecked iterators in loops.
// function uncheckedInc(uint256 i) pure returns (uint256 j) {
//     unchecked {
//         j = i + 1;
//     }
// }