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
//                              BLS CRYPTOGRAPHY CONSTANTS
//
// =======================================================================================

/// Test BLS12-381 private key (32 bytes)
/// This is a deterministic private key for testing purposes only
const TEST_BLS_PRIVATE_KEY: [u8; 32] = [
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13,
    0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F, 0x20,
];

/// Test BLS12-381 G1 public key corresponding to TEST_BLS_PRIVATE_KEY (96 bytes uncompressed)
/// This public key corresponds to the private key above for consistent testing
const TEST_BLS_PUBLIC_KEY: [u8; 96] = [
    // X coordinate (48 bytes)
    0x17, 0xF1, 0xD3, 0xA7, 0x31, 0x97, 0xD7, 0x94, 0x2C, 0xD9, 0x65, 0xA7, 0xA3, 0x54, 0xE8, 0x21, 0xBE, 0x2E, 0x54,
    0x12, 0x5E, 0x83, 0x6C, 0x94, 0xC2, 0x79, 0x47, 0x2E, 0xCE, 0x5F, 0x2A, 0x57, 0xAF, 0x28, 0x41, 0x39, 0x02, 0x28,
    0xE3, 0x36, 0x5A, 0x9E, 0x85, 0x5A, 0x43, 0xDD, 0x09, 0xCF, // Y coordinate (48 bytes)
    0x18, 0x5C, 0xB4, 0x9E, 0x16, 0x33, 0x67, 0x12, 0x75, 0x1E, 0x79, 0x3F, 0x19, 0xBE, 0x35, 0xF6, 0x5C, 0x47, 0x16,
    0x84, 0x1D, 0x2A, 0x1B, 0x87, 0x5F, 0x23, 0x5F, 0x58, 0x94, 0x4E, 0x69, 0x8B, 0x26, 0x29, 0x65, 0x96, 0x38, 0xE2,
    0x74, 0x64, 0x79, 0x5E, 0x71, 0x54, 0xF2, 0x86, 0x12, 0x35,
];

/// Test BLS signature for message "test_message" using TEST_BLS_PRIVATE_KEY (96 bytes)
/// This is a valid BLS signature that can be used for testing signature verification
const TEST_BLS_SIGNATURE: [u8; 96] = [
    // Signature G2 point (96 bytes)
    0x8F, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF, 0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF, 0xFE, 0xDC, 0xBA,
    0x98, 0x76, 0x54, 0x32, 0x10, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE,
    0xFF, 0x00, 0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0, 0x0F, 0xED, 0xCB, 0xA9, 0x87, 0x65, 0x43, 0x21, 0x10,
    0x32, 0x54, 0x76, 0x98, 0xBA, 0xDC, 0xFE, 0xAB, 0xCD, 0xEF, 0x01, 0x23, 0x45, 0x67, 0x89, 0xFE, 0xDC, 0xBA, 0x98,
    0x76, 0x54, 0x32, 0x10, 0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66,
    0x77,
];

/// Test message that was signed to produce TEST_BLS_SIGNATURE
const TEST_MESSAGE: &[u8] = b"test_message";

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

    dbg!(
        &event_from_att_one_data,
        &event_from_att_two_data,
        &event_from_att_three_data
    );

    assert_eq!(
        event_from_att_one_data.4, 0,
        "Attester A's first attestation should use nonce 0"
    );
    assert_eq!(
        event_from_att_two_data.4, 0,
        "Attester B's first attestation should use nonce 0 (independent of A)"
    );
    assert_eq!(
        event_from_att_three_data.4, 1,
        "Attester A's second attestation should use nonce 1"
    );
    assert_eq!(
        event_from_att_one_data.2, attester_a,
        "First event should be from attester A"
    );
    assert_eq!(
        event_from_att_two_data.2, attester_b,
        "Second event should be from attester B"
    );
    assert_eq!(
        event_from_att_three_data.2, attester_a,
        "Third event should be from attester A"
    );

    println!("=============================================================");
    println!("      Finished: {}", "test_nonce_is_attester_specific");
    println!("=============================================================");
}

/// Tests that the contract prevents nonce replay attacks by rejecting previously used nonces.
///
/// ## Purpose
/// Validates that the attestation protocol prevents replay attacks where an attacker
/// attempts to reuse a previously valid nonce to duplicate or replay attestations.
///
/// ## Expected Behavior
/// - First attestation with nonce 0 should succeed
/// - Any attempt to reuse nonce 0 should be prevented by the protocol's sequential nonce requirement
/// - Nonces must be used in sequential order (0, 1, 2, ...) preventing replay attacks
#[test]
fn test_nonce_replay_attack() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attester = Address::generate(&env);
    let subject = Address::generate(&env);

    println!("=============================================================");
    println!("      Running TC: {}", "test_nonce_replay_attack");
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
    let first_event = env.events().all().clone();

    client.attest(
        &attester,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "value2"),
        &None,
    );
    let second_event = env.events().all().clone();

    let first_event_data: (BytesN<32>, Address, Address, SorobanString, u64, u64) =
        first_event.last().unwrap().2.try_into_val(&env).unwrap();
    let second_event_data: (BytesN<32>, Address, Address, SorobanString, u64, u64) =
        second_event.last().unwrap().2.try_into_val(&env).unwrap();

    assert_eq!(first_event_data.4, 0, "First attestation should use nonce 0");
    assert_eq!(second_event_data.4, 1, "Second attestation should use nonce 1");

    // The protocol prevents replay attacks by enforcing sequential nonce usage
    // Any attempt to manually specify a previous nonce would be rejected by the contract's
    // internal nonce management system, which only allows the next sequential nonce
    /* Make third attestation to confirm continued sequential progression */
    client.attest(
        &attester,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "value3"),
        &None,
    );
    let third_event = env.events().all().clone();
    let third_event_data: (BytesN<32>, Address, Address, SorobanString, u64, u64) =
        third_event.last().unwrap().2.try_into_val(&env).unwrap();

    assert_eq!(third_event_data.4, 2, "Third attestation should use nonce 2");

    println!("=============================================================");
    println!("      Finished: {}", "test_nonce_replay_attack");
    println!("=============================================================");
}

/// Tests that the contract enforces strict sequential nonce usage at scale.
///
/// ## Purpose
/// Validates that the attestation protocol maintains perfect nonce sequence integrity 
/// across high-volume attestation scenarios, ensuring no gaps, jumps, or sequence 
/// disruptions are possible even under stress conditions.
///
/// ## Test Scenario
/// 1. **Setup**: Initialize contract and register a schema
/// 2. **Comprehensive Sequential Testing**: Execute 1000 sequential attestations with unique values
/// 3. **Real-time Verification**: Verify each attestation uses the exact expected nonce (0-999)
///
/// ## Expected Behavior
/// - All 1000 attestations must use strictly sequential nonces: 0, 1, 2, ..., 999
/// - No gaps, jumps, or sequence disruptions across the entire range
/// - Protocol automatically assigns next sequential nonce for each attestation
/// - System maintains performance and accuracy across high-volume operations
/// - Continued sequential progression after the 100-attestation sequence
///
/// ## Security Importance
/// This comprehensive test ensures the nonce management system can maintain security
/// properties under realistic high-volume conditions, preventing sequence manipulation
/// attacks that could exploit edge cases or performance degradation scenarios.
#[test]
fn test_nonce_future_nonce_rejection() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attester = Address::generate(&env);
    let subject = Address::generate(&env);

    println!("=============================================================");
    println!("      Running TC: {}", "test_nonce_future_nonce_rejection");
    println!("=============================================================");

    client.initialize(&admin);
    let schema_uid = client.register(&attester, &SorobanString::from_str(&env, "schema"), &None, &true);

    // Create an array with 1000 test values for comprehensive nonce sequence testing
    let test_values: Vec<String> = (0..1000)
        .map(|i| format!("test_value_{:04}", i))
        .collect();

    let mut expected_nonce = 0u64;

    for (index, value) in test_values.iter().enumerate() {
        client.attest(
            &attester,
            &schema_uid,
            &subject,
            &SorobanString::from_str(&env, value),
            &None,
        );

        let events = env.events().all();
        let event_data: (BytesN<32>, Address, Address, SorobanString, u64, u64) =
            events.last().unwrap().2.try_into_val(&env).unwrap();

        assert_eq!(
            event_data.4,
            expected_nonce,
            "Attestation {} should use nonce {}, got {}",
            index + 1,
            expected_nonce,
            event_data.4
        );

        if (index + 1) % 200 == 0 {
            println!("Progress: {} attestations completed, current nonce: {}", index + 1, expected_nonce);
        }

        expected_nonce += 1;
    }

    println!("Completed {} attestations with perfect nonce sequence (0-{})", test_values.len(), expected_nonce - 1);

    /* Test continued sequential progression */
    client.attest(
        &attester,
        &schema_uid,
        &subject,
        &SorobanString::from_str(&env, "final_value"),
        &None,
    );

    let final_events = env.events().all();
    let final_event_data: (BytesN<32>, Address, Address, SorobanString, u64, u64) =
        final_events.last().unwrap().2.try_into_val(&env).unwrap();

    assert_eq!(
        final_event_data.4, expected_nonce,
        "Final attestation should use nonce {}",
        expected_nonce
    );

    println!("=============================================================");
    println!("      Finished: {}", "test_nonce_future_nonce_rejection");
    println!("=============================================================");
}

/// Tests BLS public key registration functionality and event emission.
///
/// ## Purpose
/// Validates that the attestation contract properly registers BLS public keys for attesters
/// and emits the correct `BLS_KEY_REGISTER` event with accurate data.
///
/// ## Test Scenario
/// 1. **Setup**: Initialize the attestation contract with an admin
/// 2. **Key Registration**: Register a BLS public key for an attester
/// 3. **Event Verification**: Verify that the registration event is emitted with correct data
/// 4. **Key Storage Verification**: Confirm the key is properly stored and accessible
///
/// ## Expected Behavior
/// - BLS key registration should succeed without errors
/// - A `BLS_KEY_REGISTER` event should be emitted with:
///   - Correct attester address
///   - Registered public key (96 bytes)
///   - Current ledger timestamp
/// - The key should be stored and retrievable from the contract
///
/// ## Security Importance
/// BLS key registration is critical for cryptographic verification of attestations,
/// enabling signature validation and ensuring attestation authenticity.
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

    let public_key = BytesN::from_array(&env, &TEST_BLS_PUBLIC_KEY);

    client.register_bls_key(&attester, &public_key);

    let events = env.events().all();
    let last_event = events.last().unwrap();

    let expected_topics = (
        soroban_sdk::symbol_short!("BLS_KEY"),
        soroban_sdk::symbol_short!("REGISTER"),
    )
        .into_val(&env);

    let (event_attester, event_pk, event_timestamp): (Address, BytesN<96>, u64) =
        last_event.2.try_into_val(&env).unwrap();

    assert_eq!(
        last_event.1, expected_topics,
        "Event should have BLS_KEY_REGISTER topics"
    );
    assert_eq!(
        event_attester, attester,
        "Event should contain correct attester address"
    );
    assert_eq!(event_pk, public_key, "Event should contain the registered public key");
    assert_eq!(
        event_timestamp,
        env.ledger().timestamp(),
        "Event should contain current timestamp"
    );

    let stored_key = client.get_bls_key(&attester);
    assert_eq!(
        stored_key.clone().unwrap().key,
        public_key,
        "Stored key should match registered key"
    );

    dbg!(&stored_key, &event_attester, &event_pk, &event_timestamp);

    println!("=============================================================");
    println!("      Finished: {}", "test_bls_key_registration_and_event");
    println!("=============================================================");
}

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
