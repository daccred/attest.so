#![cfg(test)]
use soroban_sdk::{
    testutils::{Address as _, BytesN as _},
    Address, Env, String as SorobanString, BytesN,
    Bytes, IntoVal,
};
use crate::{AuthorityResolverContract, AuthorityResolverContractClient, Error, AttestationRecord};

// ══════════════════════════════════════════════════════════════════════════════
// ► Sets up a test environment with mocked authorizations, registers the contract,
// ► initializes it with a generated admin, and returns the environment, contract ID, 
// ► admin address, and a client for the contract.
// ══════════════════════════════════════════════════════════════════════════════
fn setup_env<'a>() -> (Env, Address, Address, AuthorityResolverContractClient<'a>) {
    let env = Env::default();
    
    // Mock all authorizations for simplicity in most tests focusing on logic, 
    // not granular auth checks (except test_unauthorized_operations).
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    // Use env.register with the contract type and an empty tuple for constructor args
    let contract_id = env.register(AuthorityResolverContract, ());
    
    let client = AuthorityResolverContractClient::new(&env, &contract_id);
    
    // Initialize the contract immediately after registration for convenience.
    client.initialize(&admin);
    
    (env, contract_id, admin, client)
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Helper function to create a basic AttestationRecord with dummy data for testing hooks.
// ══════════════════════════════════════════════════════════════════════════════
fn create_dummy_attestation(env: &Env, attester: &Address, schema_uid: &BytesN<32>) -> AttestationRecord {
    // Create a dummy attestation with the following properties:
    // - Dummy UID (content not relevant for auth check)
    // - Schema UID as provided
    // - Random recipient address
    // - Attester address (the one whose authority will be checked)
    // - Current ledger time
    // - No expiration time
    // - Marked as revocable
    // - No reference UID
    // - Empty data
    // - No value
    
    AttestationRecord {
        uid: BytesN::from_array(env, &[0; 32]),
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

// ══════════════════════════════════════════════════════════════════════════════
// ► Tests that the contract cannot be initialized more than once.
// ══════════════════════════════════════════════════════════════════════════════
#[test]
fn test_initialize() {
    // setup_env initializes the contract once.
    let (_env, _contract_id, admin, client) = setup_env(); 
    
    // Attempt to initialize a second time.
    let reinit_result = client.try_initialize(&admin); 

    // Assert that the second attempt fails with the AlreadyInitialized error.
    assert!(matches!(reinit_result.err().unwrap().unwrap(), Error::AlreadyInitialized)); 
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Tests that the admin can successfully register a new authority.
// ══════════════════════════════════════════════════════════════════════════════
#[test]
fn test_admin_register_authority() {
    // Setup initialized contract and get admin/client.
    let (env, _contract_id, admin, client) = setup_env();

    // Generate a new address for the authority to be registered.
    let authority = Address::generate(&env);
    
    // Create metadata for the authority
    let metadata = SorobanString::from_str(&env, "Test Authority Metadata");

    // Call the admin function to register the authority.
    client.admin_register_authority(&admin, &authority, &metadata);

    // Verify that the address is now recognized as an authority.
    assert!(client.is_authority(&authority));
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Tests that the admin can successfully set a levy for a specific schema.
// ══════════════════════════════════════════════════════════════════════════════
#[test]
fn test_admin_set_schema_levy() {
    // Setup initialized contract.
    let (env, _contract_id, admin, client) = setup_env();

    // Create test data
    let schema_uid = BytesN::random(&env);
    let levy_amount: i128 = 100;
    
    // The authority that will receive the levy payments.
    let authority_for_levy = Address::generate(&env);

    // Pre-requisite: The receiving authority must be registered first.
    client.admin_register_authority(&admin, &authority_for_levy, &SorobanString::from_str(&env, "Levy Authority"));
    
    // Verify the authority was registered
    assert!(client.is_authority(&authority_for_levy));

    // Set the levy for the schema UID.
    client.admin_set_schema_levy(&admin, &schema_uid, &levy_amount, &authority_for_levy);

    // Verify that the levy information is stored correctly.
    let levy_info_option = client.get_schema_levy(&schema_uid);
    
    // Check that levy info exists
    assert!(levy_info_option.is_some());
    
    let levy_info = levy_info_option.unwrap();
    
    // Check amount matches what we set
    assert_eq!(levy_info.levy_amount, levy_amount);
    
    // Check receiving authority matches what we set
    assert_eq!(levy_info.authority_for_levy, authority_for_levy);
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Tests the `attest` hook logic: 
// ► - Succeeds for a registered authority with no levy.
// ► - Succeeds for a registered authority with a levy (doesn't check payment).
// ► - Fails for an unregistered authority.
// ══════════════════════════════════════════════════════════════════════════════
#[test]
fn test_attest_hook() {
    // Setup initialized contract.
    let (env, _contract_id, admin, client) = setup_env();

    // Create test actors and data
    let authority = Address::generate(&env);
    let non_authority = Address::generate(&env);
    let schema_uid_no_levy: BytesN<32> = BytesN::from_array(&env, &[1; 32]);
    let schema_uid_with_levy: BytesN<32> = BytesN::from_array(&env, &[2; 32]);
    let levy_amount = 5_000_000;

    // Register the authority.
    client.admin_register_authority(&admin, &authority, &SorobanString::from_str(&env, "Attester"));
    
    // Set a levy for one of the schemas.
    client.admin_set_schema_levy(&admin, &schema_uid_with_levy, &levy_amount, &authority);

    // ────────────────────────────────────────────────────────────────
    // Case 1: Attestation by registered authority, schema has no levy.
    // ────────────────────────────────────────────────────────────────
    let attestation1 = create_dummy_attestation(&env, &authority, &schema_uid_no_levy);
    let result1 = client.try_attest(&attestation1);
    
    // Should succeed
    assert_eq!(result1, Ok(Ok(true)));

    // ─────────────────────────────────────────────────────────────────
    // Case 2: Attestation by registered authority, schema has a levy.
    // ─────────────────────────────────────────────────────────────────
    let attestation2 = create_dummy_attestation(&env, &authority, &schema_uid_with_levy);
    let result2 = client.try_attest(&attestation2);
    
    // Should succeed (hook only checks authority)
    assert_eq!(result2, Ok(Ok(true)));

    // ────────────────────────────────────────
    // Case 3: Attestation by non-authority.
    // ────────────────────────────────────────
    let attestation3 = create_dummy_attestation(&env, &non_authority, &schema_uid_no_levy);
    let result3 = client.try_attest(&attestation3);
    
    // Should fail
    assert!(matches!(result3.err().unwrap().unwrap(), Error::AttesterNotAuthority));
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Tests the `revoke` hook logic:
// ► - Succeeds when the attester in the record is a registered authority.
// ► - Fails when the attester in the record is not a registered authority.
// ══════════════════════════════════════════════════════════════════════════════
#[test]
fn test_revoke_hook() {
    // Setup initialized contract.
    let (env, _contract_id, admin, client) = setup_env();

    // Create test actors and data
    let authority = Address::generate(&env);
    let non_authority = Address::generate(&env);
    let schema_uid: BytesN<32> = BytesN::from_array(&env, &[1; 32]);

    // Register the authority.
    client.admin_register_authority(&admin, &authority, &SorobanString::from_str(&env, "Revoker"));

    // ──────────────────────────────────────────────────────────────────────────
    // Case 1: Revocation where the attester in the record IS a registered authority.
    // ──────────────────────────────────────────────────────────────────────────
    let attestation1 = create_dummy_attestation(&env, &authority, &schema_uid);
    let result1 = client.try_revoke(&attestation1);
    
    // Should succeed
    assert_eq!(result1, Ok(Ok(true)));

    // ────────────────────────────────────────────────────────────────────────────
    // Case 2: Revocation where the attester in the record is NOT a registered authority.
    // ────────────────────────────────────────────────────────────────────────────
    let attestation2 = create_dummy_attestation(&env, &non_authority, &schema_uid);
    let result2 = client.try_revoke(&attestation2);
    
    // Should fail
    assert!(matches!(result2.err().unwrap().unwrap(), Error::AttesterNotAuthority));
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Tests the full lifecycle of managing a schema levy:
// ► Setting, updating the amount, changing the receiving authority, and removing it.
// ══════════════════════════════════════════════════════════════════════════════
#[test]
fn test_schema_levy_management() {
    // Setup initialized contract.
    let (env, _contract_id, admin, client) = setup_env();
    
    // Create test data
    let schema_uid = BytesN::random(&env);
    let authority1 = Address::generate(&env);
    let authority2 = Address::generate(&env);
    
    // Register both potential receiving authorities.
    client.admin_register_authority(&admin, &authority1, &SorobanString::from_str(&env, "Auth1"));
    client.admin_register_authority(&admin, &authority2, &SorobanString::from_str(&env, "Auth2"));
    
    // ──────────────────────────────────────────────
    // 1. Set initial levy with authority1 as recipient.
    // ──────────────────────────────────────────────
    client.admin_set_schema_levy(&admin, &schema_uid, &100, &authority1);
    let levy_info = client.get_schema_levy(&schema_uid).unwrap();
    assert_eq!(levy_info.levy_amount, 100);
    assert_eq!(levy_info.authority_for_levy, authority1);
    
    // ────────────────────────────────────────────────────
    // 2. Update levy amount, keeping authority1 as recipient.
    // ────────────────────────────────────────────────────
    client.admin_set_schema_levy(&admin, &schema_uid, &200, &authority1);
    let levy_info = client.get_schema_levy(&schema_uid).unwrap();
    assert_eq!(levy_info.levy_amount, 200);
    
    // ───────────────────────────────────────────────────────
    // 3. Change the receiving authority to authority2 and update amount.
    // ───────────────────────────────────────────────────────
    client.admin_set_schema_levy(&admin, &schema_uid, &300, &authority2);
    let levy_info = client.get_schema_levy(&schema_uid).unwrap();
    assert_eq!(levy_info.levy_amount, 300);
    assert_eq!(levy_info.authority_for_levy, authority2);
    
    // ────────────────────────────────────
    // 4. Remove the levy by setting the amount to 0.
    // ────────────────────────────────────
    client.admin_set_schema_levy(&admin, &schema_uid, &0, &authority2);
    
    // Verify levy info is gone
    assert!(client.get_schema_levy(&schema_uid).is_none());
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Tests that the attest hook allows attestations from the same authority 
// ► using different schema UIDs.
// ══════════════════════════════════════════════════════════════════════════════
#[test]
fn test_multiple_attestations_same_subject() {
    // Setup initialized contract.
    let (env, _contract_id, admin, client) = setup_env();
    
    // Create test actors and data
    let authority = Address::generate(&env);
    let schema_uid1 = BytesN::from_array(&env, &[1; 32]);
    let schema_uid2 = BytesN::from_array(&env, &[2; 32]);
    
    // Register the single authority.
    client.admin_register_authority(&admin, &authority, &SorobanString::from_str(&env, "Auth"));
    
    // Create two attestations using different schemas but the same attester.
    let attestation1 = create_dummy_attestation(&env, &authority, &schema_uid1);
    let attestation2 = create_dummy_attestation(&env, &authority, &schema_uid2);
    
    // Verify both attest calls succeed via the hook.
    assert_eq!(client.try_attest(&attestation1), Ok(Ok(true)));
    assert_eq!(client.try_attest(&attestation2), Ok(Ok(true)));
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Tests that the attest hook succeeds when an attestation record includes a `ref_uid`.
// ══════════════════════════════════════════════════════════════════════════════
#[test]
fn test_attestation_with_reference() {
    // Setup initialized contract.
    let (env, _contract_id, admin, client) = setup_env();
    
    // Create test actors and data
    let authority = Address::generate(&env);
    let schema_uid = BytesN::from_array(&env, &[1; 32]);
    
    // A dummy reference UID
    let ref_uid = BytesN::from_array(&env, &[9; 32]);
    
    // Register the authority.
    client.admin_register_authority(&admin, &authority, &SorobanString::from_str(&env, "Auth"));
    
    // Create an attestation and set its ref_uid field.
    let mut attestation = create_dummy_attestation(&env, &authority, &schema_uid);
    
    // Convert BytesN<32> to Option<Bytes>
    attestation.ref_uid = Some(ref_uid.clone().into());
    
    // Verify the attest call succeeds.
    assert_eq!(client.try_attest(&attestation), Ok(Ok(true)));
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Tests edge cases for levy amounts and metadata length.
// ══════════════════════════════════════════════════════════════════════════════
#[test]
fn test_edge_cases() {
    // Setup initialized contract.
    let (env, _contract_id, admin, client) = setup_env();
    
    // Create test actors and data
    let authority = Address::generate(&env);
    let schema_uid = BytesN::random(&env);
    
    // Register the authority needed for setting the levy.
    client.admin_register_authority(&admin, &authority, &SorobanString::from_str(&env, "Auth"));
    
    // ──────────────────────────────────────────────
    // Test 1: Set levy to the maximum possible i128 value.
    // ──────────────────────────────────────────────
    let max_levy = i128::MAX;
    client.admin_set_schema_levy(&admin, &schema_uid, &max_levy, &authority);
    let levy_info = client.get_schema_levy(&schema_uid).unwrap();
    assert_eq!(levy_info.levy_amount, max_levy);
    
    // ──────────────────────────────────────────────────────────────
    // Test 2: Register an authority with relatively long metadata.
    // (Soroban imposes limits, but test with a reasonably long string)
    // ──────────────────────────────────────────────────────────────
    let long_metadata = SorobanString::from_str(&env, &"a".repeat(100)); 
    let auth2 = Address::generate(&env);
    client.admin_register_authority(&admin, &auth2, &long_metadata);
    
    // Verify registration succeeded
    assert!(client.is_authority(&auth2));
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Tests that admin-gated functions fail correctly when called:
// ► 1. Before the contract is initialized.
// ► 2. By a non-admin address after initialization.
// ══════════════════════════════════════════════════════════════════════════════
#[test]
fn test_unauthorized_operations() {
    // Create a single environment but DON'T mock all auths initially.
    let env = Env::default();
    
    // Generate identities needed for the tests.
    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let authority_to_register = Address::generate(&env);
    let schema_uid = BytesN::random(&env);
    let levy_amount: i128 = 100;
    let metadata = SorobanString::from_str(&env, "Test Metadata");

    // Register the contract using env.register.
    let contract_id = env.register(AuthorityResolverContract, ());
    let client = AuthorityResolverContractClient::new(&env, &contract_id);

    // ══════════════════════════════════════════════════
    // Test Admin Calls BEFORE Initialization
    // ══════════════════════════════════════════════════
    
    // Attempt to register authority before init. Should fail.
    let result_reg_before_init = client.try_admin_register_authority(
        // Using admin address, but should fail as init hasn't happened.
        &admin,
        &authority_to_register, 
        &metadata
    );
    
    // Expect NotInitialized or Auth error
    assert!(result_reg_before_init.is_err());

    // Attempt to set levy before init. Should fail.
    let result_levy_before_init = client.try_admin_set_schema_levy(
        &admin,
        &schema_uid,
        &levy_amount,
        &authority_to_register
    );
    
    // Expect NotInitialized or Auth error
    assert!(result_levy_before_init.is_err());

    // ══════════════════════════════════════════════════
    // Initialize
    // ══════════════════════════════════════════════════
    
    // Mock ONLY the authorization needed for the initialize call.
    env.mock_auths(&[
        soroban_sdk::testutils::MockAuth {
            address: &admin,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &contract_id,
                fn_name: "initialize",
                // Args for initialize is just the admin address
                args: (&admin,).into_val(&env),
                sub_invokes: &[],
            },
        }
    ]);
    
    // Perform the initialization.
    client.initialize(&admin);

    // ══════════════════════════════════════════════════
    // Test Unauthorized Calls AFTER Initialization
    // ══════════════════════════════════════════════════
    
    // Attempt to register an authority AS non_admin. Should fail auth check.
    let result_reg_after_init = client.try_admin_register_authority(
        // Calling address is non_admin
        &non_admin,
        &authority_to_register, 
        &metadata
    );
    
    // Expect NotAuthorized error
    assert!(result_reg_after_init.is_err());

    // Attempt to set a levy AS non_admin. Should fail auth check.
    let result_levy_after_init = client.try_admin_set_schema_levy(
        // Calling address is non_admin
        &non_admin,
        &schema_uid,
        &levy_amount,
        &authority_to_register
    );
    
    // Expect NotAuthorized error
    assert!(result_levy_after_init.is_err());
} 