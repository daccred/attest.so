use soroban_sdk::{Env, Address, Bytes, BytesN};
use crate::state::{DataKey, StoredAttestation, Schema};
use crate::interfaces::resolver::AttestationRecord;

pub fn get_authority(env: &Env, authority: &Address) -> Option<Address> {
    let key = DataKey::Authority(authority.clone());
    env.storage().instance().get::<DataKey, Address>(&key)
}

pub fn get_schema(env: &Env, schema_uid: &BytesN<32>) -> Option<Schema> {
    let key = DataKey::Schema(schema_uid.clone());
    env.storage().instance().get::<DataKey, Schema>(&key)
}

pub fn get_admin(env: &Env) -> Option<Address> {
    let key = DataKey::Admin;
    env.storage().instance().get::<DataKey, Address>(&key)
}

pub fn store_attestation(_env: &Env, _uid: &BytesN<32>, _attestation: &StoredAttestation) -> Result<(), crate::errors::Error> {
    unimplemented!("store_attestation needs update for new DataKey::Attestation structure");
}

pub fn to_attestation_record(
    _env: &Env,
    _uid: &BytesN<32>,
    _att: &StoredAttestation,
) -> AttestationRecord {
    unimplemented!("to_attestation_record needs update/removal");
}

pub fn generate_attestation_uid(
    _env: &Env,
    _data: &Bytes,
    _schema_uid: &BytesN<32>,
    _recipient: &Address,
    _attester: &Address,
    _ref_uid: &Option<BytesN<32>>,
) -> BytesN<32> {
    unimplemented!("generate_attestation_uid may be obsolete");
} 