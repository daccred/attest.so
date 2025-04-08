use soroban_sdk::{
    Address, Env, String as SorobanString, BytesN, Bytes,
    xdr::ToXdr,
};
use crate::state::{DataKey, Schema as StateSchema};
use crate::errors::Error;

pub fn register_schema(
    env: &Env,
    caller: Address,
    schema_definition: SorobanString,
    resolver: Option<Address>,
    revocable: bool,
) -> Result<BytesN<32>, Error> {
    // Verify caller is a registered authority
    let _authority = crate::utils::get_authority(env, &caller)
        .ok_or(Error::AuthorityNotRegistered)?;

    // Generate schema UID
    let mut schema_data_to_hash = Bytes::new(env);
    schema_data_to_hash.append(&schema_definition.clone().to_xdr(env));
    schema_data_to_hash.append(&caller.clone().to_xdr(env));
    if let Some(resolver_addr) = &resolver {
        schema_data_to_hash.append(&resolver_addr.clone().to_xdr(env));
    }
    let schema_uid: BytesN<32> = env.crypto().sha256(&schema_data_to_hash).into();

    // Store schema
    let schema = StateSchema {
        authority: caller,
        definition: schema_definition,
        resolver,
        revocable,
    };
    let schema_key = DataKey::Schema(schema_uid.clone());
    env.storage().instance().set(&schema_key, &schema);

    Ok(schema_uid)
} 