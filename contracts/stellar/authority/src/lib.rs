#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, token};
use resolvers::{Attestation as ResolverAttestation, ResolverError};

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
    OWNERSHIP_TRANSFERRED, SCHEMA_REGISTERED, PAYMENT_RECEIVED,
};
pub use state::{Attestation, DataKey, RegisteredAuthorityData, PaymentRecord};

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

    // ──────────────────────────────────────────────────────────────────────────
    //                      Payment and Resolver Functions
    // ──────────────────────────────────────────────────────────────────────────

    /// Pay verification fee to become eligible for authority registration
    pub fn pay_verification_fee(
        env: Env,
        payer: Address,
        ref_id: String,
        token_address: Address,
    ) -> Result<(), Error> {
        instructions::admin::require_init(&env)?;
        payer.require_auth();

        const REGISTRATION_FEE: i128 = 100_0000000; // 100 XLM
        
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&payer, &env.current_contract_address(), &REGISTRATION_FEE);

        let payment = state::PaymentRecord {
            recipient: payer.clone(),
            timestamp: env.ledger().timestamp(),
            ref_id: ref_id.clone(),
            amount_paid: REGISTRATION_FEE,
        };

        state::record_payment(&env, &payment);
        
        // Emit payment received event
        events::payment_received(&env, &payer, &ref_id, REGISTRATION_FEE);
        
        Ok(())
    }

    /// Check if an address has confirmed payment
    pub fn has_confirmed_payment(env: Env, payer: Address) -> bool {
        state::has_confirmed_payment(&env, &payer)
    }

    /// Get payment record for an address
    pub fn get_payment_record(env: Env, payer: Address) -> Option<state::PaymentRecord> {
        state::get_payment_record(&env, &payer)
    }

    /// Admin function to withdraw collected fees
    pub fn admin_withdraw_fees(
        env: Env,
        admin: Address,
        token_address: Address,
        amount: i128,
    ) -> Result<(), Error> {
        instructions::admin::require_init(&env)?;
        admin.require_auth();
        
        let stored_admin = instructions::admin::get_admin(&env)?;
        if admin != stored_admin {
            return Err(Error::NotAuthorized);
        }

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &admin, &amount);
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    //                           Resolver Interface
    // ──────────────────────────────────────────────────────────────────────────

    /// Called before an attestation is created (resolver interface)
    pub fn before_attest(env: Env, attestation: ResolverAttestation) -> Result<bool, ResolverError> {
        // Check if the attester has confirmed payment
        if !state::has_confirmed_payment(&env, &attestation.attester) {
            return Err(ResolverError::NotAuthorized);
        }
        Ok(true)
    }

    /// Called after an attestation is created (resolver interface)
    pub fn after_attest(env: Env, attestation: ResolverAttestation) -> Result<(), ResolverError> {
        // Register the attester as an authority after successful attestation
        if state::has_confirmed_payment(&env, &attestation.attester) {
            let payment_record = state::get_payment_record(&env, &attestation.attester);
            if let Some(record) = payment_record {
                let authority_data = state::RegisteredAuthorityData {
                    address: attestation.attester.clone(),
                    metadata: String::from_str(&env, "verified_authority"),
                    registration_time: env.ledger().timestamp(),
                    ref_id: record.ref_id,
                };
                state::set_authority_data(&env, &authority_data);
                
                // Emit authority registered event
                events::authority_registered(&env, &attestation.attester, &attestation.attester, &authority_data.metadata);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod test;
#[cfg(test)]  
mod protocol_test;
