use soroban_sdk::{Env, symbol_short, String as SorobanString, BytesN, Address};
use crate::state::{AttestationRecord, Authority};

pub fn publish_attestation_event(env: &Env, _attestation: &AttestationRecord) {
    let topics = (symbol_short!("ATTEST"), symbol_short!("CREATE"));
    env.events().publish(topics, ());
}

pub fn publish_revocation_event(env: &Env, _schema_uid: &BytesN<32>, _subject: &Address, _reference: &Option<SorobanString>) {
    let topics = (symbol_short!("ATTEST"), symbol_short!("REVOKE"));
    env.events().publish(topics, ());
}

pub fn publish_authority_registration_event(env: &Env, _authority: &Authority) {
    let topics = (symbol_short!("AUTH"), symbol_short!("REGISTER"));
    env.events().publish(topics, ());
} 