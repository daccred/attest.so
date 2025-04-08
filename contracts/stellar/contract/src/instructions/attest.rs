use soroban_sdk::{Address, Env, String as SorobanString, BytesN};
use crate::state::{DataKey, AttestationRecord};
use crate::errors::Error;
use crate::utils;

pub fn attest(
    env: &Env,
    caller: Address,
    schema_uid: BytesN<32>,
    subject: Address,
    value: SorobanString,
    reference: Option<SorobanString>,
) -> Result<(), Error> {
    caller.require_auth();

    // Verify caller is a registered authority for the given schema
    let schema = utils::get_schema(env, &schema_uid)
        .ok_or(Error::SchemaNotFound)?;
    if schema.authority != caller {
        return Err(Error::NotAuthorized); // Caller is not the authority for this schema
    }

    // Check if attestation already exists (optional, depends on desired behavior)
    let attest_key = DataKey::Attestation(schema_uid.clone(), subject.clone(), reference.clone());
    if env.storage().instance().has(&attest_key) {
        // Decide whether to error or overwrite. Current impl overwrites.
        // return Err(Error::AttestationExists);
    }

    let attestation = AttestationRecord {
        schema_uid: schema_uid.clone(), // Use cloned schema_uid
        subject: subject.clone(),       // Use cloned subject
        value,
        reference: reference.clone(),   // Use cloned reference
        revoked: false,
    };

    env.storage().instance().set(&attest_key, &attestation);

    // Event publishing was removed/commented out, so events import is unused
    // events::publish_attestation_event(env, &attestation); 

    Ok(())
} 