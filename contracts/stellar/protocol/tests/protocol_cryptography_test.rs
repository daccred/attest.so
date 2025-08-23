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

/// Tests that the attestation contract correctly increments internal nonces to prevent UID collisions.
///
/// ## Purpose
/// Validates that the attestation protocol maintains a per-attester nonce counter that increments
/// with each successful attestation, ensuring each attestation generates a unique identifier (UID).
///
/// ## Test Scenario
/// 1. **Setup**: Initialize contract with admin and register a schema with an attester
/// 2. **Sequential Attestations**: Perform three attestations from the same attester to the same subject
/// 3. **Nonce Verification**: Verify that each attestation uses an incremented nonce value (0, 1, 2)
///
/// ## Expected Behavior from same attester on same subject on same schema
/// - First attestation should use nonce 0 and succeed
/// - Second attestation should use nonce 1 (preventing UID collision with first)
/// - Third attestation should use nonce 2 (preventing UID collision with previous two)
/// - Each attestation event should contain the correct nonce value in position 4 of the event data
///
/// ## Security Importance
/// This test ensures the protocol's fundamental security property: preventing attestation UID
/// collisions that could lead to attestation overwrites or duplicate attestation identifiers.
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
    let schema_uid = client.register(&attester, &SorobanString::from_str(&env, "schema"), &None, &true);

    client.attest(
        &attester,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "value1"),
        &None,
    );
    let event_one = env.events().all().clone();

    client.attest(
        &attester,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "value2"),
        &None,
    );
    let event_two = env.events().all().clone();

    client.attest(
        &attester,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "value3"),
        &None,
    );
    let event_three = env.events().all().clone();

    let first_event_data: (BytesN<32>, Address, Address, SorobanString, u64, u64) =
        event_one.last().unwrap().2.try_into_val(&env).unwrap();
    let second_event_data: (BytesN<32>, Address, Address, SorobanString, u64, u64) =
        event_two.last().unwrap().2.try_into_val(&env).unwrap();
    let third_event_data: (BytesN<32>, Address, Address, SorobanString, u64, u64) =
        event_three.last().unwrap().2.try_into_val(&env).unwrap();

    dbg!(&first_event_data, &second_event_data, &third_event_data);
    // let (event_schema_uid, event_attester, event_subject, event_value, event_nonce, event_timestamp): (BytesN<32>, Address, Address, SorobanString, u64, u64) = first_event_data;
    assert_eq!(first_event_data.4, 0, "First attestation should use nonce 0");
    assert_eq!(second_event_data.4, 1, "Second attestation should use nonce 1");
    assert_eq!(third_event_data.4, 2, "Third attestation should use nonce 2");

    println!("=============================================================");
    println!("      Finished: {}", "test_nonce_incrementation");
    println!("=============================================================");
}

/// Tests that nonce counters are maintained separately for each attester address.
///
/// ## Purpose
/// Validates that the attestation protocol maintains independent nonce sequences per attester,
/// ensuring that different attesters do not interfere with each other's nonce progression.
///
/// ## Test Scenario
/// 1. **Setup**: Initialize contract and register a schema
/// 2. **Interleaved Attestations**: Perform attestations from two different attesters in sequence:
///    - Attester A makes first attestation (should use nonce 0 for A)
///    - Attester B makes first attestation (should use nonce 0 for B, independent of A)
///    - Attester A makes second attestation (should use nonce 1 for A)
/// 3. **Nonce Verification**: Verify each attester maintains their own nonce counter
///
/// ## Expected Behavior
/// - Attester A's first attestation uses nonce 0
/// - Attester B's first attestation uses nonce 0 (independent sequence)
/// - Attester A's second attestation uses nonce 1 (continuing A's sequence)
/// - Each attester's nonce sequence is isolated and unaffected by other attesters
///
/// ## Security Importance
/// This test ensures proper nonce isolation between attesters, preventing cross-attester
/// nonce interference that could lead to unexpected UID generation patterns.
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

    client.attest(
        &attester_a,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "valueA"),
        &None,
    );
    let event_from_att_one = env.events().all().clone();

    client.attest(
        &attester_b,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "valueB"),
        &None,
    );
    let event_from_att_two = env.events().all().clone();

    client.attest(
        &attester_a,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "valueA2"),
        &None,
    );
    let event_from_att_three = env.events().all().clone();

    let event_from_att_one_data: (BytesN<32>, Address, Address, SorobanString, u64, u64) =
        event_from_att_one.last().unwrap().2.try_into_val(&env).unwrap();
    let event_from_att_two_data: (BytesN<32>, Address, Address, SorobanString, u64, u64) =
        event_from_att_two.last().unwrap().2.try_into_val(&env).unwrap();
    let event_from_att_three_data: (BytesN<32>, Address, Address, SorobanString, u64, u64) =
        event_from_att_three.last().unwrap().2.try_into_val(&env).unwrap();

    dbg!(&event_from_att_one_data, &event_from_att_two_data, &event_from_att_three_data);

    assert_eq!(event_from_att_one_data.4, 0, "Attester A's first attestation should use nonce 0");
    assert_eq!(event_from_att_two_data.4, 0, "Attester B's first attestation should use nonce 0 (independent of A)");
    assert_eq!(event_from_att_three_data.4, 1, "Attester A's second attestation should use nonce 1");
    assert_eq!(event_from_att_one_data.2, attester_a, "First event should be from attester A");
    assert_eq!(event_from_att_two_data.2, attester_b, "Second event should be from attester B");
    assert_eq!(event_from_att_three_data.2, attester_a, "Third event should be from attester A");

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
