// ══════════════════════════════════════════════════════════════════════════════
// ► Factory Pattern Test - Learning Implementation
// ►
// ► This test demonstrates how the factory pattern works in practice,
// ► showing the creation of multiple resolver instances with different
// ► configurations and how they can be managed centrally.
// The Factory Pattern in Soroban enables:

// 1. **Deterministic Deployment**: Uses env.register_at() for predictable addresses
// 2. **Centralized Management**: Tracks all instances with metadata and lifecycle
// 3. **Flexible Configuration**: Each instance customizable via Map storage
// 4. **Cost Efficiency**: Single factory vs multiple deployments
// 5. **Security**: Admin-controlled creation with individual resolver autonomy
// 6. **Easy Integration**: Predictable addresses and central discovery

// Applications: Multi-token rewards, varied fee structures, domain-specific
// resolvers, A/B testing, and feature rollouts.
// ══════════════════════════════════════════════════════════════════════════════

use resolvers::factory::{ResolverFactory, ResolverConfig, ResolverInstance};
use resolvers::factory::ResolverFactoryClient;
use resolvers::interface::{ResolverError, ResolverType};
use soroban_sdk::{
    testutils::{Address as _},
    Address, Env, String,
};

#[test]
fn test_factory_initialization() {
    let env = Env::default();
    env.mock_all_auths(); // Mock authentication for tests
    let factory_address = env.register(ResolverFactory, ());
    let factory = ResolverFactoryClient::new(&env, &factory_address);
    
    let admin = Address::generate(&env);
    
    // Initialize the factory
    factory.initialize(&admin);
    
    // Verify initialization
    let instances = factory.get_resolver_instances();
    assert_eq!(instances.len(), 0); // No instances created yet
}

#[test]
fn test_create_token_reward_resolver() {
    let env = Env::default();
    env.mock_all_auths(); // Mock authentication for tests
    let factory_address = env.register(ResolverFactory, ());
    let factory = ResolverFactoryClient::new(&env, &factory_address);
    
    let admin = Address::generate(&env);
    let reward_token = Address::generate(&env);
    
    // Initialize factory
    factory.initialize(&admin);
    
    // Create a token reward resolver
    let resolver_address = factory.create_token_reward_resolver(
        &admin,
        &reward_token,
        &1000, // reward amount
        &String::from_str(&env, "USDC Rewards"),
        &String::from_str(&env, "USDC reward pool for KYC attestations"),
    );
    
    // Verify resolver was created (Address is returned directly)
    // Get all instances
    let instances = factory.get_resolver_instances();
    assert_eq!(instances.len(), 1);
    
    // Verify instance details
    let instance = instances.get(0).unwrap();
    assert_eq!(instance.address, resolver_address);
    assert_eq!(instance.config.resolver_type, ResolverType::TokenReward);
    assert_eq!(instance.config.name, String::from_str(&env, "USDC Rewards"));
    assert!(instance.is_active);
}

#[test]
fn test_create_multiple_resolvers() {
    let env = Env::default();
    env.mock_all_auths(); // Mock authentication for tests
    let factory_address = env.register(ResolverFactory, ());
    let factory = ResolverFactoryClient::new(&env, &factory_address);
    
    let admin = Address::generate(&env);
    let usdc_token = Address::generate(&env);
    let xlm_token = Address::generate(&env);
    let fee_token = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    
    // Generate unique resolver addresses for testing
    let usdc_resolver_addr = Address::generate(&env);
    let xlm_resolver_addr = Address::generate(&env);
    let fee_resolver_addr = Address::generate(&env);
    
    // Initialize factory
    factory.initialize(&admin);
    
    // Create multiple resolvers with specific addresses
    let usdc_resolver = factory.create_token_reward_with_addr(
        &admin,
        &Some(usdc_resolver_addr.clone()),
        &usdc_token,
        &1000,
        &String::from_str(&env, "USDC Rewards"),
        &String::from_str(&env, "USDC reward pool"),
    );
    
    let xlm_resolver = factory.create_token_reward_with_addr(
        &admin,
        &Some(xlm_resolver_addr.clone()),
        &xlm_token,
        &500,
        &String::from_str(&env, "XLM Rewards"),
        &String::from_str(&env, "XLM reward pool"),
    );
    
    let fee_resolver = factory.create_fee_resolver_with_addr(
        &admin,
        &Some(fee_resolver_addr.clone()),
        &fee_token,
        &100,
        &fee_recipient,
        &String::from_str(&env, "XLM Fees"),
        &String::from_str(&env, "XLM fee collection"),
    );
    
    // Verify we got the addresses we requested
    assert_eq!(usdc_resolver, usdc_resolver_addr);
    assert_eq!(xlm_resolver, xlm_resolver_addr);
    assert_eq!(fee_resolver, fee_resolver_addr);
    
    // Verify they have different addresses
    assert_ne!(usdc_resolver, xlm_resolver);
    assert_ne!(xlm_resolver, fee_resolver);
    assert_ne!(usdc_resolver, fee_resolver);
    
    // Get all instances
    let instances = factory.get_resolver_instances();
    assert_eq!(instances.len(), 3);
    
    // Verify each instance has correct configuration
    for i in 0..instances.len() {
        let instance = instances.get(i).unwrap();
        match instance.config.resolver_type {
            ResolverType::TokenReward => {
                assert!(instance.config.name.to_string().contains("Rewards"));
            }
            ResolverType::FeeCollection => {
                assert!(instance.config.name.to_string().contains("Fees"));
            }
            _ => panic!("Unexpected resolver type"),
        }
    }
}

#[test]
fn test_resolver_config_retrieval() {
    let env = Env::default();
    env.mock_all_auths(); // Mock authentication for tests
    let factory_address = env.register(ResolverFactory, ());
    let factory = ResolverFactoryClient::new(&env, &factory_address);
    
    let admin = Address::generate(&env);
    let reward_token = Address::generate(&env);
    
    // Initialize factory
    factory.initialize(&admin);
    
    // Create a resolver
    let resolver_address = factory.create_token_reward_resolver(
        &admin,
        &reward_token,
        &1000,
        &String::from_str(&env, "Test Rewards"),
        &String::from_str(&env, "Test description"),
    );
    
    // Retrieve configuration
    let config = factory.get_resolver_config(&resolver_address);
    assert!(config.is_some());
    
    let config = config.unwrap();
    assert_eq!(config.resolver_type, ResolverType::TokenReward);
    assert_eq!(config.name, String::from_str(&env, "Test Rewards"));
    assert_eq!(config.admin, admin);
    
    // Verify config data contains reward information
    let reward_token_str = config.config_data.get(String::from_str(&env, "reward_token"));
    assert!(reward_token_str.is_some());
    assert_eq!(reward_token_str.unwrap(), reward_token.to_string());
}

#[test]
fn test_deactivate_resolver() {
    let env = Env::default();
    env.mock_all_auths(); // Mock authentication for tests
    let factory_address = env.register(ResolverFactory, ());
    let factory = ResolverFactoryClient::new(&env, &factory_address);
    
    let admin = Address::generate(&env);
    let reward_token = Address::generate(&env);
    
    // Initialize factory
    factory.initialize(&admin);
    
    // Create a resolver
    let resolver_address = factory.create_token_reward_resolver(
        &admin,
        &reward_token,
        &1000,
        &String::from_str(&env, "Test Rewards"),
        &String::from_str(&env, "Test description"),
    );
    
    // Verify it's active
    let instances = factory.get_resolver_instances();
    assert_eq!(instances.len(), 1);
    assert!(instances.get(0).unwrap().is_active);
    
    // Deactivate the resolver
    factory.deactivate_resolver(&admin, &resolver_address);
    
    // Verify it's now inactive
    let instances = factory.get_resolver_instances();
    assert_eq!(instances.len(), 1);
    assert!(!instances.get(0).unwrap().is_active);
}

#[test]
fn test_unauthorized_access() {
    let env = Env::default();
    env.mock_all_auths(); // Mock authentication for tests
    let factory_address = env.register(ResolverFactory, ());
    let factory = ResolverFactoryClient::new(&env, &factory_address);
    
    let admin = Address::generate(&env);
    let unauthorized_user = Address::generate(&env);
    let reward_token = Address::generate(&env);
    
    // Initialize factory
    factory.initialize(&admin);
    
    // Try to create resolver with unauthorized user
    // This should fail with an authorization error
    let result = factory.try_create_token_reward_resolver(
        &unauthorized_user,
        &reward_token,
        &1000,
        &String::from_str(&env, "Test Rewards"),
        &String::from_str(&env, "Test description"),
    );
    
    // Verify the operation failed (unauthorized)
    assert!(result.is_err());
}
 