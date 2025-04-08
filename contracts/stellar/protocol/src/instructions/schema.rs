use soroban_sdk::{Address, Env, String as SorobanString, BytesN, Bytes, xdr::ToXdr};
use crate::state::{DataKey, Schema};
use crate::errors::Error;
use crate::utils;

/// Generates a unique identifier (SHA256 hash) for a schema.
///
/// The UID is derived from the schema definition, the registering authority,
/// and the optional resolver address.
///
/// # Arguments
/// * `env` - The Soroban environment providing access to cryptographic functions.
/// * `schema_definition` - The string representation of the schema definition.
/// * `authority` - The address of the authority registering the schema.
/// * `resolver` - An optional address of a resolver contract associated with the schema.
///
/// # Returns
/// * `BytesN<32>` - The unique 32-byte identifier (UID) for the schema.
///
/// # Example
/// ```ignore
/// let schema_uid = generate_uid(
///     &env,
///     &schema_definition,
///     &authority_address,
///     &Some(resolver_address)
/// );
/// ```
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

/// Retrieves a schema record by its unique identifier (UID).
///
/// # Arguments
/// * `env` - The Soroban environment.
/// * `schema_uid` - The 32-byte unique identifier of the schema to retrieve.
///
/// # Returns
/// * `Result<Schema, Error>` - The `Schema` record if found, otherwise an error.
///
/// # Errors
/// * `Error::SchemaNotFound` - If no schema with the given UID exists in storage.
pub fn get_schema(
    env: &Env,
    schema_uid: &BytesN<32>,
) -> Result<Schema, Error> {
    let schema_key = DataKey::Schema(schema_uid.clone());
    env.storage().instance().get::<DataKey, Schema>(&schema_key)
        .ok_or(Error::SchemaNotFound)
}
/// Registers a new schema definition in the contract.
///
/// This function allows an entity to register a new schema for attestations. The schema defines
/// the structure and format of data that can be attested to. Each schema is uniquely identified
/// by a UID generated from the schema definition, the registering authority, and the optional
/// resolver address.
///
/// # Authorization
/// Requires authorization from the caller, who becomes the authority for this schema.
///
/// # Arguments
/// * `env` - The Soroban environment providing access to blockchain services.
/// * `caller` - The address registering the schema and becoming its authority.
/// * `schema_definition` - The string representation of the schema definition, typically in JSON format
///                        defining the fields and their types.
/// * `resolver` - An optional address of a resolver contract that can provide additional
///               validation or resolution services for attestations using this schema.
/// * `revocable` - A boolean flag indicating whether attestations made against this schema
///                can be revoked later by the authority.
///
/// # Returns
/// * `Result<BytesN<32>, Error>` - The unique 32-byte identifier (UID) of the newly registered schema,
///                               or an error if the registration fails.
///
/// # Example
/// ```ignore
/// let schema_definition = SorobanString::from_str(&env, 
///     r#"{
///         "name": "Degree",
///         "version": "1.0",
///         "description": "University degree attestation",
///         "fields": [
///             {"name": "degree", "type": "string"},
///             {"name": "field", "type": "string"},
///             {"name": "graduation_date", "type": "string"}
///         ]
///     }"#);
/// 
/// let schema_uid = register_schema(
///     &env,
///     university_address,
///     schema_definition,
///     None,
///     true
/// )?;
/// ```
pub fn register_schema(
    env: &Env,
    caller: Address,
    schema_definition: SorobanString,
    resolver: Option<Address>,
    revocable: bool,
) -> Result<BytesN<32>, Error> {
    // Require authorization from the caller
    caller.require_auth();

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