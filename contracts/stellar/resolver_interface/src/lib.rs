#![no_std]

use soroban_sdk::{contracttype, Address, BytesN, Env};

/// Standard Resolver Interface that all resolvers must implement
/// This provides a consistent interface for the protocol to interact with resolvers
pub trait ResolverInterface {
    /// Called before an attestation is created
    /// Returns true if the attestation should be allowed
    fn before_attest(
        env: Env,
        attestation: Attestation,
    ) -> Result<bool, ResolverError>;

    /// Called after an attestation is created
    /// Can be used for post-processing like token rewards
    fn after_attest(
        env: Env,
        attestation: Attestation,
    ) -> Result<(), ResolverError>;

    /// Called before a revocation
    /// Returns true if the revocation should be allowed
    fn before_revoke(
        env: Env,
        attestation_uid: BytesN<32>,
        attester: Address,
    ) -> Result<bool, ResolverError>;

    /// Called after a revocation
    /// Can be used for cleanup or notifications
    fn after_revoke(
        env: Env,
        attestation_uid: BytesN<32>,
        attester: Address,
    ) -> Result<(), ResolverError>;

    /// Get resolver metadata
    fn get_metadata(env: Env) -> ResolverMetadata;
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Attestation {
    pub uid: BytesN<32>,
    pub schema_uid: BytesN<32>,
    pub attester: Address,
    pub recipient: Address,
    pub data: soroban_sdk::Bytes,
    pub timestamp: u64,
    pub expiration_time: u64,
    pub revocable: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ResolverMetadata {
    pub name: soroban_sdk::String,
    pub version: soroban_sdk::String,
    pub description: soroban_sdk::String,
    pub resolver_type: ResolverType,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ResolverType {
    Default,
    Authority,
    TokenReward,
    FeeCollection,
    Hybrid,
    Staking,
    Custom,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ResolverError {
    NotAuthorized,
    InvalidAttestation,
    InvalidSchema,
    InsufficientFunds,
    TokenTransferFailed,
    StakeRequired,
    ValidationFailed,
    CustomError(u32),
}