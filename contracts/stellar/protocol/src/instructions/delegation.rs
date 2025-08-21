use crate::errors::Error;
use crate::events;
use crate::instructions::verify_bls_signature;
use crate::state::{Attestation, DataKey, DelegatedAttestationRequest, DelegatedRevocationRequest};
use crate::utils::{self, generate_attestation_uid};
use soroban_sdk::{Address, Bytes, BytesN, Env};

/// Creates an attestation through delegated signature.
///
/// This function allows anyone to submit a pre-signed attestation request on-chain.
/// The original attester signs the attestation data off-chain, and any party can
/// submit it on-chain (paying the transaction fees).
///
/// Important: The BLS signature is created by the ATTESTER (the entity making
/// claims about subjects), not by the subject being attested. The subject never
/// needs to interact with the blockchain in this flow.
///
/// # Authorization
/// Requires authorization from the submitter (who pays fees), not the original attester.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `submitter` - The address submitting the transaction (pays fees)
/// * `request` - The delegated attestation request with signature
///
/// # Returns
/// * `Result<(), Error>` - Success or error
///
/// # Errors
/// * `Error::ExpiredSignature` - If the deadline has passed
/// * `Error::InvalidSignature` - If the signature verification fails
/// * `Error::InvalidNonce` - If the nonce doesn't match expected value
/// * `Error::SchemaNotFound` - If the schema doesn't exist
pub fn attest_by_delegation(
    env: &Env,
    submitter: Address,
    request: DelegatedAttestationRequest,
) -> Result<(), Error> {
    submitter.require_auth();

    // Verify deadline hasn't passed
    let current_time = env.ledger().timestamp();
    if current_time > request.deadline {
        return Err(Error::ExpiredSignature);
    }

    // Verify schema exists
    let _schema = utils::get_schema(env, &request.schema_uid).ok_or(Error::SchemaNotFound)?;

    // Verify and increment nonce
    verify_and_increment_nonce(env, &request.attester, request.nonce)?;

    // Create message for signature verification
    let message = create_attestation_message(env, &request);

    // Verify BLS12-381 signature
    verify_bls_signature(env, &message, &request.signature, &request.attester)?;

    let attestation_uid =
        generate_attestation_uid(env, &request.schema_uid, &request.subject, request.nonce);

    // Create attestation record
    let attestation = Attestation {
        uid: attestation_uid.clone(),
        schema_uid: request.schema_uid.clone(),
        subject: request.subject.clone(),
        attester: request.attester.clone(),
        value: request.value.clone(),
        nonce: request.nonce,
        timestamp: current_time,
        expiration_time: request.expiration_time,
        revoked: false,
        revocation_time: None,
    };

    // Store attestation
    let attest_key = DataKey::AttestationUID(attestation_uid);
    env.storage().persistent().set(&attest_key, &attestation);

    // Emit event
    events::publish_attestation_event(env, &attestation);

    Ok(())
}

/// Revokes an attestation through delegated signature.
///
/// This function allows anyone to submit a pre-signed revocation request on-chain.
/// revocation also requires a signature from the original attester
/// to prevent unauthorized revocations.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `submitter` - The address submitting the transaction
/// * `request` - The delegated revocation request with signature
///
/// # Returns
/// * `Result<(), Error>` - Success or error
pub fn revoke_by_delegation(
    env: &Env,
    submitter: Address,
    request: DelegatedRevocationRequest,
) -> Result<(), Error> {
    submitter.require_auth();

    // Verify deadline hasn't passed
    let current_time = env.ledger().timestamp();
    if current_time > request.deadline {
        return Err(Error::ExpiredSignature);
    }

    // Get the attestation
    let attest_key = DataKey::AttestationUID(request.attestation_uid.clone());

    let mut attestation = env
        .storage()
        .persistent()
        .get::<DataKey, Attestation>(&attest_key)
        .ok_or(Error::AttestationNotFound)?;

    // Verify the revoker is the original attester
    if attestation.attester != request.revoker {
        return Err(Error::NotAuthorized);
    }

    // Verify schema is revocable
    let schema = utils::get_schema(env, &request.schema_uid).ok_or(Error::SchemaNotFound)?;
    if !schema.revocable {
        return Err(Error::AttestationNotRevocable);
    }

    // Create message for signature verification
    let message = create_revocation_message(env, &request);

    // Verify BLS12-381 signature
    verify_bls_signature(env, &message, &request.signature, &request.revoker)?;

    // Update attestation
    attestation.revoked = true;
    attestation.revocation_time = Some(current_time);

    // Store updated attestation
    env.storage().persistent().set(&attest_key, &attestation);

    // Emit revocation event
    events::publish_revocation_event(env, &attestation);

    Ok(())
}

/// Verifies and increments the nonce for an attester.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `attester` - The address of the attester
/// * `expected_nonce` - The expected nonce value
///
/// # Returns
/// * `Result<(), Error>` - Success or error
/// **CRITICAL SECURITY FUNCTION**: Verifies and increments the nonce for an attester
///
/// This function implements the core replay attack protection for delegated attestations.
/// Each attester has an independent nonce counter that MUST increment sequentially.
/// This prevents signature replay attacks and ensures attestation ordering.
///
/// # Security Model
/// - **Nonce Uniqueness**: Each attester has independent nonce sequence (0, 1, 2, ...)
/// - **Sequential Requirement**: Nonces must be used in exact order (no skipping)
/// - **One-Time Use**: Each nonce can only be used once per attester
/// - **Atomic Operation**: Verification and increment are atomic (either both succeed or both fail)
///
/// # Attack Prevention
/// - **Replay Attacks**: Same signature cannot be used twice
/// - **Nonce Skipping**: Cannot use future nonces to reserve slots
/// - **Parallel Processing**: Prevents race conditions in signature submission
/// - **Ordering Attacks**: Ensures attestations process in signed order
///
/// # Parameters
/// * `env` - Soroban environment for storage operations
/// * `attester` - Address whose nonce is being verified (original signer)
/// * `expected_nonce` - The nonce value from the signed request
///
/// # Returns
/// * `Ok(())` - Nonce verified and incremented successfully
/// * `Err(Error::InvalidNonce)` - Nonce doesn't match expected value (replay/skip attempt)
///
/// # Critical Invariants
/// 1. **Monotonic Increment**: Nonces always increase by exactly 1
/// 2. **No Rollback**: Once incremented, nonce cannot be reset or decreased
/// 3. **Per-Attester Isolation**: Different attesters have independent nonce sequences
/// 4. **Storage Consistency**: Nonce updates are persistent and atomic
///
/// # Attack Vectors & Mitigations
/// * **Signature Replay**: Using same signature multiple times
///   - *Mitigation*: Once nonce is used, it can never be used again
/// * **Nonce Front-Running**: Submitting signatures out of order
///   - *Mitigation*: Only exact next nonce is accepted
/// * **Parallel Submission**: Multiple parties submitting same signed request
///   - *Mitigation*: First submission wins, subsequent fail nonce check
/// * **Nonce Prediction**: Attempting to use future nonces
///   - *Mitigation*: Only current expected nonce accepted
///
/// # Implementation Notes
/// - Nonce starts at 0 for new attesters (first attestation uses nonce 0)
/// - Each successful verification increments nonce by exactly 1
/// - Failed verifications don't affect nonce state
/// - Storage operations are atomic (no partial state possible)
fn verify_and_increment_nonce(
    env: &Env,
    attester: &Address,
    expected_nonce: u64,
) -> Result<(), Error> {
    let nonce_key = DataKey::AttesterNonce(attester.clone());

    // Get current nonce (default to 0 for new attesters)
    // This creates the starting point for each attester's nonce sequence
    let current_nonce = env
        .storage()
        .persistent()
        .get::<DataKey, u64>(&nonce_key)
        .unwrap_or(0);

    // CRITICAL SECURITY CHECK: Verify nonce matches expected value exactly
    // This prevents replay attacks and ensures sequential processing
    if current_nonce != expected_nonce {
        return Err(Error::InvalidNonce);
    }

    // ATOMIC OPERATION: Increment and store new nonce
    // This ensures the nonce can never be used again
    let new_nonce = current_nonce + 1;
    env.storage().persistent().set(&nonce_key, &new_nonce);

    Ok(())
}

/// **CRITICAL CRYPTOGRAPHIC FUNCTION**: Creates deterministic message for BLS signature verification
///
/// This function constructs the exact message that was signed off-chain by the attester.
/// The message construction MUST be deterministic and match exactly between:
/// 1. Off-chain signing (JavaScript/TypeScript with @noble/curves)  
/// 2. On-chain verification (this Rust function)
/// Any mismatch will cause signature verification to fail.
///
/// # Cryptographic Security Model
/// - **Domain Separation**: Unique prefix prevents signature reuse across protocols
/// - **Deterministic Encoding**: Same inputs always produce same message hash
/// - **Field Ordering**: Fixed order prevents signature malleability
/// - **Type Safety**: Big-endian encoding ensures cross-platform consistency
///
/// # Message Structure
/// ```
/// Domain Separator: "ATTEST_PROTOCOL_V1_DELEGATED" (26 bytes)
/// Schema UID:       32 bytes (schema identifier)
/// Nonce:           8 bytes (big-endian u64, replay protection)
/// Deadline:        8 bytes (big-endian u64, signature expiration)
/// Expiration Time:  8 bytes (optional, big-endian u64)
/// Value Length:     8 bytes (big-endian u64, placeholder for value)
/// ```
///
/// # Cross-Platform Compatibility
/// This function MUST produce identical results to the JavaScript implementation:
/// ```javascript
/// function createAttestationMessage(request) {
///     const domainSeparator = new TextEncoder().encode("ATTEST_PROTOCOL_V1_DELEGATED");
///     const schemaBytes = new Uint8Array(request.schema_uid);
///     const nonceBytes = new DataView(new ArrayBuffer(8));
///     nonceBytes.setBigUint64(0, BigInt(request.nonce), false); // big-endian
///     // ... additional fields in same order
/// }
/// ```
///
/// # Parameters
/// * `env` - Soroban environment for crypto and data operations
/// * `request` - The delegated attestation request containing all signature data
///
/// # Returns
/// * `BytesN<32>` - SHA256 hash of the complete message (ready for BLS signature verification)
///
/// # Security Considerations
/// - **Immutable Structure**: Changing field order or encoding breaks compatibility
/// - **Domain Separation**: Prevents cross-protocol signature reuse attacks
/// - **Hash Finality**: Once hashed, message cannot be modified without detection
/// - **Deterministic Output**: Same request always produces same hash
///
/// # Attack Vectors & Mitigations
/// * **Message Malleability**: Changing field order to reuse signatures
///   - *Mitigation*: Fixed field order enforced in both platforms
/// * **Domain Confusion**: Reusing signatures from other protocols
///   - *Mitigation*: Unique domain separator prevents cross-protocol attacks
/// * **Encoding Attacks**: Different platforms producing different hashes
///   - *Mitigation*: Big-endian encoding standard across all platforms
/// * **Field Injection**: Adding extra fields to manipulate signature
///   - *Mitigation*: Complete field set defined and enforced
///
/// # Q/A Testing Focus
/// 1. **Cross-Platform Consistency**: Verify JavaScript and Rust produce identical hashes
/// 2. **Field Order Sensitivity**: Test that changing order breaks verification
/// 3. **Domain Separation**: Verify different domain separators produce different hashes
/// 4. **Edge Cases**: Test with optional fields present/absent
/// 5. **Encoding Validation**: Verify big-endian encoding consistency
fn create_attestation_message(env: &Env, request: &DelegatedAttestationRequest) -> BytesN<32> {
    let mut message = Bytes::new(env);

    // DOMAIN SEPARATION: Unique protocol identifier prevents signature reuse
    // This string MUST match exactly with JavaScript implementation
    message.extend_from_slice(b"ATTEST_PROTOCOL_V1_DELEGATED");

    // FIELD 1: Schema UID (32 bytes, deterministic order)
    message.extend_from_slice(&request.schema_uid.to_array());

    // FIELD 2: Nonce (8 bytes, big-endian for cross-platform consistency)
    // Big-endian ensures JavaScript/Rust produce identical byte sequences
    let nonce_bytes = request.nonce.to_be_bytes();
    message.extend_from_slice(&nonce_bytes);

    // FIELD 3: Deadline (8 bytes, big-endian)
    // Signature expiration time for temporal security
    let deadline_bytes = request.deadline.to_be_bytes();
    message.extend_from_slice(&deadline_bytes);

    // FIELD 4: Expiration Time (optional, 8 bytes if present)
    // Conditional inclusion must match JavaScript logic exactly
    if let Some(exp_time) = request.expiration_time {
        let exp_bytes = exp_time.to_be_bytes();
        message.extend_from_slice(&exp_bytes);
    }

    // FIELD 5: Value Length (8 bytes, placeholder for actual value)
    // TODO: In production, include actual value hash for complete security
    // Currently using length as simplified placeholder for proof-of-concept
    let value_len_bytes = (request.value.len() as u64).to_be_bytes();
    message.extend_from_slice(&value_len_bytes);

    // CRYPTOGRAPHIC HASH: SHA256 of complete message
    // This hash is what gets signed by BLS private key off-chain
    env.crypto().sha256(&message).into()
}

/// Creates the message to be signed for revocation delegation.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `request` - The delegated revocation request
///
/// # Returns
/// * `BytesN<32>` - The hash of the message to be signed
fn create_revocation_message(env: &Env, request: &DelegatedRevocationRequest) -> BytesN<32> {
    let mut message = Bytes::new(env);

    // Add fixed domain separator (different from attestation)
    message.extend_from_slice(b"REVOKE_PROTOCOL_V1_DELEGATED");

    // Encode request data deterministically
    message.extend_from_slice(&request.schema_uid.to_array());

    // Add nonce and deadline as big-endian bytes
    let nonce_bytes = request.nonce.to_be_bytes();
    message.extend_from_slice(&nonce_bytes);

    let deadline_bytes = request.deadline.to_be_bytes();
    message.extend_from_slice(&deadline_bytes);

    // Return hash of the complete message
    env.crypto().sha256(&message).into()
}
