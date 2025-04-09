#![cfg(test)]
use soroban_sdk::{
    testutils::{Address as _, BytesN as _},
    Address, Env, String as SorobanString, BytesN,
    Bytes, IntoVal,
};
use crate::{AuthorityResolverContract, AuthorityResolverContractClient, Error, AttestationRecord};

fn setup_env<'a>() -> (Env, Address, Address, AuthorityResolverContractClient<'a>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AuthorityResolverContract, ());
    let client = AuthorityResolverContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, contract_id, admin, client)
}

fn create_dummy_attestation(env: &Env, attester: &Address, schema_uid: &BytesN<32>) -> AttestationRecord {
    AttestationRecord {
        uid: BytesN::from_array(env, &[0; 32]), // Dummy UID
        schema_uid: schema_uid.clone(),
        recipient: Address::generate(env),
        attester: attester.clone(),
        time: env.ledger().timestamp(),
        expiration_time: None,
        revocable: true,
        ref_uid: None,
        data: Bytes::new(env),
        value: None,
    }
}

#[test]
fn test_initialize() {
    let (_env, _contract_id, admin, client) = setup_env();
    let reinit_result = client.try_initialize(&admin);
    assert!(matches!(reinit_result.err().unwrap().unwrap(), Error::AlreadyInitialized));
}

#[test]
fn test_admin_register_authority() {
    let (env, _contract_id, admin, client) = setup_env();

    let authority = Address::generate(&env);
    let metadata = SorobanString::from_str(&env, "Test Authority Metadata");

    client.admin_register_authority(&admin, &authority, &metadata);

    assert!(client.is_authority(&authority));
}

#[test]
fn test_admin_set_schema_levy() {
    let (env, _contract_id, admin, client) = setup_env();

    let schema_uid = BytesN::random(&env);
    let levy_amount: i128 = 100;
    let authority_for_levy = Address::generate(&env);

    client.admin_register_authority(&admin, &authority_for_levy, &SorobanString::from_str(&env, "Levy Authority"));
    assert!(client.is_authority(&authority_for_levy));

    client.admin_set_schema_levy(&admin, &schema_uid, &levy_amount, &authority_for_levy);

    let levy_info_option = client.get_schema_levy(&schema_uid);
    assert!(levy_info_option.is_some());
    let levy_info = levy_info_option.unwrap();
    assert_eq!(levy_info.levy_amount, levy_amount);
    assert_eq!(levy_info.authority_for_levy, authority_for_levy);
}

#[test]
fn test_attest_hook() {
    let (env, _contract_id, admin, client) = setup_env();

    let authority = Address::generate(&env);
    let non_authority = Address::generate(&env);
    let schema_uid_no_levy: BytesN<32> = BytesN::from_array(&env, &[1; 32]);
    let schema_uid_with_levy: BytesN<32> = BytesN::from_array(&env, &[2; 32]);
    let levy_amount = 5_000_000;

    client.admin_register_authority(&admin, &authority, &SorobanString::from_str(&env, "Attester"));
    client.admin_set_schema_levy(&admin, &schema_uid_with_levy, &levy_amount, &authority);

    let attestation1 = create_dummy_attestation(&env, &authority, &schema_uid_no_levy);
    let result1 = client.try_attest(&attestation1);
    assert_eq!(result1, Ok(Ok(true)));

    let attestation2 = create_dummy_attestation(&env, &authority, &schema_uid_with_levy);
    let result2 = client.try_attest(&attestation2);
    assert_eq!(result2, Ok(Ok(true)));

    let attestation3 = create_dummy_attestation(&env, &non_authority, &schema_uid_no_levy);
    let result3 = client.try_attest(&attestation3);
    assert!(matches!(result3.err().unwrap().unwrap(), Error::AttesterNotAuthority));
}

#[test]
fn test_revoke_hook() {
    let (env, _contract_id, admin, client) = setup_env();

    let authority = Address::generate(&env);
    let non_authority = Address::generate(&env);
    let schema_uid: BytesN<32> = BytesN::from_array(&env, &[1; 32]);

    client.admin_register_authority(&admin, &authority, &SorobanString::from_str(&env, "Revoker"));

    let attestation1 = create_dummy_attestation(&env, &authority, &schema_uid);
    let result1 = client.try_revoke(&attestation1);
    assert_eq!(result1, Ok(Ok(true)));

    let attestation2 = create_dummy_attestation(&env, &non_authority, &schema_uid);
    let result2 = client.try_revoke(&attestation2);
    assert!(matches!(result2.err().unwrap().unwrap(), Error::AttesterNotAuthority));
}

// Additional test for schema levy management (updating, overwriting, removing)
#[test]
fn test_schema_levy_management() {
    let (env, _contract_id, admin, client) = setup_env();
    let schema_uid = BytesN::random(&env);
    let authority1 = Address::generate(&env);
    let authority2 = Address::generate(&env);
    
    // Register authorities
    client.admin_register_authority(&admin, &authority1, &SorobanString::from_str(&env, "Auth1"));
    client.admin_register_authority(&admin, &authority2, &SorobanString::from_str(&env, "Auth2"));
    
    // Set initial levy
    client.admin_set_schema_levy(&admin, &schema_uid, &100, &authority1);
    let levy_info = client.get_schema_levy(&schema_uid).unwrap();
    assert_eq!(levy_info.levy_amount, 100);
    assert_eq!(levy_info.authority_for_levy, authority1);
    
    // Update levy amount
    client.admin_set_schema_levy(&admin, &schema_uid, &200, &authority1);
    let levy_info = client.get_schema_levy(&schema_uid).unwrap();
    assert_eq!(levy_info.levy_amount, 200);
    
    // Change levy authority
    client.admin_set_schema_levy(&admin, &schema_uid, &300, &authority2);
    let levy_info = client.get_schema_levy(&schema_uid).unwrap();
    assert_eq!(levy_info.levy_amount, 300);
    assert_eq!(levy_info.authority_for_levy, authority2);
    
    // Remove levy by setting amount to 0
    client.admin_set_schema_levy(&admin, &schema_uid, &0, &authority2);
    assert!(client.get_schema_levy(&schema_uid).is_none());
}

// Test for multiple attestations with different schemas
#[test]
fn test_multiple_attestations_same_subject() {
    let (env, _contract_id, admin, client) = setup_env();
    let authority = Address::generate(&env);
    let schema_uid1 = BytesN::from_array(&env, &[1; 32]);
    let schema_uid2 = BytesN::from_array(&env, &[2; 32]);
    
    // Register authority
    client.admin_register_authority(&admin, &authority, &SorobanString::from_str(&env, "Auth"));
    
    // Create attestations with different schemas
    let attestation1 = create_dummy_attestation(&env, &authority, &schema_uid1);
    let attestation2 = create_dummy_attestation(&env, &authority, &schema_uid2);
    
    // Both should succeed
    assert_eq!(client.try_attest(&attestation1), Ok(Ok(true)));
    assert_eq!(client.try_attest(&attestation2), Ok(Ok(true)));
}

// Test for attestation with reference
#[test]
fn test_attestation_with_reference() {
    let (env, _contract_id, admin, client) = setup_env();
    let authority = Address::generate(&env);
    let schema_uid = BytesN::from_array(&env, &[1; 32]);
    let ref_uid = BytesN::from_array(&env, &[9; 32]);
    
    // Register authority
    client.admin_register_authority(&admin, &authority, &SorobanString::from_str(&env, "Auth"));
    
    // Create attestation with reference
    let mut attestation = create_dummy_attestation(&env, &authority, &schema_uid);
    attestation.ref_uid = Some(ref_uid.clone().into());
    
    // Should succeed
    assert_eq!(client.try_attest(&attestation), Ok(Ok(true)));
}

// Test edge cases
#[test]
fn test_edge_cases() {
    let (env, _contract_id, admin, client) = setup_env();
    let authority = Address::generate(&env);
    let schema_uid = BytesN::random(&env);
    
    // Register authority
    client.admin_register_authority(&admin, &authority, &SorobanString::from_str(&env, "Auth"));
    
    // Test extremely large levy amount
    let max_levy = i128::MAX;
    client.admin_set_schema_levy(&admin, &schema_uid, &max_levy, &authority);
    let levy_info = client.get_schema_levy(&schema_uid).unwrap();
    assert_eq!(levy_info.levy_amount, max_levy);
    
    // Test with very long metadata
    let long_metadata = SorobanString::from_str(&env, &"a".repeat(100)); // Using 100 chars to avoid potential limits
    let auth2 = Address::generate(&env);
    client.admin_register_authority(&admin, &auth2, &long_metadata);
    assert!(client.is_authority(&auth2));
}

// Test for handling unauthorized operations
#[test]
fn test_unauthorized_operations() {
    // Create a single environment but don't mock all auths initially
    let env = Env::default();
    
    // Generate identities
    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let authority_to_register = Address::generate(&env);
    let schema_uid = BytesN::random(&env);
    let levy_amount: i128 = 100;
    let metadata = SorobanString::from_str(&env, "Test Metadata");

    // Register the contract using env.register with Contract Type and empty tuple
    let contract_id = env.register(AuthorityResolverContract, ());
    let client = AuthorityResolverContractClient::new(&env, &contract_id);

    // --- Test Admin Calls BEFORE Initialization --- 
    // Attempt to register authority before init
    let result_reg_before_init = client.try_admin_register_authority(
        &admin, // Even the admin can't call before init
        &authority_to_register, 
        &metadata
    );
    assert!(result_reg_before_init.is_err()); // Expect NotInitialized or similar error

    // Attempt to set levy before init
    let result_levy_before_init = client.try_admin_set_schema_levy(
        &admin,
        &schema_uid,
        &levy_amount,
        &authority_to_register
    );
    assert!(result_levy_before_init.is_err()); // Expect NotInitialized or similar error

    // --- Initialize --- 
    // Mock ONLY the initialization call for the admin
    env.mock_auths(&[
        soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract_id,
                fn_name: "initialize",
                args: (&admin,).into_val(&env), 
                sub_invokes: &[],
            },
        }
    ]);
    client.initialize(&admin);

    // --- Test Unauthorized Calls AFTER Initialization --- 
    // Attempt to register an authority as non_admin. 
    let result_reg_after_init = client.try_admin_register_authority(
        &non_admin, 
        &authority_to_register, 
        &metadata
    );
    assert!(result_reg_after_init.is_err()); // Expect Auth Error

    // Attempt to set a levy as non_admin.
    let result_levy_after_init = client.try_admin_set_schema_levy(
        &non_admin,
        &schema_uid,
        &levy_amount,
        &authority_to_register
    );
    assert!(result_levy_after_init.is_err()); // Expect Auth Error
} 