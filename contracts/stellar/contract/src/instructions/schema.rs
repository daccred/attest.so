use soroban_sdk::{Address, Env, String as SorobanString, BytesN, Bytes, xdr::ToXdr};
use crate::state::{DataKey, Schema};
use crate::errors::Error;
use crate::utils;

/// Generates a unique identifier for a schema based on its definition and authority
pub fn generate_uid(
    env: &Env,
    schema_definition: &SorobanString,
    authority: &Address,
    resolver: &Option<Address>,
) -> BytesN<32> {
    let mut schema_data_to_hash = Bytes::new(env);
    schema_data_to_hash.append(&schema_definition.clone().to_xdr(env));
    schema_data_to_hash.append(&authority.clone().to_xdr(env));
    if let Some(resolver_addr) = resolver {
        schema_data_to_hash.append(&resolver_addr.clone().to_xdr(env));
    }
    env.crypto().sha256(&schema_data_to_hash).into()
}

/// Retrieves a schema by its UID
pub fn get_schema(
    env: &Env,
    schema_uid: &BytesN<32>,
) -> Result<Schema, Error> {
    let schema_key = DataKey::Schema(schema_uid.clone());
    env.storage().instance().get::<DataKey, Schema>(&schema_key)
        .ok_or(Error::SchemaNotFound)
}

pub fn register_schema(
    env: &Env,
    caller: Address,
    schema_definition: SorobanString,
    resolver: Option<Address>,
    revocable: bool,
) -> Result<BytesN<32>, Error> {
    // Require authorization from the caller
    caller.require_auth();

    // Verify caller is a registered authority
    let _authority = utils::get_authority(env, &caller)
        .ok_or(Error::AuthorityNotRegistered)?;

    // Generate schema UID
    let schema_uid = generate_uid(env, &schema_definition, &caller, &resolver);

    // Store schema
    let schema = Schema {
        authority: caller,
        definition: schema_definition,
        resolver,
        revocable,
    };
    let schema_key = DataKey::Schema(schema_uid.clone());
    env.storage().instance().set(&schema_key, &schema);

    Ok(schema_uid)
} 