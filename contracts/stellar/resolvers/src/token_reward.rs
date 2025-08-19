use soroban_sdk::{contract, contractimpl, contracttype, token, Address, BytesN, Env, String};
use crate::interface::{Attestation, ResolverError, ResolverInterface, ResolverMetadata, ResolverType};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Initialized,
    RewardToken,
    RewardAmount,
    TotalRewarded,
    UserRewards,
}

/// TokenRewardResolver - Distributes token rewards for attestations
#[contract]
pub struct TokenRewardResolver;

#[contractimpl]
impl TokenRewardResolver {
    /// Initialize the resolver with reward token and amount
    pub fn initialize(
        env: Env,
        admin: Address,
        reward_token: Address,
        reward_amount: i128,
    ) -> Result<(), ResolverError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(ResolverError::CustomError); // Already initialized
        }
        
        admin.require_auth();
        
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::RewardToken, &reward_token);
        env.storage().instance().set(&DataKey::RewardAmount, &reward_amount);
        env.storage().instance().set(&DataKey::TotalRewarded, &0i128);
        env.storage().instance().set(&DataKey::Initialized, &true);
        
        env.storage().instance().extend_ttl(
            env.storage().max_ttl() - 100,
            env.storage().max_ttl(),
        );
        
        Ok(())
    }
    
    /// Update reward amount (admin only)
    pub fn set_reward_amount(
        env: Env,
        admin: Address,
        new_amount: i128,
    ) -> Result<(), ResolverError> {
        Self::require_admin(&env, &admin)?;
        
        env.storage().instance().set(&DataKey::RewardAmount, &new_amount);
        
        // Emit event
        env.events().publish(
            (String::from_str(&env, "REWARD_AMOUNT_UPDATED"), ),
            new_amount,
        );
        
        Ok(())
    }
    
    /// Get total rewards distributed
    pub fn get_total_rewarded(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalRewarded)
            .unwrap_or(0)
    }
    
    /// Get user's total rewards earned
    pub fn get_user_rewards(env: Env, user: Address) -> i128 {
        let key = (DataKey::UserRewards, user);
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
            .ok_or(ResolverError::CustomError)?;
        
        if caller != &admin {
            return Err(ResolverError::NotAuthorized);
        }
        
        Ok(())
    }
}

#[contractimpl]
impl ResolverInterface for TokenRewardResolver {
    /// No pre-validation needed for token rewards
    fn before_attest(
        _env: Env,
        _attestation: Attestation,
    ) -> Result<bool, ResolverError> {
        Ok(true)
    }
    
    /// Distribute token rewards after attestation
    fn after_attest(
        env: Env,
        attestation: Attestation,
    ) -> Result<(), ResolverError> {
        // Get reward configuration
        let reward_token: Address = env.storage()
            .instance()
            .get(&DataKey::RewardToken)
            .ok_or(ResolverError::CustomError)?;
        
        let reward_amount: i128 = env.storage()
            .instance()
            .get(&DataKey::RewardAmount)
            .unwrap_or(0);
        
        if reward_amount == 0 {
            return Ok(()); // No rewards configured
        }
        
        // Check contract balance
        let token_client = token::Client::new(&env, &reward_token);
        let balance = token_client.balance(&env.current_contract_address());
        
        if balance < reward_amount {
            return Err(ResolverError::InsufficientFunds);
        }
        
        // Transfer reward to attester
        token_client.transfer(
            &env.current_contract_address(),
            &attestation.attester,
            &reward_amount,
        );
        
        // Update total rewarded
        let total: i128 = env.storage()
            .instance()
            .get(&DataKey::TotalRewarded)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalRewarded, &(total + reward_amount));
        
        // Update user rewards
        let user_key = (DataKey::UserRewards, attestation.attester.clone());
        let user_total: i128 = env.storage()
            .persistent()
            .get(&user_key)
            .unwrap_or(0);
        env.storage().persistent().set(&user_key, &(user_total + reward_amount));
        env.storage().persistent().extend_ttl(
            &user_key,
            env.storage().max_ttl() - 100,
            env.storage().max_ttl(),
        );
        
        // Emit event
        env.events().publish(
            (String::from_str(&env, "REWARD_DISTRIBUTED"), &attestation.attester),
            (&attestation.uid, &reward_amount),
        );
        
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
    
    /// No cleanup needed for revocations (rewards not clawed back)
    fn after_revoke(
        _env: Env,
        _attestation_uid: BytesN<32>,
        _attester: Address,
    ) -> Result<(), ResolverError> {
        Ok(())
    }
    
    fn get_metadata(env: Env) -> ResolverMetadata {
        ResolverMetadata {
            name: String::from_str(&env, "Token Reward Resolver"),
            version: String::from_str(&env, "1.0.0"),
            description: String::from_str(&env, "Distributes token rewards for attestations"),
            resolver_type: ResolverType::TokenReward,
        }
    }
}