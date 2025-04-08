use soroban_sdk::{Env, symbol_short, String as SorobanString, BytesN, Address};
use crate::state::{AttestationRecord, Authority};

pub fn publish_attestation_event(env: &Env, attestation: &AttestationRecord) {
    env.events().publish(
        (symbol_short!("attest"), symbol_short!("create")),
        attestation.clone(),
    );
}

pub fn publish_revocation_event(env: &Env, schema_uid: &BytesN<32>, subject: &Address, reference: &Option<SorobanString>) {
    // Consider publishing more identifying info for revocation
    env.events().publish(
        (symbol_short!("attest"), symbol_short!("revoke")),
        (schema_uid.clone(), subject.clone(), reference.clone()),
    );
}

pub fn publish_authority_registration_event(env: &Env, authority: &Authority) {
    env.events().publish(
        (symbol_short!("auth"), symbol_short!("register")),
        authority.clone(),
    );
} 