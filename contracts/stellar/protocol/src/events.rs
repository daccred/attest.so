use crate::state::{Attestation, Schema};
use soroban_sdk::{symbol_short, Address, BytesN, Env, String};

pub fn schema_registered(env: &Env, schema_uid: &BytesN<32>, schema: &Schema, authority: &Address) {
    let topics = (symbol_short!("SCHEMA"), symbol_short!("REGISTER"));
    let data: (BytesN<32>, Schema, Address) = (schema_uid.clone(), schema.clone(), authority.clone());
    env.events().publish(topics, data);
}

pub fn publish_attestation_event(env: &Env, attestation: &Attestation) {
    let topics = (symbol_short!("ATTEST"), symbol_short!("CREATE"));
    let data: (BytesN<32>, Address, Address, String, u64, u64) = (
        attestation.uid.clone(),
        attestation.subject.clone(),
        attestation.attester.clone(),
        attestation.value.clone(),
        attestation.nonce,
        attestation.timestamp,
    );
    env.events().publish(topics, data);
}

pub fn publish_revocation_event(env: &Env, attestation: &Attestation) {
    let topics = (symbol_short!("ATTEST"), symbol_short!("REVOKE"));
    let data: (BytesN<32>, BytesN<32>, Address, Address, bool, u64) = (
        attestation.uid.clone(),
        attestation.schema_uid.clone(),
        attestation.subject.clone(),
        attestation.attester.clone(),
        attestation.revoked,
        attestation.revocation_time.unwrap_or(0),
    );
    env.events().publish(topics, data);
}

pub fn publish_bls_key_registered(env: &Env, attester: &Address, public_key: &BytesN<192>, timestamp: u64) {
    let topics = (symbol_short!("BLS_KEY"), symbol_short!("REGISTER"));
    let data: (Address, BytesN<192>, u64) = (attester.clone(), public_key.clone(), timestamp);
    env.events().publish(topics, data);
}
