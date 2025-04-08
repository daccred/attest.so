use soroban_sdk::{Address, Env, String as SorobanString, BytesN};
use crate::state::{DataKey, AttestationRecord};
use crate::errors::Error;
use crate::utils;
use crate::events;

/// Revokes an existing attestation.
///
/// Requires authorization from the caller, who must be the authority that
/// originally issued the attestation (i.e., the authority associated with the schema).
/// The schema associated with the attestation must also be revocable.
///
/// # Arguments
/// * `env` - The Soroban environment.
/// * `caller` - The address attempting to revoke the attestation (must be the schema authority).
/// * `schema_uid` - The UID of the schema the attestation belongs to.
/// * `subject` - The address that is the subject of the attestation.
/// * `reference` - An optional reference string used to identify the specific attestation
///                 if multiple attestations exist for the same schema and subject.
///
/// # Returns
/// * `Result<(), Error>` - An empty success value or an error.
///
/// # Errors
/// * `Error::AuthorityNotRegistered` - If the `caller` is not a registered authority.
/// * `Error::SchemaNotFound` - If the schema specified by `schema_uid` does not exist.
/// * `Error::NotAuthorized` - If the `caller` is not the authority associated with the schema.
/// * `Error::AttestationNotFound` - If no attestation matching the criteria (schema, subject, reference) exists.
/// * `Error::AttestationNotRevocable` - If the schema associated with the attestation is not marked as revocable.
pub fn revoke_attest(
    env: &Env,
    caller: Address,
    schema_uid: BytesN<32>,
    subject: Address,
    reference: Option<SorobanString>,
) -> Result<(), Error> {
    // Require authorization from the caller
    caller.require_auth();

    // Get schema
    let schema = utils::get_schema(env, &schema_uid)
        .ok_or(Error::SchemaNotFound)?;

    // Verify caller is the schema authority
    if schema.authority != caller {
        return Err(Error::NotAuthorized);
    }

    // Get attestation - Clone the values to avoid moving them
    let attest_key = DataKey::Attestation(schema_uid.clone(), subject.clone(), reference.clone());
    let mut attest = env.storage().instance().get::<DataKey, AttestationRecord>(&attest_key)
        .ok_or(Error::AttestationNotFound)?;

    // Verify attestation is revocable
    if !schema.revocable {
        return Err(Error::AttestationNotRevocable);
    }

    // Revoke attestation
    attest.revoked = true;
    env.storage().instance().set(&attest_key, &attest);
    
    // Publish revocation event - Now we can use the original values because we cloned them above
    events::publish_revocation_event(env, &schema_uid, &subject, &reference);

    Ok(())
} 