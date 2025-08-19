#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String};

// Import modules
mod access_control;
mod errors;
mod events;
mod instructions;
mod macros;
mod state;

// Re-export types for external use
pub use errors::Error;
pub use events::{
    ADMIN_REG_AUTH, AUTHORITY_REGISTERED, LEVY_COLLECTED, LEVY_WITHDRAWN, OWNERSHIP_RENOUNCED,
    OWNERSHIP_TRANSFERRED, SCHEMA_REGISTERED,
};
pub use state::{Attestation, DataKey, RegisteredAuthorityData, SchemaRules};

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
    pub fn initialize(
        env: Env, 
        admin: Address, 
        token_contract_id: Address,
        token_wasm_hash: BytesN<32>
    ) -> Result<(), Error> {
        if state::is_initialized(&env) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        state::set_admin(&env, &admin);
        state::set_token_id(&env, &token_contract_id);
        state::set_token_wasm_hash(&env, &token_wasm_hash);
        state::set_initialized(&env);
        env.storage()
            .instance()
            .extend_ttl(env.storage().max_ttl() - 100, env.storage().max_ttl());
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
        instructions::admin::admin_set_schema_levy(
            &env,
            &admin,
            &schema_uid,
            levy_amount,
            &levy_recipient,
        )
    }

    pub fn admin_set_registration_fee(
        env: Env,
        admin: Address,
        fee_amount: i128,
        token_id: Address,
    ) -> Result<(), Error> {
        instructions::admin::admin_set_registration_fee(&env, &admin, &fee_amount, &token_id)
    }

    /// Set XLM attestation fee and fee recipient for a schema
    pub fn admin_set_schema_fee(
        env: Env,
        admin: Address,
        schema_uid: BytesN<32>,
        attestation_fee: i128,
        fee_recipient: Address,
    ) -> Result<(), Error> {
        instructions::admin::admin_set_schema_fee(
            &env,
            &admin,
            &schema_uid,
            attestation_fee,
            &fee_recipient,
        )
    }

    /// Set reward token and amount for a schema
    pub fn admin_set_schema_rewards(
        env: Env,
        admin: Address,
        schema_uid: BytesN<32>,
        reward_token: Address,
        reward_amount: i128,
    ) -> Result<(), Error> {
        instructions::admin::admin_set_schema_rewards(
            &env,
            &admin,
            &schema_uid,
            &reward_token,
            reward_amount,
        )
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

    pub fn attest(env: Env, attestation: Attestation) -> Result<bool, Error> {
        instructions::resolver::attest(&env, &attestation)
    }

    pub fn revoke(env: Env, attestation: Attestation) -> Result<bool, Error> {
        instructions::resolver::revoke(&env, &attestation)
    }

    pub fn withdraw_levies(env: Env, caller: Address) -> Result<(), Error> {
        instructions::resolver::withdraw_levies(&env, &caller)
    }

    /// Withdraw collected XLM fees for an authority
    pub fn withdraw_fees(env: Env, caller: Address) -> Result<(), Error> {
        instructions::resolver::withdraw_fees(&env, &caller)
    }

    // ──────────────────────────────────────────────────────────────────────────
    //                             Getter Functions
    // ──────────────────────────────────────────────────────────────────────────
    pub fn get_schema_rules(
        env: Env,
        schema_uid: BytesN<32>,
    ) -> Result<Option<SchemaRules>, Error> {
        instructions::admin::require_init(&env)?;
        Ok(state::get_schema_rules(&env, &schema_uid))
    }

    pub fn get_collected_levies(env: Env, authority: Address) -> Result<i128, Error> {
        instructions::admin::require_init(&env)?;
        Ok(state::get_collected_levy(&env, &authority))
    }

    /// Get collected XLM fees for an authority
    pub fn get_collected_fees(env: Env, authority: Address) -> Result<i128, Error> {
        instructions::admin::require_init(&env)?;
        Ok(state::get_collected_fees(&env, &authority))
    }

    pub fn get_token_id(env: Env) -> Result<Address, Error> {
        instructions::admin::get_token_id(&env)
    }

    pub fn get_admin_address(env: Env) -> Result<Address, Error> {
        instructions::admin::get_admin(&env)
    }

    // ──────────────────────────────────────────────────────────────────────────
    //                        Ownership Management Functions
    // ──────────────────────────────────────────────────────────────────────────

    /// Transfer ownership of the contract to a new address
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `current_owner` - The current owner address (must be authenticated)
    /// * `new_owner` - The address to transfer ownership to
    ///
    /// # Returns
    /// * `Ok(())` - If ownership transfer is successful
    /// * `Err(Error)` - If not authorized or validation fails
    pub fn transfer_ownership(
        env: Env,
        current_owner: Address,
        new_owner: Address,
    ) -> Result<(), Error> {
        access_control::transfer_ownership(&env, &current_owner, &new_owner)
    }

    /// Renounce ownership of the contract (permanent action)
    ///
    /// # Arguments
    /// * `env` - The Soroban environment  
    /// * `current_owner` - The current owner address (must be authenticated)
    ///
    /// # Returns
    /// * `Ok(())` - If ownership renunciation is successful
    /// * `Err(Error)` - If not authorized
    ///
    /// # Warning
    /// This is irreversible! After renouncing ownership, all admin functions become inaccessible.
    pub fn renounce_ownership(env: Env, current_owner: Address) -> Result<(), Error> {
        access_control::renounce_ownership(&env, &current_owner)
    }

    /// Get the current owner of the contract
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    ///
    /// # Returns
    /// * `Ok(Address)` - The current owner address
    /// * `Err(Error)` - If no owner is set (contract not initialized)
    pub fn get_owner(env: Env) -> Result<Address, Error> {
        access_control::get_owner(&env)
    }

    /// Check if an address is the current owner
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `address` - The address to check
    ///
    /// # Returns
    /// * `bool` - True if the address is the owner, false otherwise
    pub fn is_owner(env: Env, address: Address) -> bool {
        access_control::is_owner(&env, &address)
    }
}

#[cfg(test)]
mod test;
