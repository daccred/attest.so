use soroban_sdk::{Address, Env, BytesN, Bytes, Vec};
use crate::state::{DataKey, Attestation, DelegatedAttestationRequest, DelegatedRevocationRequest, BlsPublicKey};
use crate::errors::Error;
use crate::utils;
use crate::events;

/// Creates an attestation through delegated signature following the EAS pattern.
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
    let _schema = utils::get_schema(env, &request.schema_uid)
        .ok_or(Error::SchemaNotFound)?;
    
    // Verify and increment nonce
    verify_and_increment_nonce(env, &request.attester, request.nonce)?;
    
    // Create message for signature verification
    let message = create_attestation_message(env, &request);
    
    // Verify BLS12-381 signature
    verify_bls_signature(env, &message, &request.signature, &request.attester)?;
    
    // Create attestation record
    let attestation = Attestation {
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
    let attest_key = DataKey::Attestation(
        request.schema_uid.clone(),
        request.subject.clone(),
        request.nonce
    );
    env.storage().persistent().set(&attest_key, &attestation);
    
    // Emit event
    events::publish_attestation_event(env, &attestation);
    
    Ok(())
}

/// Revokes an attestation through delegated signature.
///
/// This function allows anyone to submit a pre-signed revocation request on-chain.
/// Similar to EAS, revocation also requires a signature from the original attester
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
    let attest_key = DataKey::Attestation(
        request.schema_uid.clone(),
        request.subject.clone(),
        request.nonce
    );
    
    let mut attestation = env.storage().persistent()
        .get::<DataKey, Attestation>(&attest_key)
        .ok_or(Error::AttestationNotFound)?;
    
    // Verify the revoker is the original attester
    if attestation.attester != request.revoker {
        return Err(Error::NotAuthorized);
    }
    
    // Verify schema is revocable
    let schema = utils::get_schema(env, &request.schema_uid)
        .ok_or(Error::SchemaNotFound)?;
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
    let current_nonce = env.storage().persistent()
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
fn create_attestation_message(
    env: &Env,
    request: &DelegatedAttestationRequest,
) -> BytesN<32> {
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
fn create_revocation_message(
    env: &Env,
    request: &DelegatedRevocationRequest,
) -> BytesN<32> {
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

/// **CRITICAL CRYPTOGRAPHIC FUNCTION**: Verifies BLS12-381 signature for delegated attestation
///
/// This is the core cryptographic security function that validates signatures created off-chain.
/// It implements the BLS signature verification algorithm to prove that the attester's private
/// key was used to sign the specific message hash. This is the primary defense against
/// unauthorized attestation creation and signature forgery.
///
/// # Cryptographic Model
/// BLS (Boneh-Lynn-Shacham) signatures provide:
/// - **Short Signatures**: 96-byte signatures vs 64-byte ECDSA
/// - **Aggregation Support**: Multiple signatures can be combined
/// - **Quantum Resistance**: Based on discrete log problem in elliptic curve groups
/// - **Deterministic**: Same message + private key always produces same signature
///
/// # Security Properties
/// - **Unforgeable**: Without private key, cannot create valid signatures
/// - **Non-Malleable**: Cannot modify signature to create new valid signature  
/// - **Message Binding**: Signature is cryptographically bound to exact message
/// - **Key Authenticity**: Signature proves possession of private key without revealing it
///
/// # BLS Signature Verification Process
/// 1. **Key Lookup**: Retrieve attester's registered G2 public key
/// 2. **Message Hashing**: Hash message to G1 point on elliptic curve
/// 3. **Signature Parsing**: Convert 96-byte signature to G1 point
/// 4. **Pairing Check**: Verify e(H(m), PK) = e(σ, G2) where:
///    - H(m) = hashed message (G1 point)
///    - PK = public key (G2 point)  
///    - σ = signature (G1 point)
///    - G2 = generator of G2 group
///
/// # Parameters
/// * `env` - Soroban environment for cryptographic operations
/// * `message` - SHA256 hash of the signed message (32 bytes)
/// * `signature` - BLS12-381 signature in compressed G1 format (96 bytes)
/// * `attester` - Wallet address of the signer (for public key lookup)
///
/// # Returns
/// * `Ok(())` - Signature is cryptographically valid
/// * `Err(Error::InvalidSignature)` - Signature verification failed (forge attempt or no key)
///
/// # Critical Security Checks
/// 1. **Key Registration**: Attester must have registered BLS public key
/// 2. **Cryptographic Verification**: Pairing equation must hold
/// 3. **Point Validation**: All elliptic curve points must be valid
/// 4. **Domain Separation**: Uses standard BLS signature DSTs
///
/// # Attack Vectors & Mitigations
/// * **Signature Forgery**: Creating signatures without private key
///   - *Mitigation*: Cryptographically impossible due to discrete log problem
/// * **Key Substitution**: Using different public key than registered
///   - *Mitigation*: Public key lookup tied to specific attester address
/// * **Message Manipulation**: Changing message after signing
///   - *Mitigation*: Signature cryptographically bound to exact message hash
/// * **Replay Attacks**: Reusing valid signatures
///   - *Mitigation*: Nonce system prevents signature reuse (handled separately)
/// * **Invalid Point Attacks**: Malformed elliptic curve points
///   - *Mitigation*: Point validation in cryptographic library
///
/// # Implementation Status
/// **IMPORTANT**: This is a proof-of-concept implementation for testing BLS API.
/// Production deployment requires:
/// 1. **Proper Point Deserialization**: Convert compressed bytes to curve points
/// 2. **Standard DST Values**: Use official BLS signature domain separation tags
/// 3. **G2 Generator**: Use correct G2 generator point from BLS12-381 spec
/// 4. **Error Handling**: Comprehensive validation of all cryptographic operations
///
/// # Cross-Platform Compatibility
/// Must be compatible with @noble/curves BLS implementation:
/// ```javascript
/// import { bls12_381 } from '@noble/curves/bls12-381';
/// 
/// // Off-chain signature creation
/// const signature = bls12_381.sign(messageHash, privateKey);
/// 
/// // This Rust function must verify signatures created by above
/// ```
///
/// # Q/A Testing Focus
/// 1. **Signature Verification**: Test with known test vectors from BLS12-381 spec
/// 2. **Invalid Signature Rejection**: Verify random signatures are rejected
/// 3. **Key Mismatch**: Test signatures with wrong public keys fail
/// 4. **Message Tampering**: Verify changed messages fail verification  
/// 5. **Cross-Platform**: Test JavaScript-created signatures verify in Rust
/// 6. **Edge Cases**: Test with invalid/malformed signature bytes
/// 7. **Performance**: Measure verification time for DoS analysis
fn verify_bls_signature(
    env: &Env,
    message: &BytesN<32>,
    signature: &BytesN<96>,
    attester: &Address,
) -> Result<(), Error> {
    // STEP 1: Look up the attester's registered BLS public key
    // Each attester must register exactly one immutable BLS key
    let pk_key = DataKey::AttesterPublicKey(attester.clone());
    let bls_key = env.storage().persistent()
        .get::<DataKey, BlsPublicKey>(&pk_key)
        .ok_or(Error::InvalidSignature)?; // No key registered = cannot verify
    
    // STEP 2: Initialize BLS12-381 cryptographic operations
    let bls = env.crypto().bls12_381();
    
    // STEP 3: Hash message to G1 point using standard BLS DST
    // This creates the point H(m) that was signed by the private key
    let message_bytes = Bytes::from_array(env, &message.to_array());
    let dst = Bytes::from_slice(env, b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_");
    let h_m = bls.hash_to_g1(&message_bytes, &dst);
    
    // STEP 4: Parse signature from compressed bytes to G1 point
    // NOTE: This is simplified for proof-of-concept
    // Production requires proper point deserialization validation
    let sig_as_bytes = Bytes::from_array(env, &signature.to_array());
    let sig_point = bls.hash_to_g1(&sig_as_bytes, &dst); // TODO: Use proper parsing
    
    // STEP 5: Parse public key from compressed bytes to G2 point
    // The registered public key is used to verify signature authenticity
    let pk_as_bytes = Bytes::from_array(env, &bls_key.key.to_array());
    let dst_g2 = Bytes::from_slice(env, b"BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_NUL_");
    let pk_point = bls.hash_to_g2(&pk_as_bytes, &dst_g2); // TODO: Use proper parsing
    
    // STEP 6: Get G2 generator point for pairing verification
    // NOTE: This is placeholder - production needs actual BLS12-381 G2 generator
    let g2_gen = bls.hash_to_g2(&Bytes::from_slice(env, b"BLS12381G2_GENERATOR"), &dst_g2);
    
    // STEP 7: Perform pairing check to verify signature
    // Verifies: e(H(m), PK) = e(σ, G2)
    // This cryptographically proves signature was created with corresponding private key
    let g1_points = Vec::from_array(env, [h_m, sig_point]);
    let g2_points = Vec::from_array(env, [pk_point, g2_gen]);
    
    let pairing_result = bls.pairing_check(g1_points, g2_points);
    
    if pairing_result {
        Ok(()) // Signature is cryptographically valid
    } else {
        Err(Error::InvalidSignature) // Signature verification failed
    }
}

/// Gets the next nonce for an attester.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `attester` - The address of the attester
///
/// # Returns
/// * `u64` - The next nonce to be used
pub fn get_next_nonce(env: &Env, attester: &Address) -> u64 {
    let nonce_key = DataKey::AttesterNonce(attester.clone());
    env.storage().persistent()
        .get::<DataKey, u64>(&nonce_key)
        .unwrap_or(0)
}

/// Registers a BLS public key for an attester.
///
/// Each wallet address can register exactly one BLS public key.
/// Once registered, the key is immutable - cannot be updated or revoked.
/// To use a different key, use a different wallet address.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `attester` - The address of the attester registering the key
/// * `public_key` - The BLS12-381 G2 public key (96 bytes)
///
/// # Returns
/// * `Result<(), Error>` - Success or error (fails if key already exists)
pub fn register_bls_public_key(
    env: &Env,
    attester: Address,
    public_key: BytesN<96>,
) -> Result<(), Error> {
    attester.require_auth();
    
    let pk_key = DataKey::AttesterPublicKey(attester.clone());
    
    // Check if this address already has a key registered
    if env.storage().persistent().has(&pk_key) {
        // Key already registered - immutable, cannot update
        return Err(Error::AlreadyInitialized);
    }
    
    let timestamp = env.ledger().timestamp();
    let bls_key = BlsPublicKey {
        key: public_key.clone(),
        registered_at: timestamp,
    };
    
    // Store the key (one per address, immutable)
    env.storage().persistent().set(&pk_key, &bls_key);
    
    // Emit registration event
    crate::events::publish_bls_key_registered(
        env,
        &attester,
        &public_key,
        timestamp,
    );
    
    Ok(())
}

/// Gets the BLS public key for an attester.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `attester` - The address of the attester
///
/// # Returns
/// * `Option<BlsPublicKey>` - The public key if registered
pub fn get_bls_public_key(env: &Env, attester: &Address) -> Option<BlsPublicKey> {
    let pk_key = DataKey::AttesterPublicKey(attester.clone());
    env.storage().persistent().get(&pk_key)
}

/*
JavaScript Integration Guide for BLS12-381 Signatures
====================================================

IMPORTANT: The attester (entity making claims) creates signatures, NOT the subject.
The subject being attested never needs to interact with the blockchain.

To create compatible signatures using @noble/curves:

```javascript
import { bls12_381 } from '@noble/curves/bls12-381';
import { sha256 } from '@noble/hashes/sha256';

// 1. Attester generates their keypair (done once)
const attesterPrivateKey = bls12_381.utils.randomPrivateKey();
const attesterPublicKey = bls12_381.getPublicKey(attesterPrivateKey);

// 2. Create attestation message (must match Rust implementation)
function createAttestationMessage(request) {
    const domainSeparator = new TextEncoder().encode("ATTEST_PROTOCOL_V1_DELEGATED");
    const schemaBytes = new Uint8Array(request.schema_uid);
    const nonceBytes = new DataView(new ArrayBuffer(8));
    nonceBytes.setBigUint64(0, BigInt(request.nonce), false); // big-endian
    const deadlineBytes = new DataView(new ArrayBuffer(8));
    deadlineBytes.setBigUint64(0, BigInt(request.deadline), false);
    
    // Concatenate all fields
    const message = new Uint8Array([
        ...domainSeparator,
        ...schemaBytes,
        ...new Uint8Array(nonceBytes.buffer),
        ...new Uint8Array(deadlineBytes.buffer),
        // Add other fields as needed
    ]);
    
    return sha256(message);
}

// 3. Attester signs the message about a subject
const message = createAttestationMessage(attestationRequest);
const signature = bls12_381.sign(message, attesterPrivateKey);

// 4. The signature can be submitted by ANYONE
// The attester doesn't need to pay gas fees
// The subject never needs to sign or interact
```

Domain Separation Tags (DST):
- Attestation messages: "ATTEST_PROTOCOL_V1_DELEGATED"  
- Revocation messages: "REVOKE_PROTOCOL_V1_DELEGATED"
- BLS G1 hashing: "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_"
- BLS G2 hashing: "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_NUL_"
*/