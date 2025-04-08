use soroban_sdk::{Address, Env, String as SorobanString, BytesN};
use crate::state::{DataKey, AttestationRecord};
use crate::errors::Error;
use crate::utils;
use crate::events;

pub fn revoke_attest(
    env: &Env,
    caller: Address,
    schema_uid: BytesN<32>,
    subject: Address,
    reference: Option<SorobanString>,
) -> Result<(), Error> {
    // Require authorization from the caller
    caller.require_auth();

    // Verify caller is a registered authority
    let _authority = utils::get_authority(env, &caller)
        .ok_or(Error::AuthorityNotRegistered)?;

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