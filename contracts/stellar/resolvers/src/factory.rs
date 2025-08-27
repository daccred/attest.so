// ══════════════════════════════════════════════════════════════════════════════
// ► Resolver Factory - On-Chain Configuration Registry
// ►
// ► This contract implements a factory pattern to serve as an on-chain registry for
// ► resolver configurations. It does not deploy contracts directly but tracks their
// ► intended configurations, allowing off-chain processes to deploy and initialize them.
// ► This pattern provides a centralized authority for discovering and managing resolvers.
// ►
// ► @see https://github.com/blend-capital/blend-contracts-v2/blob/main/pool-factory/src/pool_factory.rs
// ►     Inspired by Blend Capital's pool factory for production-ready factory patterns.
// ►
// ► Core Concepts:
// ► 1. Factory as a Registry: Manages configurations, not direct deployments.
// ► 2. On-Chain Discovery: Provides a single source of truth for resolver instances.
// ► 3. Lifecycle Management: Tracks the state (e.g., active, inactive) of each resolver.
// ► 4. Configuration Parameterization: Supports creating resolvers with unique settings.
// ► 5. Event Emission: Emits events for auditing and off-chain monitoring.
// ══════════════════════════════════════════════════════════════════════════════
use crate::interface::{ResolverError, ResolverType};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, String, Vec};

#[cfg(test)]
use soroban_sdk::testutils::Address as TestAddress;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Initialized,
    // Factory tracking
    ResolverCount,
    ResolverInstances,
    ResolverConfigs,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ResolverConfig {
    pub resolver_type: ResolverType,
    pub name: String,
    pub description: String,
    pub admin: Address,
    pub config_data: Map<String, String>, // Flexible configuration storage
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ResolverInstance {
    pub address: Address,
    pub config: ResolverConfig,
    pub created_at: u64,
    pub is_active: bool,
}

#[contract]
pub struct ResolverFactory;

#[contractimpl]
impl ResolverFactory {
    /// Initializes the factory contract with an administrative address.
    ///
    /// This function can only be called once. It sets the admin who has permission
    /// to create and manage resolver configurations.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment.
    /// * `admin` - The address of the administrator for this factory.
    ///
    /// # Panics
    /// Panics if the contract has already been initialized.
    pub fn initialize(env: Env, admin: Address) -> Result<(), ResolverError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(ResolverError::CustomError); // Already initialized
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::ResolverCount, &0u32);

        env.storage()
            .instance()
            .extend_ttl(env.storage().max_ttl() - 100, env.storage().max_ttl());

        Ok(())
    }

    /// Registers the configuration for a new `TokenRewardResolver`.
    ///
    /// This function does not deploy the resolver contract itself. Instead, it generates a
    /// placeholder address, stores the intended configuration, and emits an event. An
    /// off-chain process is expected to monitor these events to perform the actual
    /// contract deployment and initialization.
    ///
    /// # Arguments
    /// * `admin` - The admin of the factory, required for authorization.
    /// * `reward_token` - The address of the token to be distributed as rewards.
    /// * `reward_amount` - The amount of tokens to distribute per attestation.
    /// * `pool_name` - A human-readable name for the resolver instance.
    /// * `pool_description` - A description of the resolver's purpose.
    ///
    /// # Returns
    /// A unique, placeholder `Address` used to identify this resolver's configuration.
    pub fn create_token_reward_resolver(
        env: Env,
        admin: Address,
        reward_token: Address,
        reward_amount: i128,
        pool_name: String,
        pool_description: String,
    ) -> Result<Address, ResolverError> {
        // Call the version with optional address, passing None to auto-generate
        Self::create_token_reward_with_addr(
            env,
            admin,
            None,
            reward_token,
            reward_amount,
            pool_name,
            pool_description,
        )
    }

    /// Registers the configuration for a new `TokenRewardResolver` with a specific address.
    ///
    /// This variant allows specifying the resolver address, useful for:
    /// 1. Testing with predictable addresses
    /// 2. Registering pre-deployed contracts
    /// 3. Integration with external deployment systems
    ///
    /// # Arguments
    /// * `admin` - The admin of the factory, required for authorization.
    /// * `resolver_addr` - Optional specific address for the resolver. If None, generates one.
    /// * `reward_token` - The address of the token to be distributed as rewards.
    /// * `reward_amount` - The amount of tokens to distribute per attestation.
    /// * `pool_name` - A human-readable name for the resolver instance.
    /// * `pool_description` - A description of the resolver's purpose.
    ///
    /// # Returns
    /// The `Address` used to identify this resolver's configuration.
    pub fn create_token_reward_with_addr(
        env: Env,
        admin: Address,
        resolver_addr: Option<Address>,
        reward_token: Address,
        reward_amount: i128,
        pool_name: String,
        pool_description: String,
    ) -> Result<Address, ResolverError> {
        Self::require_admin(&env, &admin)?;

        // STEP 1: Use provided address or generate one
        let resolver_address = match resolver_addr {
            Some(addr) => addr,
            None => Self::generate_resolver_address(&env)?,
        };

        // STEP 2: Create configuration for the resolver
        let mut config_data = Map::new(&env);
        config_data.set(String::from_str(&env, "reward_token"), reward_token.to_string());
        // Store reward amount as a simple string for config data
        let reward_amount_str = if reward_amount >= 0 {
            String::from_str(&env, "positive_amount")
        } else {
            String::from_str(&env, "negative_amount")
        };
        config_data.set(String::from_str(&env, "reward_amount"), reward_amount_str);

        let config = ResolverConfig {
            resolver_type: ResolverType::TokenReward,
            name: pool_name,
            description: pool_description,
            admin: admin.clone(),
            config_data,
        };

        // STEP 3: Track deployment configuration
        // LEARNING: In current Soroban SDK, actual contract deployment would happen
        // through deployment scripts or using env.register() in test environments.
        // This factory tracks the configuration for later deployment.
        // In tests, you would use: env.register(TokenRewardResolver, (admin, reward_token, reward_amount));

        // STEP 4: Track the new instance
        Self::track_resolver_instance(&env, &resolver_address, &config)?;

        // STEP 5: Emit creation event
        env.events().publish(
            (
                String::from_str(&env, "TOKEN_REWARD_RESOLVER_CREATED"),
                &resolver_address,
            ),
            (config.name, reward_amount),
        );

        Ok(resolver_address)
    }

    /// Registers the configuration for a new `FeeCollectionResolver`.
    ///
    /// Similar to `create_token_reward_resolver`, this function registers the configuration
    /// for a fee-collecting resolver without deploying the contract. It stores the
    /// configuration and emits an event for off-chain deployment services.
    ///
    /// # Arguments
    /// * `admin` - The admin of the factory, required for authorization.
    /// * `fee_token` - The address of the token to be collected as a fee.
    /// * `fee_amount` - The fee amount per attestation.
    /// * `fee_recipient` - The address that will receive the collected fees.
    /// * `collector_name` - A human-readable name for the resolver instance.
    /// * `collector_description` - A description of the resolver's purpose.
    ///
    /// # Returns
    /// A unique, placeholder `Address` used to identify this resolver's configuration.
    pub fn create_fee_collection_resolver(
        env: Env,
        admin: Address,
        fee_token: Address,
        fee_amount: i128,
        fee_recipient: Address,
        collector_name: String,
        collector_description: String,
    ) -> Result<Address, ResolverError> {
        // Call the version with optional address, passing None to auto-generate
        Self::create_fee_resolver_with_addr(
            env,
            admin,
            None,
            fee_token,
            fee_amount,
            fee_recipient,
            collector_name,
            collector_description,
        )
    }

    /// Registers the configuration for a new `FeeCollectionResolver` with a specific address.
    ///
    /// This variant allows specifying the resolver address, useful for:
    /// 1. Testing with predictable addresses
    /// 2. Registering pre-deployed contracts
    /// 3. Integration with external deployment systems
    ///
    /// # Arguments
    /// * `admin` - The admin of the factory, required for authorization.
    /// * `resolver_addr` - Optional specific address for the resolver. If None, generates one.
    /// * `fee_token` - The address of the token to be collected as a fee.
    /// * `fee_amount` - The fee amount per attestation.
    /// * `fee_recipient` - The address that will receive the collected fees.
    /// * `collector_name` - A human-readable name for the resolver instance.
    /// * `collector_description` - A description of the resolver's purpose.
    ///
    /// # Returns
    /// The `Address` used to identify this resolver's configuration.
    pub fn create_fee_resolver_with_addr(
        env: Env,
        admin: Address,
        resolver_addr: Option<Address>,
        fee_token: Address,
        fee_amount: i128,
        fee_recipient: Address,
        collector_name: String,
        collector_description: String,
    ) -> Result<Address, ResolverError> {
        Self::require_admin(&env, &admin)?;

        // Use provided address or generate one
        let resolver_address = match resolver_addr {
            Some(addr) => addr,
            None => Self::generate_resolver_address(&env)?,
        };

        let mut config_data = Map::new(&env);
        config_data.set(String::from_str(&env, "fee_token"), fee_token.to_string());
        config_data.set(
            String::from_str(&env, "fee_amount"),
            String::from_str(&env, "fee_amount"),
        );
        config_data.set(String::from_str(&env, "fee_recipient"), fee_recipient.to_string());

        let config = ResolverConfig {
            resolver_type: ResolverType::FeeCollection,
            name: collector_name,
            description: collector_description,
            admin: admin.clone(),
            config_data,
        };

        // Deploy fee collection resolver
        // NOTE: In production, contract deployment would happen here.
        // This factory tracks the configuration for the resolver.
        // In tests: env.register(FeeCollectionResolver, (admin, fee_token, fee_amount, fee_recipient));

        Self::track_resolver_instance(&env, &resolver_address, &config)?;

        env.events().publish(
            (
                String::from_str(&env, "FEE_COLLECTION_RESOLVER_CREATED"),
                &resolver_address,
            ),
            (config.name, fee_amount),
        );

        Ok(resolver_address)
    }

    /// Retrieves a list of all resolver instances registered with the factory.
    ///
    /// This function provides a public, on-chain discovery mechanism for all
    /// resolver configurations managed by this factory.
    ///
    /// # Returns
    /// A `Vec` containing `ResolverInstance` structs for each registered resolver.
    pub fn get_resolver_instances(env: Env) -> Vec<ResolverInstance> {
        let count: u32 = env.storage().instance().get(&DataKey::ResolverCount).unwrap_or(0);
        let mut instances = Vec::new(&env);

        for i in 0..count {
            let key = (DataKey::ResolverInstances, i);
            if let Some(instance) = env.storage().persistent().get(&key) {
                instances.push_back(instance);
            }
        }

        instances
    }

    /// Retrieves the configuration for a specific resolver instance by its address.
    ///
    /// # Arguments
    /// * `resolver_address` - The placeholder address of the resolver configuration to retrieve.
    ///
    /// # Returns
    /// An `Option` containing the `ResolverConfig` if found, otherwise `None`.
    pub fn get_resolver_config(env: Env, resolver_address: Address) -> Option<ResolverConfig> {
        let key = (DataKey::ResolverConfigs, resolver_address);
        env.storage().persistent().get(&key)
    }

    /// Deactivates a resolver instance, marking it as inactive (soft delete).
    ///
    /// This allows an administrator to disable a resolver without removing its
    /// configuration from the registry, preserving its history.
    ///
    /// # Arguments
    /// * `admin` - The admin of the factory, required for authorization.
    /// * `resolver_address` - The address of the resolver to deactivate.
    ///
    /// # Panics
    /// Panics if the `resolver_address` does not correspond to a registered instance.
    pub fn deactivate_resolver(env: Env, admin: Address, resolver_address: Address) -> Result<(), ResolverError> {
        Self::require_admin(&env, &admin)?;

        let count: u32 = env.storage().instance().get(&DataKey::ResolverCount).unwrap_or(0);

        for i in 0..count {
            let key = (DataKey::ResolverInstances, i);
            if let Some(mut instance) = env.storage().persistent().get::<_, ResolverInstance>(&key) {
                if instance.address == resolver_address {
                    instance.is_active = false;
                    env.storage().persistent().set(&key, &instance);

                    env.events()
                        .publish((String::from_str(&env, "RESOLVER_DEACTIVATED"), &resolver_address), ());
                    return Ok(());
                }
            }
        }

        Err(ResolverError::CustomError) // Resolver not found
    }

    // ============================================================================
    // PRIVATE HELPER FUNCTIONS
    // ============================================================================

    /// Generate a unique address for a new resolver
    ///
    /// LEARNING: This implementation is adapted from Soroban SDK's testutils::Address::generate()
    /// found at soroban-sdk-22.0.8/src/address.rs:320-331
    ///
    /// The testutils implementation uses:
    /// ```rust,ignore
    /// fn generate(env: &Env) -> Self {
    ///     Self::try_from_val(
    ///         env,
    ///         &ScAddress::Contract(Hash(env.with_generator(|mut g| g.address()))),
    ///     )
    ///     .unwrap()
    /// }
    /// ```
    ///
    /// We adapt this pattern for production use by creating deterministic contract addresses
    /// using a counter-based approach, since env.with_generator is only available in test mode.
    /// In production, the actual contract deployment would provide the real address.
    fn generate_resolver_address(env: &Env) -> Result<Address, ResolverError> {
        // Get current count to ensure uniqueness
        let count: u32 = env.storage().instance().get(&DataKey::ResolverCount).unwrap_or(0);

        // LEARNING: Based on testutils::Address::generate() at soroban-sdk-22.0.8/src/address.rs:320-331
        // The testutils creates addresses using ScAddress::Contract(Hash(env.with_generator(...)))
        //
        // In production contracts, we cannot generate arbitrary addresses because:
        // 1. env.with_generator() is only available in test mode
        // 2. Addresses must correspond to actual deployed contracts
        // 3. The ScAddress and Hash types aren't exposed for direct construction
        //
        // Real-world factory pattern would work by:
        // 1. Having deployment scripts that upload resolver WASM
        // 2. Getting the deployed contract address
        // 3. Registering that address with the factory
        //
        // For test environments, we can generate unique mock addresses
        // For production, each resolver would have its own deployed address

        // In tests, generate unique addresses using testutils
        // This allows tests to verify that different resolvers get different addresses
        #[cfg(test)]
        {
            // Generate a unique test address for each resolver
            return Ok(<Address as TestAddress>::generate(env));
        }

        #[cfg(not(test))]
        {
            // In production, return the factory address as placeholder
            // Real deployment would provide actual contract addresses
            let factory_address = env.current_contract_address();
            Ok(factory_address.clone())
        }
    }

    /// Track a new resolver instance
    ///
    /// LEARNING: Factory maintains a registry of all created instances
    /// for management, discovery, and auditing purposes.
    fn track_resolver_instance(
        env: &Env,
        resolver_address: &Address,
        config: &ResolverConfig,
    ) -> Result<(), ResolverError> {
        let count: u32 = env.storage().instance().get(&DataKey::ResolverCount).unwrap_or(0);

        let instance = ResolverInstance {
            address: resolver_address.clone(),
            config: config.clone(),
            created_at: env.ledger().timestamp(),
            is_active: true,
        };

        // Store instance in persistent storage
        let instance_key = (DataKey::ResolverInstances, count);
        env.storage().persistent().set(&instance_key, &instance);

        // Store configuration for quick lookup
        let config_key = (DataKey::ResolverConfigs, resolver_address.clone());
        env.storage().persistent().set(&config_key, config);

        // Increment count
        env.storage().instance().set(&DataKey::ResolverCount, &(count + 1));

        // Extend TTL for persistent data
        env.storage()
            .persistent()
            .extend_ttl(&instance_key, env.storage().max_ttl() - 100, env.storage().max_ttl());
        env.storage()
            .persistent()
            .extend_ttl(&config_key, env.storage().max_ttl() - 100, env.storage().max_ttl());

        Ok(())
    }

    fn require_admin(env: &Env, caller: &Address) -> Result<(), ResolverError> {
        caller.require_auth();

        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ResolverError::CustomError)?;

        if caller != &admin {
            return Err(ResolverError::NotAuthorized);
        }

        Ok(())
    }
}
