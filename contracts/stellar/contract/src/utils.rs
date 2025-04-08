use soroban_sdk::{Address, BytesN, Env, String as SorobanString};
use crate::state::{DataKey, StoredAttestation, Schema, Authority};
use crate::errors::Error;
use crate::interfaces::resolver::ResolverAttestationRecord;

pub fn get_authority(env: &Env, address: &Address) -> Option<Authority> {
    let key = DataKey::Authority(address.clone());
    env.storage().instance().get(&key)
}

pub fn get_schema(env: &Env, schema_uid: &BytesN<32>) -> Option<Schema> {
    let key = DataKey::Schema(schema_uid.clone());
    env.storage().instance().get(&key)
}

pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

pub fn store_attestation(_env: &Env, _uid: &BytesN<32>, _attestation: &StoredAttestation) -> Result<(), Error> {
    unimplemented!("store_attestation needs update/removal");
}

pub fn to_attestation_record(
    _env: &Env,
    _uid: &BytesN<32>,
    _att: &StoredAttestation,
) -> ResolverAttestationRecord {
    unimplemented!("to_attestation_record needs update/removal");
}

pub fn generate_attestation_uid(
    _env: &Env,
    _schema_uid: &BytesN<32>,
    _subject: &Address,
    _reference: &Option<SorobanString>,
) -> Result<BytesN<32>, Error> {
    unimplemented!("generate_attestation_uid needs update/removal");
} 