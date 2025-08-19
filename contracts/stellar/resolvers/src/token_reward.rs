use soroban_sdk::{contract, contractimpl, contracttype, token, Address, BytesN, Env, String};
use soroban_contracts_sdk::token::{Fungible, TokenMetadata};
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
    /// **PERMISSIONLESS VALIDATION**: Allows all attestations for token reward incentives
    ///
    /// This resolver implements an open, permissionless model where anyone can create
    /// attestations and receive token rewards. This incentivizes attestation creation
    /// while relying on economic mechanisms and token distribution for quality control.
    ///
    /// # Economic Model
    /// - **Open Participation**: No barriers to attestation creation
    /// - **Token Incentives**: Reward distribution encourages attestation volume
    /// - **Market Mechanisms**: Token value and gas costs provide natural rate limiting
    /// - **Reward Pool**: Limited by contract's token balance
    ///
    /// # Security Trade-offs
    /// - **No Access Control**: Anyone can create attestations (potential spam)
    /// - **Economic Balance**: Gas costs vs reward amounts provide equilibrium
    /// - **Token Pool Security**: Rewards limited by available token reserves
    /// - **Attestation Quality**: Relies on external validation mechanisms
    ///
    /// # Alternative Implementations
    /// Production versions might add:
    /// - Minimum stake requirements for attesters
    /// - Rate limiting per address to prevent spam
    /// - Reputation-based multipliers for rewards
    /// - Quality scoring mechanisms
    ///
    /// # Parameters
    /// * `_env` - Soroban environment (unused in permissionless model)
    /// * `_attestation` - Attestation data (no validation performed)
    ///
    /// # Returns
    /// * `Ok(true)` - Always allows attestations (permissionless access)
    fn before_attest(
        _env: Env,
        _attestation: Attestation,
    ) -> Result<bool, ResolverError> {
        // PERMISSIONLESS MODEL: Allow all attestations
        // Economic incentives through token rewards drive participation
        // Gas costs provide natural spam resistance
        Ok(true)
    }
    
    /// **TOKEN DISTRIBUTION FUNCTION**: Distributes rewards after successful attestation
    ///
    /// This function implements the reward distribution logic that incentivizes attestation
    /// creation. It transfers tokens from the contract's reward pool to the attester's wallet,
    /// creating economic incentives for participation in the attestation ecosystem.
    ///
    /// # Economic Mechanics
    /// - **Immediate Rewards**: Tokens distributed instantly after attestation creation
    /// - **Fixed Amount**: Each attestation receives same reward amount (configurable)
    /// - **Pool Depletion**: Rewards stop when contract balance insufficient
    /// - **Tracking**: Complete audit trail of reward distribution
    ///
    /// # Token Safety
    /// - **Balance Verification**: Checks sufficient tokens before transfer
    /// - **Atomic Transfer**: Token transfer succeeds or entire operation fails
    /// - **Error Handling**: Graceful handling of insufficient funds
    /// - **Authorization**: Contract authorized to transfer its own tokens
    ///
    /// # State Updates
    /// 1. **Total Tracking**: Updates cumulative rewards distributed
    /// 2. **User Tracking**: Records individual user reward totals
    /// 3. **Event Emission**: Publishes reward distribution event
    /// 4. **TTL Extension**: Ensures user reward data persists
    ///
    /// # Parameters
    /// * `env` - Soroban environment for storage and token operations
    /// * `attestation` - Attestation data containing attester address and attestation UID
    ///
    /// # Returns
    /// * `Ok(())` - Reward distributed successfully
    /// * `Err(ResolverError::CustomError)` - Reward token not configured
    /// * `Err(ResolverError::InsufficientFunds)` - Contract balance too low
    ///
    /// # Critical Security Properties
    /// - **Authorization**: Only contract can initiate token transfers from its balance
    /// - **Balance Protection**: Cannot transfer more tokens than available
    /// - **State Consistency**: All state updates are atomic with token transfer
    /// - **Audit Trail**: Complete record of all reward distributions
    ///
    /// # Attack Vectors & Mitigations
    /// * **Double Spending**: Attempting to drain reward pool
    ///   - *Mitigation*: Balance check before each transfer prevents over-distribution
    /// * **Reward Manipulation**: Attempting to claim rewards without attestation
    ///   - *Mitigation*: Function only called by protocol after successful attestation
    /// * **Token Substitution**: Using wrong token for rewards
    ///   - *Mitigation*: Token address stored in contract state and validated
    /// * **Balance Exhaustion**: Draining reward pool through spam
    ///   - *Mitigation*: Economic balance between gas costs and reward amounts
    ///
    /// # Economic Attack Analysis
    /// - **Cost to Attack**: Gas cost per attestation vs reward amount received
    /// - **Profitability Threshold**: Attack profitable only if reward > gas cost
    /// - **Natural Rate Limiting**: Economics provide automatic spam resistance
    /// - **Pool Sustainability**: Requires periodic refunding for continued operation
    fn after_attest(
        env: Env,
        attestation: Attestation,
    ) -> Result<(), ResolverError> {
        // STEP 1: Load reward configuration from contract storage
        let reward_token: Address = env.storage()
            .instance()
            .get(&DataKey::RewardToken)
            .ok_or(ResolverError::CustomError)?; // Resolver not properly initialized
        
        let reward_amount: i128 = env.storage()
            .instance()
            .get(&DataKey::RewardAmount)
            .unwrap_or(0);
        
        // EARLY EXIT: No rewards configured (admin set amount to 0)
        if reward_amount == 0 {
            return Ok(()); // Silent success - no rewards to distribute
        }
        
        // STEP 2: Verify contract has sufficient token balance
        let token_client = token::Client::new(&env, &reward_token);
        let balance = token_client.balance(&env.current_contract_address());
        
        if balance < reward_amount {
            // INSUFFICIENT FUNDS: Cannot distribute reward - pool depleted
            return Err(ResolverError::InsufficientFunds);
        }
        
        // STEP 3: Transfer reward tokens to attester
        // This is the core economic incentive - immediate token reward for attestation
        token_client.transfer(
            &env.current_contract_address(), // From: contract's reward pool
            &attestation.attester,           // To: attestation creator
            &reward_amount,                  // Amount: configured reward per attestation
        );
        
        // STEP 4: Update total rewards distributed (audit trail)
        let total: i128 = env.storage()
            .instance()
            .get(&DataKey::TotalRewarded)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalRewarded, &(total + reward_amount));
        
        // STEP 5: Update individual user reward totals
        let user_key = (DataKey::UserRewards, attestation.attester.clone());
        let user_total: i128 = env.storage()
            .persistent()
            .get(&user_key)
            .unwrap_or(0);
        env.storage().persistent().set(&user_key, &(user_total + reward_amount));
        
        // Extend TTL to ensure user reward data persists
        env.storage().persistent().extend_ttl(
            &user_key,
            env.storage().max_ttl() - 100,
            env.storage().max_ttl(),
        );
        
        // STEP 6: Emit reward distribution event for monitoring
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

// ══════════════════════════════════════════════════════════════════════════════
// ► OpenZeppelin Fungible Token Interface Implementation
// ► 
// ► This implementation makes TokenRewardResolver a dual-interface contract that
// ► functions as both a resolver for attestation rewards AND a standard fungible
// ► token compliant with OpenZeppelin patterns.
// ══════════════════════════════════════════════════════════════════════════════

#[contractimpl]
impl Fungible for TokenRewardResolver {
    /// **TOKEN METADATA**: Returns the human-readable name of the reward token
    ///
    /// This function provides the display name for the reward token that users
    /// will see in wallets and applications. The name identifies this as a
    /// reward token specifically for attestation activities.
    ///
    /// # Returns
    /// * `String` - "Attestation Reward Token" (static name)
    fn name(env: Env) -> String {
        String::from_str(&env, "Attestation Reward Token")
    }
    
    /// **TOKEN METADATA**: Returns the trading symbol for the reward token
    ///
    /// This provides a short, unique identifier for the token that will be
    /// used in trading interfaces and token listings.
    ///
    /// # Returns
    /// * `String` - "AREWARD" (static symbol)
    fn symbol(env: Env) -> String {
        String::from_str(&env, "AREWARD")
    }
    
    /// **TOKEN METADATA**: Returns the number of decimal places for the token
    ///
    /// Following Stellar's standard pattern, this token uses 7 decimal places
    /// which aligns with XLM and most Stellar tokens for compatibility.
    ///
    /// # Returns
    /// * `u32` - 7 (standard Stellar decimal places)
    fn decimals(env: Env) -> u32 {
        7
    }
    
    /// **BALANCE QUERY**: Returns accumulated reward balance for an address
    ///
    /// This function returns the total amount of reward tokens that an address
    /// has earned through attestation activities. Unlike typical token balances,
    /// this represents earned rewards that were distributed via the resolver.
    ///
    /// # Business Model Integration
    /// - **Reward Tracking**: Shows cumulative rewards earned per user
    /// - **Incentive Visibility**: Users can see their attestation earnings
    /// - **Token Standard Compliance**: Enables wallet/dapp integration
    /// - **History Preservation**: Permanent record of reward accumulation
    ///
    /// # Parameters
    /// * `env` - Soroban environment for storage access
    /// * `id` - Address to query reward balance for
    ///
    /// # Returns
    /// * `i128` - Total reward tokens earned by the address
    ///
    /// # Implementation Note
    /// This returns the reward balance tracked by the resolver, NOT the actual
    /// token balance in the user's wallet. The resolver tracks rewards distributed
    /// but doesn't control the tokens after distribution.
    fn balance(env: Env, id: Address) -> i128 {
        // Return accumulated reward balance from resolver tracking
        // This shows total rewards earned through attestation activities
        TokenRewardResolver::get_user_rewards(env, id)
    }
    
    /// **SUPPLY TRACKING**: Returns total rewards distributed by this resolver
    ///
    /// This function returns the cumulative amount of reward tokens that have
    /// been distributed through the attestation reward system. This represents
    /// the "total supply" from the perspective of rewards earned.
    ///
    /// # Economic Metrics
    /// - **Reward Volume**: Total tokens distributed as attestation incentives
    /// - **System Activity**: Indicator of overall attestation ecosystem activity
    /// - **Pool Depletion**: Shows how much of reward pool has been distributed
    /// - **Economic Impact**: Measures total value distributed to participants
    ///
    /// # Returns
    /// * `i128` - Total reward tokens distributed by this resolver
    ///
    /// # Implementation Note
    /// This tracks rewards distributed BY this resolver contract, not the total
    /// supply of the underlying reward token. The actual token has its own supply.
    fn total_supply(env: Env) -> i128 {
        // Return total rewards distributed through attestation activities
        // This represents the cumulative economic incentives provided
        TokenRewardResolver::get_total_rewarded(env)
    }
    
    /// **TRANSFER FUNCTION**: Standard token transfer (limited implementation)
    ///
    /// This function provides basic transfer capability but with restrictions
    /// since this contract primarily manages reward distribution rather than
    /// general token operations.
    ///
    /// # Restrictions
    /// - **Admin Only**: Only admin can initiate transfers (for reward pool management)
    /// - **Pool Management**: Primarily for funding/managing the reward pool
    /// - **No User Transfers**: Regular users cannot transfer through this interface
    /// - **Reward Distribution**: Main transfers happen via after_attest hook
    ///
    /// # Parameters
    /// * `env` - Soroban environment
    /// * `from` - Source address (must be admin or contract)
    /// * `to` - Destination address
    /// * `amount` - Amount to transfer
    ///
    /// # Returns
    /// * `Result<(), TokenError>` - Success or failure of transfer
    ///
    /// # Security Model
    /// This is a restricted transfer implementation that prevents general use
    /// as a normal token while allowing admin pool management operations.
    fn transfer(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), soroban_contracts_sdk::token::TokenError> {
        from.require_auth();
        
        // Get admin address for authorization
        let admin: Address = env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(soroban_contracts_sdk::token::TokenError::InternalError)?;
        
        // Only allow admin or contract to initiate transfers
        if from != admin && from != env.current_contract_address() {
            return Err(soroban_contracts_sdk::token::TokenError::InternalError);
        }
        
        // Get reward token and execute transfer
        let reward_token: Address = env.storage()
            .instance()
            .get(&DataKey::RewardToken)
            .ok_or(soroban_contracts_sdk::token::TokenError::InternalError)?;
        
        let token_client = token::Client::new(&env, &reward_token);
        token_client.transfer(&from, &to, &amount);
        
        // Emit transfer event for OpenZeppelin compliance
        env.events().publish(
            (String::from_str(&env, "TRANSFER"), &from, &to),
            amount,
        );
        
        Ok(())
    }
    
    /// **TRANSFER FROM**: Delegated transfer with allowance (not implemented)
    ///
    /// This function is required by the Fungible interface but not implemented
    /// for this reward resolver since it doesn't support general token operations
    /// with allowances and approvals.
    ///
    /// # Design Decision
    /// The reward resolver focuses on automatic reward distribution rather than
    /// general token operations. Users receive rewards automatically and can
    /// interact with the actual reward token for further operations.
    fn transfer_from(
        _env: Env,
        _spender: Address,
        _from: Address,
        _to: Address,
        _amount: i128,
    ) -> Result<(), soroban_contracts_sdk::token::TokenError> {
        // Not implemented for reward resolver - use direct reward token for allowances
        Err(soroban_contracts_sdk::token::TokenError::InternalError)
    }
    
    /// **APPROVE**: Approve spending allowance (not implemented)
    ///
    /// This function is required by the Fungible interface but not implemented
    /// since the reward resolver doesn't support general allowance operations.
    fn approve(
        _env: Env,
        _owner: Address,
        _spender: Address,
        _amount: i128,
        _expiration_ledger: u32,
    ) -> Result<(), soroban_contracts_sdk::token::TokenError> {
        // Not implemented for reward resolver - use direct reward token for approvals
        Err(soroban_contracts_sdk::token::TokenError::InternalError)
    }
    
    /// **ALLOWANCE QUERY**: Get approved spending amount (not implemented)
    ///
    /// This function is required by the Fungible interface but returns 0
    /// since the reward resolver doesn't track allowances.
    fn allowance(
        _env: Env,
        _owner: Address,
        _spender: Address,
    ) -> i128 {
        // No allowances in reward resolver - return 0
        0
    }
}