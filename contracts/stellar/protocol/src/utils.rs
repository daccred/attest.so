use soroban_sdk::{Address, BytesN, Env, String};
use crate::state::{DataKey, StoredAttestation, Schema, Authority};
use crate::errors::Error;
use crate::interfaces::resolver::ResolverAttestation;

pub fn _get_authority(env: &Env, address: &Address) -> Option<Authority> {
    let key = DataKey::Authority(address.clone());
    env.storage().instance().get(&key)
}

/// Retrieves a schema record by its unique identifier (UID).
///
/// # Arguments
/// * `env` - The Soroban environment.
/// * `schema_uid` - The 32-byte unique identifier of the schema to retrieve.
///
/// # Returns
/// * `Option<Schema>` - The `Schema` record if found, otherwise None.
///
/// # Example
/// ```ignore
/// if let Some(schema) = get_schema(&env, &schema_uid) {
///     // Schema exists, use it
/// } else {
///     // Schema not found
/// }
/// ```
pub fn get_schema(env: &Env, schema_uid: &BytesN<32>) -> Option<Schema> {
    let key = DataKey::Schema(schema_uid.clone());
    env.storage().instance().get(&key)
}

pub fn _get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

pub fn _store_attestation(_env: &Env, _uid: &BytesN<32>, _attestation: &StoredAttestation) -> Result<(), Error> {
    unimplemented!("store_attestation needs update/removal");
}

pub fn _to_attestation_record(
    _env: &Env,
    _uid: &BytesN<32>,
    _att: &StoredAttestation,
) -> ResolverAttestation {
    unimplemented!("to_attestation_record needs update/removal");
}

pub fn _generate_attestation_uid(
    _env: &Env,
    _schema_uid: &BytesN<32>,
    _subject: &Address,
    _reference: &Option<String>,
) -> Result<BytesN<32>, Error> {
    unimplemented!("generate_attestation_uid needs update/removal");
} 