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
TODO: Let this be a impl for the Trait
Import the Trait from the resolver contract and implement the functions
However the function that would be implemented are already defined in
attestation.rs, so we need to bring them over here. 
Once we bring them over here, we can have attestation.rs call the functions
from this interface implementation. 
************************************************/
#[contractclient(name = "ResolverClient")]
pub trait Resolver {
    /// Called before an attestation is created - CRITICAL for access control
    /// Returns true if attestation should be allowed, false to reject
    fn onattest(env: &Env, attestation: &ResolverAttestation) -> bool;

    /// Called before an attestation is revoked - CRITICAL for access control
    /// Returns true if revocation should be allowed, false to reject
    fn onrevoke(env: &Env, attestation: &ResolverAttestation) -> bool;

    /// Called after an attestation is attested or revoked - for side effects (rewards, cleanup, etc.)
    /// Failures are logged but don't revert the attestation or revocation
    fn onresolve(env: &Env, attestation: &ResolverAttestation);
}

