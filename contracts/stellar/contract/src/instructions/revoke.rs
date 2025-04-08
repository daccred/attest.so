use soroban_sdk::{contractimpl, Address, Env, BytesN, symbol_short};
use crate::state::{DataKey, StoredAttestation, Schema};
use crate::errors::Error;
use crate::utils;
use crate::events;

pub fn revoke_attest(
    env: &Env,
    caller: Address,
    uid: BytesN<32>,
) -> Result<(), Error> {
    caller.require_auth();

    let attestation_key = DataKey::Attestation(uid.clone());
    let mut attestation: StoredAttestation = env.storage().instance().get(&attestation_key)
        .ok_or(Error::AttestationNotFound)?;

    let schema_key = DataKey::Schema(attestation.schema_uid.clone());
    let schema: Schema = env.storage().instance().get(&schema_key)
         .ok_or(Error::SchemaNotFound)?;
    if schema.authority != caller {
         return Err(Error::NotAuthorized);
    }

    if !attestation.revocable {
        return Err(Error::NotAuthorized);
    }

    let original_attestation = attestation.clone();
    attestation.revocation_time = Some(env.ledger().timestamp());

    if let Some(resolver_address) = &schema.resolver {
        let attestation_record = utils::to_attestation_record(env, &uid, &original_attestation);
        env.invoke_contract::<()>(
            resolver_address,
            &symbol_short!("revoke"),
            soroban_sdk::vec![env, attestation_record.into_val(env)],
        );
    }

    utils::store_attestation(env, &uid, &attestation)?;

    events::publish_revocation_event(env, &uid);

    Ok(())
} 