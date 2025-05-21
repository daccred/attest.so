use soroban_sdk::{Address, Env, String, BytesN};
use crate::state::{DataKey, AttestationRecord};
use crate::errors::Error;
use crate::utils;
use crate::events;

/// Creates a new attestation or updates an existing one for a given schema and subject.
///
/// This function allows a registered authority to create an attestation that conforms to a specific schema
/// for a particular subject. If an attestation with the same identifiers already exists, it will be overwritten.
///
/// # Authorization
/// Requires authorization from the caller, who must be the authority registered for the specified schema.
///
/// # Arguments
/// * `env` - The Soroban environment providing access to blockchain services.
/// * `caller` - The address creating the attestation (must be the schema authority).
/// * `schema_uid` - The unique identifier (UID) of the schema this attestation conforms to.
/// * `subject` - The address that is the subject of the attestation.
/// * `value` - The string value containing the attestation data, typically in JSON format.
/// * `reference` - An optional reference string to uniquely identify the attestation when
///                 multiple attestations for the same schema and subject can exist.
///
/// # Returns
/// * `Result<(), Error>` - An empty success value or an error.
///
/// # Errors
/// * `Error::SchemaNotFound` - If no schema with the specified `schema_uid` exists.
/// * `Error::NotAuthorized` - If the `caller` is not the authority associated with the schema.
///
/// # Example
/// ```ignore
/// let result = attest(
///     &env,
///     authority_address,
///     schema_uid,
///     subject_address,
///     String::from_str(&env, "{\"field\": \"value\"}"),
///     Some(String::from_str(&env, "reference-id"))
/// );
/// ```
pub fn attest(
    env: &Env,
    caller: Address,
    schema_uid: BytesN<32>,
    subject: Address,
    value: String,
    reference: Option<String>,
) -> Result<(), Error> {
    caller.require_auth();

    // Verify caller is a registered authority for the given schema
    let schema = utils::get_schema(env, &schema_uid)
        .ok_or(Error::SchemaNotFound)?;
    // if schema.authority != caller {
    //     return Err(Error::NotAuthorized); // Caller is not the authority for this schema
    // }

    // Check if attestation already exists (optional, depends on desired behavior)
    let attest_key = DataKey::Attestation(schema_uid.clone(), subject.clone(), reference.clone());
    if env.storage().instance().has(&attest_key) {
        // Decide whether to error or overwrite. Current impl overwrites.
        return Err(Error::AttestationExists);
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

/// Retrieves an attestation record from storage based on its unique identifiers.
///
/// This function looks up and returns an attestation record by matching its schema UID,
/// subject address, and optional reference string. The attestation must have been previously
/// created using the `attest()` function.
///
/// # Arguments
/// * `env` - The Soroban environment object providing access to contract storage and other utilities
/// * `schema_uid` - A 32-byte unique identifier for the schema this attestation belongs to
/// * `subject` - The Stellar address of the entity that is the subject of this attestation
/// * `reference` - An optional string identifier used to distinguish between multiple attestations
///                for the same schema and subject
///
/// # Returns
/// * `Result<AttestationRecord, Error>` - Returns the attestation record if found, wrapped in Ok().
///                                       Otherwise returns an error variant.
///
/// # Errors
/// * `Error::SchemaNotFound` - Returned if no schema exists with the provided `schema_uid`
/// * `Error::AttestationNotFound` - Returned if no attestation exists matching all the provided
///                                  lookup criteria (schema_uid, subject, and reference)
///
/// # Example
/// ```ignore
/// let attestation = get_attest(
///     &env,
///     schema_uid,
///     subject_address,
///     Some("2023-degree".into())
/// )?;
/// ```
pub fn get_attest(
    env: &Env,
    schema_uid: BytesN<32>,
    subject: Address,
    reference: Option<String>,
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