#![no_std]

use soroban_sdk::{
    contract, contractimpl, Address, Env, String, BytesN,
};

mod errors;
mod events;
mod interfaces;
mod state;
mod instructions;
mod utils;

use state::{AttestationRecord, DataKey};

use instructions::{
    register_schema,
    attest,
    revoke_attest,
    get_attest,
};

#[contract]
pub struct AttestationContract;

#[contractimpl]
impl AttestationContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), errors::Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(errors::Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    pub fn register(
        env: Env,
        caller: Address,
        schema_definition: String,
        resolver: Option<Address>,
        revocable: bool,
    ) -> Result<BytesN<32>, errors::Error> {
        register_schema(&env, caller, schema_definition, resolver, revocable)
    }

    pub fn attest(
        env: Env,
        caller: Address,
        schema_uid: BytesN<32>,
        subject: Address,
        value: String,
        reference: Option<String>,
    ) -> Result<(), errors::Error> {
        attest(&env, caller, schema_uid, subject, value, reference)
    }

    pub fn revoke_attestation(
        env: Env,
        caller: Address,
        schema_uid: BytesN<32>,
        subject: Address,
        reference: Option<String>,
    ) -> Result<(), errors::Error> {
        revoke_attest(&env, caller, schema_uid, subject, reference)
    }

    pub fn get_attestation(
        env: Env,
        schema_uid: BytesN<32>,
        subject: Address,
        reference: Option<String>,
    ) -> Result<AttestationRecord, errors::Error> {
        get_attest(&env, schema_uid, subject, reference)
    }
}

#[cfg(test)]
mod tests; 