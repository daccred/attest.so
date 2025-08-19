#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String};
use resolvers::{Attestation as ResolverAttestation, ResolverError, ResolverInterface, ResolverMetadata, ResolverType};

// Import modules
mod access_control;
mod errors;
mod events;
mod macros;
mod state;
mod trusted_verifiers;

// Simplified instruction modules
mod instructions {
    pub mod admin_simple;
    pub mod resolver_simple;
}

// Re-export types for external use
pub use errors::Error;
pub use events::{
    ADMIN_REG_AUTH, AUTHORITY_REGISTERED, LEVY_COLLECTED, LEVY_WITHDRAWN, OWNERSHIP_RENOUNCED,
    OWNERSHIP_TRANSFERRED, SCHEMA_REGISTERED,
};
pub use state::{Attestation, DataKey, RegisteredAuthorityData};

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
    ) -> Result<(), Error> {
        if state::is_initialized(&env) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        state::set_admin(&env, &admin);
        
        // Set default registration fee (100 XLM in stroops)
        let registration_fee: i128 = 100_0000000; // 100 XLM
        state::set_registration_fee(&env, &registration_fee);
        
        state::set_initialized(&env);
        env.storage()
            .instance()
            .extend_ttl(env.storage().max_ttl() - 100, env.storage().max_ttl());
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    //                      Trusted Verifier Management
    // ──────────────────────────────────────────────────────────────────────────
    
    /// Add a trusted verifier (SAS-style credential issuer pattern)
    pub fn admin_add_verifier(
        env: Env,
        admin: Address,
        verifier: Address,
        max_level: u32,
        verifier_type: String,
    ) -> Result<(), Error> {
        access_control::only_owner(&env, &admin)?;
        trusted_verifiers::add_verifier(&env, &verifier, max_level, &verifier_type, &admin)?;
        
        // Emit event
        env.events().publish(
            (String::from_str(&env, "VERIFIER_ADDED"), &verifier),
            (max_level, verifier_type.clone()),
        );
        Ok(())
    }
    
    /// Remove a trusted verifier
    pub fn admin_remove_verifier(
        env: Env,
        admin: Address,
        verifier: Address,
    ) -> Result<(), Error> {
        access_control::only_owner(&env, &admin)?;
        trusted_verifiers::deactivate_verifier(&env, &verifier)?;
        
        // Emit event
        env.events().publish(
            (String::from_str(&env, "VERIFIER_REMOVED"), ),
            &verifier,
        );
        Ok(())
    }
    
    /// Update verifier's maximum verification level
    pub fn admin_update_verifier_level(
        env: Env,
        admin: Address,
        verifier: Address,
        new_max_level: u32,
    ) -> Result<(), Error> {
        access_control::only_owner(&env, &admin)?;
        trusted_verifiers::update_verifier_level(&env, &verifier, new_max_level)?;
        
        // Emit event
        env.events().publish(
            (String::from_str(&env, "VERIFIER_UPDATED"), &verifier),
            new_max_level,
        );
        Ok(())
    }
    
    /// Check if an address is a trusted verifier
    pub fn is_trusted_verifier(env: Env, verifier: Address) -> bool {
        trusted_verifiers::is_trusted_verifier(&env, &verifier)
    }
    
    /// Get verifier details
    pub fn get_verifier(env: Env, verifier: Address) -> Option<trusted_verifiers::TrustedVerifier> {
        trusted_verifiers::get_trusted_verifier(&env, &verifier)
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
        instructions::admin_simple::admin_register_authority(&env, &admin, &auth_to_reg, &metadata)
    }

    /// Update the registration fee (admin only)
    pub fn set_registration_fee(
        env: Env,
        admin: Address,
        new_fee: i128,
    ) -> Result<(), Error> {
        access_control::only_owner(&env, &admin)?;
        state::set_registration_fee(&env, &new_fee);
        
        // Emit event
        env.events().publish(
            (String::from_str(&env, "REGISTRATION_FEE_UPDATED"), ),
            new_fee,
        );
        
        Ok(())
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
        instructions::resolver_simple::register_authority(&env, &caller, &authority_to_reg, &metadata)
    }

    pub fn is_authority(env: Env, authority: Address) -> Result<bool, Error> {
        instructions::admin_simple::require_init(&env)?;
        Ok(state::is_authority(&env, &authority))
    }

    // ──────────────────────────────────────────────────────────────────────────
    //                             Getter Functions
    // ──────────────────────────────────────────────────────────────────────────
    
    /// Get the registration fee amount
    pub fn get_registration_fee(env: Env) -> Result<i128, Error> {
        if !state::is_initialized(&env) {
            return Err(Error::NotInitialized);
        }
        Ok(state::get_registration_fee(&env).unwrap_or(100_0000000))
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
