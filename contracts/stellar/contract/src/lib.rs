#![no_std]

use soroban_sdk::{
    contract, contractimpl, Address, Env, String as SorobanString, BytesN,
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
    register_authority,
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

    pub fn reg_auth(
        env: Env,
        caller: Address,
        auth_to_reg: Address,
        metadata: SorobanString,
    ) -> Result<(), errors::Error> {
        register_authority(&env, caller, auth_to_reg, metadata)
    }

    pub fn register(
        env: Env,
        caller: Address,
        schema_definition: SorobanString,
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
        value: SorobanString,
        reference: Option<SorobanString>,
    ) -> Result<(), errors::Error> {
        attest(&env, caller, schema_uid, subject, value, reference)
    }

    pub fn revoke_attestation(
        env: Env,
        caller: Address,
        schema_uid: BytesN<32>,
        subject: Address,
        reference: Option<SorobanString>,
    ) -> Result<(), errors::Error> {
        revoke_attest(&env, caller, schema_uid, subject, reference)
    }

    pub fn get_attestation(
        env: Env,
        schema_uid: BytesN<32>,
        subject: Address,
        reference: Option<SorobanString>,
    ) -> Result<AttestationRecord, errors::Error> {
        get_attest(&env, schema_uid, subject, reference)
    }
}

#[cfg(test)]
mod tests; 