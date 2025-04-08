use soroban_sdk::{contractimpl, Env, BytesN};
use crate::state::{DataKey, StoredAttestation};
use crate::errors::Error;

pub fn get_attest(
    env: &Env,
    uid: BytesN<32>
) -> Result<StoredAttestation, Error> {
    let attestation_key = DataKey::Attestation(uid);
    env.storage().instance().get(&attestation_key)
        .ok_or(Error::AttestationNotFound)
} 