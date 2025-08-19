#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String};
use resolvers::{Attestation as ResolverAttestation, ResolverError, ResolverInterface, ResolverMetadata, ResolverType};

// Import modules
mod access_control;
mod errors;
mod events;
mod macros;
mod payment;
mod state;

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
    //                      Payment and Fee Management
    // ──────────────────────────────────────────────────────────────────────────
    
    /// Pay verification fee to become an authorized authority
    pub fn pay_verification_fee(
        env: Env,
        payer: Address,
        ref_id: String,
        token_address: Address,
    ) -> Result<(), Error> {
        payment::pay_verification_fee(&env, &payer, &ref_id, &token_address)
    }
    
    /// Get payment status for an address
    pub fn get_payment_status(
        env: Env,
        address: Address,
    ) -> Option<state::PaymentRecord> {
        payment::get_payment_status(&env, &address)
    }
    
    /// Admin withdraws collected fees
    pub fn admin_withdraw_fees(
        env: Env,
        admin: Address,
        token_address: Address,
        amount: i128,
    ) -> Result<(), Error> {
        payment::admin_withdraw_fees(&env, &admin, &token_address, amount)
    }
    
    /// Check if an address has confirmed payment
    pub fn has_confirmed_payment(env: Env, address: Address) -> bool {
        state::has_confirmed_payment(&env, &address)
    }
    
    /// Get payment record for an address
    pub fn get_payment_record(env: Env, address: Address) -> Option<state::PaymentRecord> {
        state::get_payment_record(&env, &address)
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

// ══════════════════════════════════════════════════════════════════════════════
// ► Authority Resolver Interface Implementation
// ► 
// ► The Authority contract IS a resolver - specifically the first resolver that
// ► demonstrates the pattern. It validates authority attestations using a 
// ► payment-based access control system.
// ►
// ► TODO: Consider migrating to single on_attest()/on_revoke() hooks in future
// ► to eliminate before/after separation and side effects complexity.
// ══════════════════════════════════════════════════════════════════════════════

#[contractimpl]
impl ResolverInterface for AuthorityResolverContract {
    /// Validates authority attestations before they are created
    /// 
    /// This is the core workflow step 7-8:
    /// 1. Check if the attestation subject has a confirmed payment in our ledger
    /// 2. If confirmed, return TRUE to allow attestation
    /// 3. If not confirmed, return FALSE to block attestation
    fn before_attest(
        env: Env,
        attestation: ResolverAttestation,
    ) -> Result<bool, ResolverError> {
        // Step 7: Check the ledger to match attestation subject to confirmed payment entry
        let has_paid = state::has_confirmed_payment(&env, &attestation.recipient);
        
        if !has_paid {
            // Step 8: Return FALSE - they haven't paid the 100 XLM access fee
            return Err(ResolverError::NotAuthorized);
        }
        
        // Basic validation: ensure attestation has not expired
        if attestation.expiration_time > 0 && 
           attestation.expiration_time < env.ledger().timestamp() {
            return Err(ResolverError::InvalidAttestation);
        }
        
        // Step 8: Return TRUE - payment confirmed, allow attestation
        Ok(true)
    }
    
    /// Registers the authority in our phone book after attestation is created
    fn after_attest(
        env: Env,
        attestation: ResolverAttestation,
    ) -> Result<(), ResolverError> {
        // Get payment record to extract ref_id for authority registration
        let payment_record = state::get_payment_record(&env, &attestation.recipient)
            .ok_or(ResolverError::NotAuthorized)?;
        
        // Create authority data using payment information
        let authority_data = state::RegisteredAuthorityData {
            address: attestation.recipient.clone(),
            metadata: String::from_str(&env, "Verified Authority"), // Could decode from attestation.data
            registration_time: env.ledger().timestamp(),
            ref_id: payment_record.ref_id.clone(), // Reference to their org data on platform
        };
        
        // Register authority in phone book
        state::set_authority_data(&env, &authority_data);
        
        // Emit authority registration event
        env.events().publish(
            (String::from_str(&env, "AUTHORITY_REGISTERED"), &attestation.recipient),
            payment_record.ref_id.clone(),
        );
        
        Ok(())
    }
    
    /// Validates authority revocations - only admin can revoke
    fn before_revoke(
        env: Env,
        _attestation_uid: BytesN<32>,
        attester: Address,
    ) -> Result<bool, ResolverError> {
        // Only admin can revoke authority attestations
        match access_control::is_owner(&env, &attester) {
            true => Ok(true),
            false => Err(ResolverError::NotAuthorized),
        }
    }
    
    /// Removes authority from phone book after revocation
    fn after_revoke(
        env: Env,
        attestation_uid: BytesN<32>,
        _attester: Address,
    ) -> Result<(), ResolverError> {
        // In production, you'd look up the attestation to find the recipient
        // and remove them from the authority phone book
        
        // Emit revocation event
        env.events().publish(
            (String::from_str(&env, "AUTHORITY_REVOKED"), ),
            &attestation_uid,
        );
        
        Ok(())
    }
    
    /// Returns metadata about this resolver
    fn get_metadata(env: Env) -> ResolverMetadata {
        ResolverMetadata {
            name: String::from_str(&env, "Authority Resolver"),
            version: String::from_str(&env, "2.0.0"),
            description: String::from_str(&env, "Paid registry resolver - validates 100 XLM payment before allowing attestations"),
            resolver_type: ResolverType::Authority,
        }
    }
}

#[cfg(test)]
mod test;
