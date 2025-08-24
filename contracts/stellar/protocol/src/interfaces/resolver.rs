use soroban_sdk::{contractclient, contracttype, Address, Bytes, BytesN, Env};

/************************************************
* Flattened Attestation Struct for Resolver Calls
************************************************/
#[derive(Debug, Clone)]
#[contracttype]
pub struct ResolverAttestation {
    pub uid: BytesN<32>,
    pub schema_uid: BytesN<32>,
    pub recipient: Address,
    pub attester: Address,
    pub time: u64,
    pub expiration_time: u64, // Flattened: 0 = not set
    pub revocation_time: u64, // Flattened: 0 = not set
    pub revocable: bool,
    pub ref_uid: Bytes, // Flattened: empty bytes = not set
    pub data: Bytes,
    pub value: i128, // Flattened: 0 = not set
}

/************************************************
* Resolver Contract Client Interface
************************************************/
#[contractclient(name = "ResolverClient")]
pub trait Resolver {
    /// Called before an attestation is created - CRITICAL for access control
    /// Returns true if attestation should be allowed, false to reject
    fn bef_att(env: &Env, attestation: &ResolverAttestation) -> bool;

    /// Called after an attestation is created - for side effects (rewards, etc.)
    /// Failures are logged but don't revert the attestation
    fn aft_att(env: &Env, attestation: &ResolverAttestation);

    /// Called before an attestation is revoked - CRITICAL for access control
    /// Returns true if revocation should be allowed, false to reject
    fn bef_rev(env: &Env, attestation: &ResolverAttestation) -> bool;

    /// Called after an attestation is revoked - for side effects (cleanup, etc.)
    /// Failures are logged but don't revert the revocation
    fn aft_rev(env: &Env, attestation: &ResolverAttestation);
}

