// Remove crate-level attribute from non-root module

use soroban_sdk::{contracttype, Address, Env, Bytes, BytesN}; // Removed Vec

// Define a common Error type or use a generic one if possible.
// For simplicity, using a placeholder. Replace with your actual Error enum.
// #[contracterror]
// #[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
// #[repr(u32)]
// pub enum ResolverError {
//     SomeError = 1,
// }
// Define a concrete error type if needed, or make the trait generic over the error.
// For now, let's assume the implementation will define its specific error type
// compatible with the main contract's Error.
pub type ResolverError = soroban_sdk::Error; // Use soroban_sdk::Error as placeholder

/************************************************
* Attestation Struct (as specified for Resolver)
************************************************/
#[derive(Debug, Clone)]
#[contracttype]
pub struct AttestationRecord {
    pub uid: BytesN<32>, // Assuming the UID is generated *before* calling resolver
    pub schema_uid: BytesN<32>,
    pub recipient: Address,
    pub attester: Address, // The authority/caller making the attestation
    pub time: u64, // Added time from original lib.rs struct
    pub expiration_time: Option<u64>, // Changed from u64
    pub revocation_time: Option<u64>, // Added from original lib.rs struct
    pub revocable: bool,
    pub ref_uid: Option<BytesN<32>>, // Changed from BytesN<32>, assuming optional
    pub data: Bytes,         // Changed from String
    // pub value: u256, // u256 is not a standard soroban type, use i128 or similar if needed
    pub value: Option<i128>, // Using Option<i128> as a placeholder for value
}

/************************************************
* Resolver Interface Trait
************************************************/
// Note: Traits cannot be directly implemented by contracts in the typical Rust sense
// for cross-contract calls. We define the expected interface shape.
// Contracts wanting to act as resolvers should expose functions matching this signature.

pub trait Resolver {
    // This function isn't directly callable via interface but signifies capability
    fn is_payable(env: Env) -> bool;

    // Pre-attestation hook (before storing)
    fn attest(env: Env, attestation: AttestationRecord) -> Result<(), ResolverError>;

    // Pre-revocation hook (before updating storage)
    fn revoke(env: Env, attestation: AttestationRecord) -> Result<(), ResolverError>;

    // We might need a way to identify the calling contract or attestation UID here.
    // fn multi_attest(env: Env, attestations: Vec<AttestationRecord>) -> Result<(), ResolverError>;

    // Post-attestation hook (after storing) - Less common pattern in Soroban?
    // fn on_attest(env: Env, attestation: AttestationRecord) -> Result<(), ResolverError>;

    // Post-revocation hook (after updating storage) - Less common pattern in Soroban?
    // fn on_revoke(env: Env, attestation: AttestationRecord) -> Result<(), ResolverError>;
} 