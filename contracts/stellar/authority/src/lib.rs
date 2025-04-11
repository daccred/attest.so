#![no_std]
use soroban_sdk::{
    contract, contractimpl, Address, BytesN, Env, String
};

// Import modules
mod errors;
mod events;
mod state;
mod instructions;

// Re-export types for external use
pub use errors::Error;
pub use state::{AttestationRecord, RegisteredAuthorityData, SchemaRules, DataKey};
pub use events::{ADMIN_REG_AUTH, AUTHORITY_REGISTERED, SCHEMA_REGISTERED, LEVY_COLLECTED, LEVY_WITHDRAWN};

#[contract]
pub struct AuthorityResolverContract;

// ══════════════════════════════════════════════════════════════════════════════
// ► Contract Implementation
// ══════════════════════════════════════════════════════════════════════════════
#[contractimpl]
impl AuthorityResolverContract {
    // ──────────────────────────────────────────────────────────────────────────
    //                           Initialization
    // ──────────────────────────────────────────────────────────────────────────
    pub fn initialize(env: Env, admin: Address, token_contract_id: Address) -> Result<(), Error> {
        if state::is_initialized(&env) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        state::set_admin(&env, &admin);
        state::set_token_id(&env, &token_contract_id);
        state::set_initialized(&env);
        env.storage().instance().extend_ttl(
            env.storage().max_ttl() - 100,
            env.storage().max_ttl(),
        );
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    //                           Admin Functions
    // ──────────────────────────────────────────────────────────────────────────
    pub fn admin_register_authority(
        env: Env,
        admin: Address,
        auth_to_reg: Address,
        metadata: String,
    ) -> Result<(), Error> {
        instructions::admin::admin_register_authority(&env, &admin, &auth_to_reg, &metadata)
    }

    pub fn admin_register_schema(
        env: Env,
        admin: Address,
        schema_uid: BytesN<32>,
        rules: SchemaRules,
    ) -> Result<(), Error> {
        instructions::admin::admin_register_schema(&env, &admin, &schema_uid, &rules)
    }

    pub fn admin_set_schema_levy(
        env: Env,
        admin: Address,
        schema_uid: BytesN<32>,
        levy_amount: i128,
        levy_recipient: Address,
    ) -> Result<(), Error> {
        instructions::admin::admin_set_schema_levy(&env, &admin, &schema_uid, levy_amount, &levy_recipient)
    }

    pub fn admin_set_registration_fee(
        env: Env,
        admin: Address,
        fee_amount: i128,
        token_id: Address,
    ) -> Result<(), Error> {
        instructions::admin::admin_set_registration_fee(&env, &admin, &fee_amount, &token_id)
    }

    // ──────────────────────────────────────────────────────────────────────────
    //                         Public/Hook Functions
    // ──────────────────────────────────────────────────────────────────────────
    pub fn register_authority(
        env: Env,
        caller: Address,
        authority_to_reg: Address,
        metadata: String,
    ) -> Result<(), Error> {
        instructions::resolver::register_authority(&env, &caller, &authority_to_reg, &metadata)
    }

    pub fn is_authority(env: Env, authority: Address) -> Result<bool, Error> {
        instructions::admin::require_init(&env)?;
        Ok(state::is_authority(&env, &authority))
    }

    pub fn attest(env: Env, attestation: AttestationRecord) -> Result<bool, Error> {
        instructions::resolver::attest(&env, &attestation)
    }

    pub fn revoke(env: Env, attestation: AttestationRecord) -> Result<bool, Error> {
        instructions::resolver::revoke(&env, &attestation)
    }

    pub fn withdraw_levies(env: Env, caller: Address) -> Result<(), Error> {
        instructions::resolver::withdraw_levies(&env, &caller)
    }

    // ──────────────────────────────────────────────────────────────────────────
    //                             Getter Functions
    // ──────────────────────────────────────────────────────────────────────────
    pub fn get_schema_rules(env: Env, schema_uid: BytesN<32>) -> Result<Option<SchemaRules>, Error> {
        instructions::admin::require_init(&env)?;
        Ok(state::get_schema_rules(&env, &schema_uid))
    }

    pub fn get_collected_levies(env: Env, authority: Address) -> Result<i128, Error> {
        instructions::admin::require_init(&env)?;
        Ok(state::get_collected_levy(&env, &authority))
    }

    pub fn get_token_id(env: Env) -> Result<Address, Error> {
        instructions::admin::get_token_id(&env)
    }

    pub fn get_admin_address(env: Env) -> Result<Address, Error> {
        instructions::admin::get_admin(&env)
    }
}

#[cfg(test)]
mod test;
