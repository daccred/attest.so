use soroban_sdk::{Env, symbol_short, String, BytesN, Address};
use crate::state::AttestationRecord;

pub fn schema_registered(
    env: &Env,
    schema_uid: &BytesN<32>,
    authority: &Address,
) {
    let topics = (symbol_short!("SCHEMA"), symbol_short!("REGISTER"));
    let data = (
        schema_uid.clone(),
        authority.clone(),
    );
    env.events().publish(topics, data);
}

pub fn publish_attestation_event(env: &Env, attestation: &AttestationRecord) {
    let topics = (symbol_short!("ATTEST"), symbol_short!("CREATE"));
    let data = (
        attestation.schema_uid.clone(),
        attestation.subject.clone(),
        attestation.value.clone(),
        attestation.reference.clone(),
        attestation.revoked,
    );
    env.events().publish(topics, data);
}

pub fn publish_revocation_event(
    env: &Env,
    schema_uid: &BytesN<32>,
    subject: &Address,
    reference: &Option<String>,
) {
    let topics = (symbol_short!("ATTEST"), symbol_short!("REVOKE"));
    let data = (
        schema_uid.clone(),
        subject.clone(),
        reference.clone(),
    );
    env.events().publish(topics, data);
}
