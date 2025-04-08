use soroban_sdk::{Address, Env, String as SorobanString, BytesN};
use crate::state::{DataKey, AttestationRecord};
use crate::errors::Error;
use crate::utils;

pub fn get_attest(
    env: &Env,
    schema_uid: BytesN<32>,
    subject: Address,
    reference: Option<SorobanString>,
) -> Result<AttestationRecord, Error> {
    // Get schema
    let _schema = utils::get_schema(env, &schema_uid)
        .ok_or(Error::SchemaNotFound)?;

    // Get attestation
    let attest_key = DataKey::Attestation(schema_uid, subject, reference);
    let attest = env.storage().instance().get::<DataKey, AttestationRecord>(&attest_key)
        .ok_or(Error::AttestationNotFound)?;

    Ok(attest)
} 