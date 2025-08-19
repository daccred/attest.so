#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, BytesN, Env, String};
use resolver_interface::{Attestation, ResolverError, ResolverInterface, ResolverMetadata, ResolverType};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Initialized,
    AttestationFee,
    FeeRecipient,
    TotalCollected,
    CollectedFees,
}

/// FeeCollectionResolver - Collects XLM fees for attestations
#[contract]
pub struct FeeCollectionResolver;

#[contractimpl]
impl FeeCollectionResolver {
    /// Initialize the resolver with fee configuration
    pub fn initialize(
        env: Env,
        admin: Address,
        attestation_fee: i128,
        fee_recipient: Address,
    ) -> Result<(), ResolverError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(ResolverError::CustomError(1)); // Already initialized
        }
        
        admin.require_auth();
        
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::AttestationFee, &attestation_fee);
        env.storage().instance().set(&DataKey::FeeRecipient, &fee_recipient);
        env.storage().instance().set(&DataKey::TotalCollected, &0i128);
        env.storage().instance().set(&DataKey::Initialized, &true);
        
        env.storage().instance().extend_ttl(
            env.storage().max_ttl() - 100,
            env.storage().max_ttl(),
        );
        
        Ok(())
    }
    
    /// Update attestation fee (admin only)
    pub fn set_attestation_fee(
        env: Env,
        admin: Address,
        new_fee: i128,
    ) -> Result<(), ResolverError> {
        Self::require_admin(&env, &admin)?;
        
        env.storage().instance().set(&DataKey::AttestationFee, &new_fee);
        
        // Emit event
        env.events().publish(
            (String::from_str(&env, "FEE_UPDATED"), ),
            new_fee,
        );
        
        Ok(())
    }
    
    /// Update fee recipient (admin only)
    pub fn set_fee_recipient(
        env: Env,
        admin: Address,
        new_recipient: Address,
    ) -> Result<(), ResolverError> {
        Self::require_admin(&env, &admin)?;
        
        env.storage().instance().set(&DataKey::FeeRecipient, &new_recipient);
        
        // Emit event
        env.events().publish(
            (String::from_str(&env, "RECIPIENT_UPDATED"), ),
            &new_recipient,
        );
        
        Ok(())
    }
    
    /// Withdraw collected fees (fee recipient only)
    pub fn withdraw_fees(
        env: Env,
        recipient: Address,
    ) -> Result<(), ResolverError> {
        recipient.require_auth();
        
        let fee_recipient: Address = env.storage()
            .instance()
            .get(&DataKey::FeeRecipient)
            .ok_or(ResolverError::CustomError(2))?; // Not initialized
        
        if recipient != fee_recipient {
            return Err(ResolverError::NotAuthorized);
        }
        
        // Get collected fees for this recipient
        let key = (DataKey::CollectedFees, recipient.clone());
        let collected: i128 = env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(0);
        
        if collected == 0 {
            return Ok(()); // Nothing to withdraw
        }
        
        // Transfer XLM
        let xlm_client = token::Client::new(&env, &token::StellarAssetClient::native(&env));
        xlm_client.transfer(&env.current_contract_address(), &recipient, &collected);
        
        // Reset collected amount
        env.storage().persistent().set(&key, &0i128);
        
        // Emit event
        env.events().publish(
            (String::from_str(&env, "FEES_WITHDRAWN"), &recipient),
            collected,
        );
        
        Ok(())
    }
    
    /// Get total fees collected
    pub fn get_total_collected(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalCollected)
            .unwrap_or(0)
    }
    
    /// Get collected fees for recipient
    pub fn get_collected_fees(env: Env, recipient: Address) -> i128 {
        let key = (DataKey::CollectedFees, recipient);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(0)
    }
    
    fn require_admin(env: &Env, caller: &Address) -> Result<(), ResolverError> {
        caller.require_auth();
        
        let admin: Address = env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ResolverError::CustomError(2))?; // Not initialized
        
        if caller != &admin {
            return Err(ResolverError::NotAuthorized);
        }
        
        Ok(())
    }
}

#[contractimpl]
impl ResolverInterface for FeeCollectionResolver {
    /// Collect fee before attestation
    fn before_attest(
        env: Env,
        attestation: Attestation,
    ) -> Result<bool, ResolverError> {
        // Get fee configuration
        let attestation_fee: i128 = env.storage()
            .instance()
            .get(&DataKey::AttestationFee)
            .unwrap_or(0);
        
        if attestation_fee == 0 {
            return Ok(true); // No fee required
        }
        
        let fee_recipient: Address = env.storage()
            .instance()
            .get(&DataKey::FeeRecipient)
            .ok_or(ResolverError::CustomError(2))?; // Not initialized
        
        // Collect XLM fee from attester
        let xlm_client = token::Client::new(&env, &token::StellarAssetClient::native(&env));
        xlm_client.transfer(&attestation.attester, &env.current_contract_address(), &attestation_fee);
        
        // Track collected fees for recipient
        let key = (DataKey::CollectedFees, fee_recipient.clone());
        let collected: i128 = env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(0);
        env.storage().persistent().set(&key, &(collected + attestation_fee));
        env.storage().persistent().extend_ttl(
            &key,
            env.storage().max_ttl() - 100,
            env.storage().max_ttl(),
        );
        
        // Update total collected
        let total: i128 = env.storage()
            .instance()
            .get(&DataKey::TotalCollected)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalCollected, &(total + attestation_fee));
        
        // Emit event
        env.events().publish(
            (String::from_str(&env, "FEE_COLLECTED"), &attestation.attester),
            (&attestation.uid, &attestation_fee),
        );
        
        Ok(true)
    }
    
    /// No post-processing needed
    fn after_attest(
        _env: Env,
        _attestation: Attestation,
    ) -> Result<(), ResolverError> {
        Ok(())
    }
    
    /// No validation needed for revocations
    fn before_revoke(
        _env: Env,
        _attestation_uid: BytesN<32>,
        _attester: Address,
    ) -> Result<bool, ResolverError> {
        Ok(true)
    }
    
    /// No cleanup needed for revocations (fees not refunded)
    fn after_revoke(
        _env: Env,
        _attestation_uid: BytesN<32>,
        _attester: Address,
    ) -> Result<(), ResolverError> {
        Ok(())
    }
    
    fn get_metadata(env: Env) -> ResolverMetadata {
        ResolverMetadata {
            name: String::from_str(&env, "Fee Collection Resolver"),
            version: String::from_str(&env, "1.0.0"),
            description: String::from_str(&env, "Collects XLM fees for attestations"),
            resolver_type: ResolverType::FeeCollection,
        }
    }
}