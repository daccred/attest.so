use soroban_sdk::{Address, Env, String as SorobanString, BytesN};
use crate::state::{DataKey, AttestationRecord};
use crate::errors::Error;
use crate::utils;
use crate::events;

/// Creates a new attestation or updates an existing one for a given schema and subject.
///
/// Requires authorization from the caller, who must be the authority registered
/// for the specified schema.
///
/// # Arguments
/// * `env` - The Soroban environment.
/// * `caller` - The address creating the attestation (must be the schema authority).
/// * `schema_uid` - The UID of the schema this attestation conforms to.
/// * `subject` - The address that is the subject of the attestation.
/// * `value` - The string value or data of the attestation.
/// * `reference` - An optional reference string to uniquely identify the attestation if
///                 multiple attestations for the same schema and subject can exist.
///
/// # Returns
/// * `Result<(), Error>` - An empty success value or an error.
///
/// # Errors
/// * `Error::SchemaNotFound` - If the schema specified by `schema_uid` does not exist.
/// * `Error::NotAuthorized` - If the `caller` is not the authority associated with the schema.
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
        value: value.clone(),
        reference: reference.clone(),   // Use cloned reference
        revoked: false,
    };

    env.storage().instance().set(&attest_key, &attestation);

    // Publish attestation event
    events::publish_attestation_event(env, &attestation);

    Ok(())
}

/// Retrieves an attestation record based on its schema, subject, and optional reference.
///
/// # Arguments
/// * `env` - The Soroban environment.
/// * `schema_uid` - The UID of the schema the attestation belongs to.
/// * `subject` - The address that is the subject of the attestation.
/// * `reference` - An optional reference string used to identify the specific attestation.
///
/// # Returns
/// * `Result<AttestationRecord, Error>` - The `AttestationRecord` if found, otherwise an error.
///
/// # Errors
/// * `Error::SchemaNotFound` - If the schema specified by `schema_uid` does not exist.
/// * `Error::AttestationNotFound` - If no attestation matching the criteria exists.
pub fn get_attest(
    env: &Env,
    schema_uid: BytesN<32>,
    subject: Address,
    reference: Option<SorobanString>,
) -> Result<AttestationRecord, Error> {
    // Get schema
    let _schema = utils::get_schema(env, &schema_uid)
        .ok_or(Error::SchemaNotFound)?;

    // Get attestation
    let attest_key = DataKey::Attestation(schema_uid, subject, reference);
    let attest = env.storage().instance().get::<DataKey, AttestationRecord>(&attest_key)
        .ok_or(Error::AttestationNotFound)?;

    Ok(attest)
} 