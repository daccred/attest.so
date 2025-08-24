// ... (at the end of the file, with the other stubs) ...

/// **Test: Nonce is Scoped to the Attester, Not the Subject**
/// - This test will prove that the nonce sequence belongs to the attester and is
///   independent of the subject being attested.
///
/// # Workflow
/// 1. Attester A creates an attestation for Subject X with nonce 0.
/// 2. Verify Attester A's nonce increments to 1.
/// 3. Attester A then creates an attestation for a different Subject Y, correctly
///    using the next nonce in their sequence (nonce 1).
/// 4. Verify the second attestation succeeds, proving the nonce is tied to the
///    attester's action count, not the specific subject.
#[test]
fn test_nonce_is_scoped_to_attester_not_subject() {
    // TODO: Implementation
}

/// **Test: Nonce is Scoped to the Attester, Not the Submitter**
/// - This test will prove that the nonce is tied to the original signer (the attester)
///   and not the third party who submits the transaction (the delegator/submitter).
///   This is a critical defense against replay attacks from multiple submitters.
///
/// # Workflow
/// 1. Attester A signs a delegated request with their current nonce (e.g., 0).
/// 2. Submitter 1 successfully submits this request on-chain.
/// 3. The contract processes the request and increments Attester A's nonce to 1.
/// 4. Submitter 2 (an attacker) intercepts the same signed request and tries to
///    submit it again.
/// 5. The contract should reject the second submission with `Error::InvalidNonce`
///    because the nonce (0) has already been consumed for Attester A.
#[test]
fn test_nonce_is_scoped_to_attester_not_submitter() {
    // TODO: Implementation
}



#[test]
fn test_delegated_revocation_with_valid_signature() {}
#[test]
fn test_delegated_action_with_expired_deadline() {}
#[test]
fn test_delegated_attestation_with_invalid_signature() {}
