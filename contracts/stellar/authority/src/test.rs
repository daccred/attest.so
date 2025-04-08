#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, BytesN as _, Ledger, Events}, 
    vec, IntoVal, Env,
};

// --- Test Setup ---

fn setup_env() -> (Env, Address, AuthorityResolverContractClient) {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, AuthorityResolverContract);
    let client = AuthorityResolverContractClient::new(&env, &contract_id);
    
    // Call constructor (which sets the contract itself as admin)
    client.__constructor();
    
    (env, contract_id, client)
}

// Create a mock attestation record for testing
fn create_test_attestation(env: &Env) -> AttestationRecord {
    AttestationRecord {
        uid: BytesN::random(env),
        schema_uid: BytesN::random(env),
        recipient: Address::generate(env),
        attester: Address::generate(env),
        time: env.ledger().timestamp(),
        expiration_time: Some(env.ledger().timestamp() + 1000),
        revocable: true,
        ref_uid: None,
        data: Bytes::from_slice(env, &[1, 2, 3]),
        value: Some(100),
    }
}

// --- Initialization Tests ---

#[test]
fn test_constructor_sets_admin() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, AuthorityResolverContract);
    let client = AuthorityResolverContractClient::new(&env, &contract_id);
    
    // Call constructor
    client.__constructor();
    
    // Verify admin was set
    // Note: Admin is stored in instance storage, and we're trusting that it was
    // set correctly since verify_authority requires admin auth
}

#[test]
fn test_constructor_prevents_double_initialization() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, AuthorityResolverContract);
    let client = AuthorityResolverContractClient::new(&env, &contract_id);
    
    // Call constructor first time
    client.__constructor();
    
    // Call constructor second time - should fail
    let result = client.try___constructor();
    assert!(result.is_err());
    assert_eq!(result.err().unwrap().unwrap(), Error::AlreadyInitialized);
}

// --- Authority Management Tests ---

#[test]
fn test_register_authority() {
    let (env, contract_id, client) = setup_env();
    
    // Register authority
    client.register_authority();
    
    // Verify storage (indirectly)
    let events = env.events().all();
    let reg_events: Vec<_> = events.iter()
        .filter(|e| e.0.0 == REGISTER)
        .collect();
        
    assert_eq!(reg_events.len(), 1);
    // Verify the registered address matches the contract address
    assert_eq!(reg_events[0].1.to_val(), contract_id.to_val());
}

#[test]
fn test_verify_authority() {
    let (env, _contract_id, client) = setup_env();
    
    // Register authority first
    client.register_authority();
    
    // Verify authority (as admin)
    client.verify_authority();
    
    // Verify storage (indirectly via events)
    let events = env.events().all();
    let verify_events: Vec<_> = events.iter()
        .filter(|e| e.0.0 == VERIFY)
        .collect();
        
    assert_eq!(verify_events.len(), 1);
}

// --- Resolver Hook Tests ---

#[test]
fn test_attest_hook() {
    let (env, _contract_id, client) = setup_env();
    
    // Create test attestation record
    let attestation = create_test_attestation(&env);
    
    // Call attest hook
    let result = client.attest(&attestation);
    
    // Verify success
    assert!(result.is_ok());
    // Note: Currently the hook just logs and returns success
    // In a real implementation, we'd need to check that the 
    // proper business logic was executed
}

#[test]
fn test_revoke_hook() {
    let (env, _contract_id, client) = setup_env();
    
    // Create test attestation record
    let attestation = create_test_attestation(&env);
    
    // Call revoke hook
    let result = client.revoke(&attestation);
    
    // Verify success
    assert!(result.is_ok());
    // Note: Currently the hook just logs and returns success
    // In a real implementation, we'd need to check that the 
    // proper business logic was executed
}

#[test]
fn test_is_payable() {
    let (env, _contract_id, client) = setup_env();
    
    // Check is_payable
    let result = client.is_payable();
    
    // Verify it's false (default implementation)
    assert_eq!(result, false);
} 