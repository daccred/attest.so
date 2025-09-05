use crate::interface::{ResolverAttestationData, ResolverError, ResolverInterface, ResolverMetadata, ResolverType};
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String};

/// DefaultResolver - Basic attestation validation without any economic model
/// Simply validates that attestations meet basic requirements
#[contract]
pub struct DefaultResolver;

#[contractimpl]
impl ResolverInterface for DefaultResolver {
    /// Basic validation - always allows valid attestations
    fn onattest(env: Env, attestation: ResolverAttestationData) -> Result<bool, ResolverError> {
        // Basic validation: ensure attester is not self-attesting
        if attestation.attester == attestation.recipient {
            return Err(ResolverError::ValidationFailed);
        }

        // Ensure attestation has not expired if expiration_time is set
        if attestation.expiration_time > 0 && attestation.expiration_time < env.ledger().timestamp() {
            return Err(ResolverError::InvalidAttestation);
        }

        Ok(true)
    }

    /// No post-processing needed for default resolver
    fn onresolve(_env: Env, _attestation_uid: BytesN<32>, _attester: Address) -> Result<(), ResolverError> {
        Ok(())
    }

    /// Allow revocations if attestation is revocable
    fn onrevoke(_env: Env, _attestation: ResolverAttestationData) -> Result<bool, ResolverError> {
        // Protocol handles revocability check
        Ok(true)
    }

    fn metadata(env: Env) -> ResolverMetadata {
        ResolverMetadata {
            name: String::from_str(&env, "Default Resolver"),
            version: String::from_str(&env, "1.0.0"),
            description: String::from_str(&env, "Basic attestation validation without economic model"),
            resolver_type: ResolverType::Default,
        }
    }
}
