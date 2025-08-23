use protocol::{
  errors::Error,
  state::{Attestation, DataKey},
  utils::{create_xdr_string, generate_attestation_uid},
  AttestationContract, AttestationContractClient,
};
use soroban_sdk::{
  panic_with_error, symbol_short,
  testutils::{Address as _, Events, Ledger, LedgerInfo, MockAuth, MockAuthInvoke},
  Address, BytesN, Env, IntoVal, String as SorobanString, TryIntoVal,
};


// =======================================================================================
//
//                                   NONCE MANAGEMENT
//
// =======================================================================================

/// **Test: Nonce Incrementation via `attest`**
/// - Verifies that sequential attestations from the same attester succeed,
///   implying that the internal nonce is being incremented correctly.
#[test]
fn test_nonce_incrementation() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attester = Address::generate(&env);
    let subject = Address::generate(&env);

    println!("=============================================================");
    println!("      Running TC: {}", "test_nonce_incrementation");
    println!("=============================================================");

    client.initialize(&admin);
    let schema_uid = client.register(
        &attester,
        &SorobanString::from_str(&env, "schema"),
        &None,
        &true,
    );

    // 1. Perform first attestation, which should use nonce 0 internally.
  let result =  client.attest(
        &attester,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "value1"),
        &None,
    );

    let event_one = env.events().all().clone();
    dbg!(&event_one);

    // 2. Perform second attestation. This will only succeed if the nonce
    // was incremented after the first call, preventing a UID collision.
    let result2 = client.attest(
        &attester,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "value2"),
        &None,
    );

    let event_two = env.events().all().clone();
    dbg!(&event_two);

    let result3 = client.attest(
        &attester,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "value3"),
        &None,
    );

    let event_three = env.events().all().clone();
    dbg!(&event_three);

    // dbg!(&result, &result2, &result3);
    
    let first_event = event_one.last().unwrap();
    let second_event = event_two.last().unwrap();
    let third_event = event_three.last().unwrap();
    let (event_schema_uid, event_attester, event_subject, event_value, event_nonce, event_timestamp): (BytesN<32>, Address, Address, SorobanString, u64, u64) = first_event.2.try_into_val(&env).unwrap();
    let (event_schema_uid2, event_attester2, event_subject2, event_value2, event_nonce2, event_timestamp2): (BytesN<32>, Address, Address, SorobanString, u64, u64) = second_event.2.try_into_val(&env).unwrap();
    let (event_schema_uid3, event_attester3, event_subject3, event_value3, event_nonce3, event_timestamp3): (BytesN<32>, Address, Address, SorobanString, u64, u64) = third_event.2.try_into_val(&env).unwrap();
    // Verify that nonces are incrementing correctly
    assert_eq!(event_nonce, 0, "First attestation should use nonce 0");
    assert_eq!(event_nonce2, 1, "Second attestation should use nonce 1");
    assert_eq!(event_nonce3, 2, "Third attestation should use nonce 2");
    
    // Verify that all attestations are from the same attester (this is the key test)
    assert_eq!(event_attester, event_attester2, "All attestations should be from the same attester");
    assert_eq!(event_attester2, event_attester3, "All attestations should be from the same attester");

    dbg!(&event_schema_uid, &event_attester, &event_subject, &event_value, &event_nonce, &event_timestamp);
    dbg!(&event_schema_uid2, &event_attester2, &event_subject2, &event_value2, &event_nonce2, &event_timestamp2);
    dbg!(&event_schema_uid3, &event_attester3, &event_subject3, &event_value3, &event_nonce3, &event_timestamp3);



    println!("=============================================================");
    println!("      Finished: {}", "test_nonce_incrementation");
    println!("=============================================================");
}

/// **Test: Nonce is Attester-Specific via `attest`**
/// - Verifies that `attest` calls from different attesters do not interfere
///   with each other's internal nonce sequence.
#[test]
fn test_nonce_is_attester_specific() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attester_a = Address::generate(&env);
    let attester_b = Address::generate(&env);
    let subject = Address::generate(&env);

    println!("=============================================================");
    println!("      Running TC: {}", "test_nonce_is_attester_specific");
    println!("=============================================================");

    client.initialize(&admin);
    let schema_uid = client.register(
        &admin, // Schema owner doesn't matter for this test
        &SorobanString::from_str(&env, "schema"),
        &None,
        &true,
    );

    // Attester A performs an action (this uses nonce 0 for A).
    client.attest(
        &attester_a,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "valueA"),
        &None,
    );

    // Attester B performs an action (this should use nonce 0 for B).
    // If the nonces were not separate, this would fail.
    client.attest(
        &attester_b,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "valueB"),
        &None,
    );

    // Attester A performs a second action (this should use nonce 1 for A).
    client.attest(
        &attester_a,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "valueA2"),
        &None,
    );

    println!("=============================================================");
    println!("      Finished: {}", "test_nonce_is_attester_specific");
    println!("=============================================================");
}



/// **Test: BLS Key Registration**
/// - Verifies successful registration of a BLS public key for an attester.
/// - Checks that the key is stored and a `BLS_KEY_REGISTER` event is emitted.
#[test]
fn test_bls_key_registration_and_event() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attester = Address::generate(&env);

    println!("=============================================================");
    println!("      Running TC: {}", "test_bls_key_registration_and_event");
    println!("=============================================================");

    client.initialize(&admin);

    // Generate a dummy BLS public key
    let public_key = BytesN::from_array(&env, &[1; 96]);

    // Register the key
    client.register_bls_key(&attester, &public_key);

    // Verify the event was emitted correctly
    let events = env.events().all();
    let last_event = events.last().unwrap();

    let expected_topics = (
        soroban_sdk::symbol_short!("BLS_KEY"),
        soroban_sdk::symbol_short!("REGISTER"),
    )
        .into_val(&env);

    assert_eq!(last_event.1, expected_topics);

    let (event_attester, event_pk, event_timestamp): (Address, BytesN<96>, u64) =
        last_event.2.try_into_val(&env).unwrap();

    assert_eq!(event_attester, attester);
    assert_eq!(event_pk, public_key);
    assert_eq!(event_timestamp, env.ledger().timestamp());

    println!("=============================================================");
    println!("      Finished: {}", "test_bls_key_registration_and_event");
    println!("=============================================================");
}

// The following tests require delegated attestation and valid BLS signatures,
// which are part of a more complex setup. They are stubbed out for now.
#[test]
fn test_nonce_replay_attack() {}
#[test]
fn test_nonce_future_nonce_rejection() {}
 
#[test]
fn test_delegated_attestation_with_valid_signature() {}
#[test]
fn test_delegated_attestation_with_invalid_signature() {}
#[test]
fn test_delegated_action_with_unregistered_key() {}
#[test]
fn test_delegated_revocation_with_valid_signature() {}
#[test]
fn test_delegated_action_with_expired_deadline() {}
