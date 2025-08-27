mod testutils;

use protocol::{
    errors::Error as ProtocolError,
    instructions::delegation::{create_attestation_message, create_revocation_message},
    state::{DelegatedAttestationRequest, DelegatedRevocationRequest},
    AttestationContract, AttestationContractClient,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, BytesN, Env, String as SorobanString,
};
use testutils::{create_delegated_attestation_request, TEST_BLS_G2_PUBLIC_KEY, TEST_BLS_PRIVATE_KEY};
// No need for bls12_381 directly or rand_core since we use the test helpers

// --- The corrected test implementation ---

/// **Test: Nonce is Scoped to the Attester, Not the Subject (Delegated)**
///
/// This test proves that the nonce sequence for delegated attestations belongs to the
/// attester (the signer) and is independent of the subject being attested to.
///
/// # Workflow
/// 1. An attester signs a delegated request for Subject X with nonce 0.
/// 2. The test verifies that the `get_attester_nonce` function now returns 1 for the attester.
/// 3. The same attester then signs a second delegated request for a *different* subject, Subject Y,
///    correctly using the next nonce in their sequence (nonce 1).
/// 4. The test verifies the second attestation succeeds and the attester's nonce is now 2,
///    proving the nonce is tied to the attester's action count, not the subject.
#[test]
fn test_nonce_is_scoped_to_attester_not_subject() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attester = Address::generate(&env);
    let subject_x = Address::generate(&env);
    let subject_y = Address::generate(&env);
    let submitter = Address::generate(&env);

    client.initialize(&admin);
    let schema_uid = client.register(&admin, &SorobanString::from_str(&env, "schema"), &None, &true);

    // Register BLS key for the attester using the TEST_BLS_G2_PUBLIC_KEY
    let public_key = BytesN::from_array(&env, &TEST_BLS_G2_PUBLIC_KEY);
    client.register_bls_key(&attester, &public_key);

    // Verify initial nonce for the attester is 0
    assert_eq!(client.get_attester_nonce(&attester), 0);

    // 1. Attester signs a request for Subject X with nonce 0.
    let request_for_x = create_delegated_attestation_request(
        &env,
        &attester,
        0, // nonce
        &schema_uid,
        &subject_x,
    );
    client.attest_by_delegation(&submitter, &request_for_x);

    // 2. Verify the attester's nonce has incremented to 1.
    assert_eq!(client.get_attester_nonce(&attester), 1);

    // 3. Attester signs a request for Subject Y with nonce 1.
    let request_for_y = create_delegated_attestation_request(
        &env,
        &attester,
        1, // next nonce
        &schema_uid,
        &subject_y,
    );
    client.attest_by_delegation(&submitter, &request_for_y);

    // 4. Verify the attester's nonce has incremented to 2.
    // This proves the nonce is sequential for the attester, regardless of the subject.
    assert_eq!(client.get_attester_nonce(&attester), 2);
}

/// **Test: Nonce is Scoped to the Attester, Not the Submitter**
///
/// This test proves that the nonce is tied to the original signer (the attester)
/// and not the third party who submits the transaction (the delegator/submitter).
/// This is a critical defense against replay attacks from multiple submitters.
///
/// # Workflow
/// 1. Attester A signs a delegated request with their current nonce (0).
/// 2. Submitter 1 successfully submits this request on-chain. The contract
///    processes it and increments Attester A's nonce to 1.
/// 3. Submitter 2 (an attacker) intercepts the same signed request and tries to
///    submit it again.
/// 4. The contract MUST reject the second submission with `Error::InvalidNonce`
///    because the nonce (0) has already been consumed for Attester A.
#[test]
fn test_nonce_is_scoped_to_attester_not_submitter() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attester = Address::generate(&env);
    let subject = Address::generate(&env);
    let submitter_1 = Address::generate(&env);
    let submitter_2 = Address::generate(&env); // The "attacker"

    client.initialize(&admin);
    let schema_uid = client.register(&admin, &SorobanString::from_str(&env, "schema"), &None, &true);

    // Register the attester's public key so they can create delegated attestations
    let public_key = BytesN::from_array(&env, &TEST_BLS_G2_PUBLIC_KEY);
    client.register_bls_key(&attester, &public_key);

    // 1. Create a single, valid signed request from the attester with nonce 0.
    // We use the helper from testutils.rs.
    let signed_request = create_delegated_attestation_request(
        &env,
        &attester,
        0, // Nonce
        &schema_uid,
        &subject,
    );

    // 2. Submitter 1 successfully submits the request.
    client.attest_by_delegation(&submitter_1, &signed_request);

    // Verify the attester's nonce was consumed and is now 1.
    assert_eq!(client.get_attester_nonce(&attester), 1);

    // 3. Submitter 2 attempts to submit the *exact same* signed request.
    let result = client.try_attest_by_delegation(&submitter_2, &signed_request);

    // 4. Assert that the second submission fails with an InvalidNonce error.
    assert_eq!(result, Err(Ok(ProtocolError::InvalidNonce.into())));

    // 5. Verify the nonce was not consumed again.
    assert_eq!(client.get_attester_nonce(&attester), 1);
}

/// **Test: Delegated Revocation with Valid Signature**
///
/// This test verifies that a delegated revocation request with a valid BLS signature
/// can be successfully processed by the contract.
///
/// # Workflow
/// 1. An attester creates a delegated attestation
/// 2. The attester generates a signed delegated revocation request off-chain
/// 3. A third party submitter submits the revocation request on-chain
/// 4. The contract verifies the signature and processes the revocation
/// 5. The attestation is marked as revoked
#[test]
fn test_delegated_revocation_with_valid_signature() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attester = Address::generate(&env);
    let subject = Address::generate(&env);
    let submitter = Address::generate(&env);

    client.initialize(&admin);
    let schema_uid = client.register(
        &admin,
        &SorobanString::from_str(&env, "revocable_schema"),
        &None,
        &true, // revocable
    );

    // Register the attester's public key
    let public_key = BytesN::from_array(&env, &TEST_BLS_G2_PUBLIC_KEY);
    client.register_bls_key(&attester, &public_key);

    // Create a delegated attestation first using the helper
    let attestation_request = create_delegated_attestation_request(
        &env,
        &attester,
        0, // nonce
        &schema_uid,
        &subject,
    );
    client.attest_by_delegation(&submitter, &attestation_request);

    // Get the attestation UID that was created
    // Since we can't get it directly from attest_by_delegation (returns ()),
    // we need to use a different approach - use the nonce to predict the UID
    let attestation_uid = protocol::utils::generate_attestation_uid(
        &env,
        &schema_uid,
        &subject,
        0, // nonce used in the attestation
    );

    // Verify the attestation exists and is not revoked
    let attestation = client.get_attestation(&attestation_uid);
    assert!(!attestation.revoked);

    // Now create a delegated revocation request using blst for signing
    let private_key =
        blst::min_sig::SecretKey::from_bytes(&TEST_BLS_PRIVATE_KEY).expect("Failed to create private key");

    let mut revocation_request = DelegatedRevocationRequest {
        attestation_uid: attestation_uid.clone(),
        schema_uid: schema_uid.clone(),
        subject: subject.clone(),
        nonce: client.get_attester_nonce(&attester), // should be 1 after attestation
        revoker: attester.clone(),
        deadline: env.ledger().timestamp() + 1000,
        signature: BytesN::from_array(&env, &[0; 96]), // Placeholder
    };

    // Sign the revocation request using blst (matching testutils pattern)
    let message_hash = create_revocation_message(&env, &revocation_request);
    let signature_scalar = private_key.sign(
        &message_hash.to_array(),
        b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_",
        &[],
    );
    let signature_bytes = signature_scalar.serialize();
    revocation_request.signature = BytesN::from_array(&env, &signature_bytes);

    // Submit the delegated revocation through a third party
    client.revoke_by_delegation(&submitter, &revocation_request);

    // Verify the attestation is now revoked
    let revoked_attestation = client.get_attestation(&attestation_uid);
    assert!(revoked_attestation.revoked);
    assert!(revoked_attestation.revocation_time.is_some());

    // Verify the attester's nonce remains at 1 (revocations don't consume nonces)
    assert_eq!(client.get_attester_nonce(&attester), 1);
}
/// **Test: Delegated Action with Expired Deadline**
///
/// This test verifies that both delegated attestations and revocations
/// fail when submitted after their deadline has expired.
///
/// # Workflow
/// 1. Create a delegated attestation request with a deadline in the past
/// 2. Attempt to submit it and verify it fails with ExpiredSignature error
/// 3. Create a valid attestation for testing revocation
/// 4. Create a delegated revocation request with a deadline in the past
/// 5. Attempt to submit it and verify it fails with ExpiredSignature error
#[test]
fn test_delegated_action_with_expired_deadline() {
    let env = Env::default();
    env.mock_all_auths();

    // Set ledger timestamp to a reasonable value
    env.ledger().with_mut(|li| {
        li.timestamp = 1000;
    });
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attester = Address::generate(&env);
    let subject = Address::generate(&env);
    let submitter = Address::generate(&env);

    client.initialize(&admin);
    let schema_uid = client.register(&admin, &SorobanString::from_str(&env, "schema"), &None, &true);

    // Register the attester's public key
    let public_key = BytesN::from_array(&env, &TEST_BLS_G2_PUBLIC_KEY);
    client.register_bls_key(&attester, &public_key);

    // Test 1: Expired delegated attestation
    {
        let private_key =
            blst::min_sig::SecretKey::from_bytes(&TEST_BLS_PRIVATE_KEY).expect("Failed to create private key");

        let mut attestation_request = DelegatedAttestationRequest {
            schema_uid: schema_uid.clone(),
            subject: subject.clone(),
            value: SorobanString::from_str(&env, "{\"key\":\"value\"}"),
            nonce: 0,
            attester: attester.clone(),
            expiration_time: None,
            deadline: 500, // Expired deadline (timestamp 0 is always in the past)
            signature: BytesN::from_array(&env, &[0; 96]),
        };

        // Sign the request using blst
        let message_hash = create_attestation_message(&env, &attestation_request);
        let signature_scalar = private_key.sign(
            &message_hash.to_array(),
            b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_",
            &[],
        );
        let signature_bytes = signature_scalar.serialize();
        attestation_request.signature = BytesN::from_array(&env, &signature_bytes);

        // Attempt to submit the expired attestation request
        let result = client.try_attest_by_delegation(&submitter, &attestation_request);
        assert_eq!(result, Err(Ok(ProtocolError::ExpiredSignature.into())));

        // Verify nonce was not consumed
        assert_eq!(client.get_attester_nonce(&attester), 0);
    }

    // Test 2: First create a valid delegated attestation to revoke
    let valid_attestation_request = create_delegated_attestation_request(
        &env,
        &attester,
        0, // nonce
        &schema_uid,
        &subject,
    );
    client.attest_by_delegation(&submitter, &valid_attestation_request);

    // Get the attestation UID that was created
    let attestation_uid = protocol::utils::generate_attestation_uid(
        &env,
        &schema_uid,
        &subject,
        0, // nonce used in the attestation
    );

    // Test 3: Expired delegated revocation
    {
        let private_key =
            blst::min_sig::SecretKey::from_bytes(&TEST_BLS_PRIVATE_KEY).expect("Failed to create private key");

        let mut revocation_request = DelegatedRevocationRequest {
            attestation_uid: attestation_uid.clone(),
            schema_uid: schema_uid.clone(),
            subject: subject.clone(),
            nonce: client.get_attester_nonce(&attester), // should be 1 after attestation
            revoker: attester.clone(),
            deadline: 500, // Expired deadline (timestamp 0 is always in the past)
            signature: BytesN::from_array(&env, &[0; 96]),
        };

        // Sign the revocation request using blst
        let message_hash = create_revocation_message(&env, &revocation_request);
        let signature_scalar = private_key.sign(
            &message_hash.to_array(),
            b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_",
            &[],
        );
        let signature_bytes = signature_scalar.serialize();
        revocation_request.signature = BytesN::from_array(&env, &signature_bytes);

        // Attempt to submit the expired revocation request
        let result = client.try_revoke_by_delegation(&submitter, &revocation_request);
        assert_eq!(result, Err(Ok(ProtocolError::ExpiredSignature.into())));

        // Verify the attestation is still not revoked
        let attestation = client.get_attestation(&attestation_uid);
        assert!(!attestation.revoked);
    }
}
