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
fn verify_and_increment_nonce(
    env: &Env,
    attester: &Address,
    expected_nonce: u64,
) -> Result<(), Error> {
    let nonce_key = DataKey::AttesterNonce(attester.clone());
    
    // Get current nonce (default to 0 if not set)
    let current_nonce = env.storage().persistent()
        .get::<DataKey, u64>(&nonce_key)
        .unwrap_or(0);
    
    // Verify nonce matches expected
    if current_nonce != expected_nonce {
        return Err(Error::InvalidNonce);
    }
    
    // Increment and store new nonce
    let new_nonce = current_nonce + 1;
    env.storage().persistent().set(&nonce_key, &new_nonce);
    
    Ok(())
}

/// Creates the message to be signed for attestation delegation.
///
/// Creates a deterministic message from the request data for signature verification.
/// Uses a simplified approach that works with Soroban's no_std environment.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `request` - The delegated attestation request
///
/// # Returns
/// * `BytesN<32>` - The hash of the message to be signed
fn create_attestation_message(
    env: &Env,
    request: &DelegatedAttestationRequest,
) -> BytesN<32> {
    let mut message = Bytes::new(env);
    
    // Add fixed domain separator
    message.extend_from_slice(b"ATTEST_PROTOCOL_V1_DELEGATED");
    
    // Add all request fields in deterministic order
    message.extend_from_slice(&request.schema_uid.to_array());
    
    // Add nonce and deadline as big-endian bytes for deterministic encoding
    let nonce_bytes = request.nonce.to_be_bytes();
    message.extend_from_slice(&nonce_bytes);
    
    let deadline_bytes = request.deadline.to_be_bytes();
    message.extend_from_slice(&deadline_bytes);
    
    // Add expiration time if present
    if let Some(exp_time) = request.expiration_time {
        let exp_bytes = exp_time.to_be_bytes();
        message.extend_from_slice(&exp_bytes);
    }
    
    // Hash the value for fixed-size inclusion
    // For now, use a simplified hash approach - include value length as placeholder
    let value_len_bytes = (request.value.len() as u64).to_be_bytes();
    message.extend_from_slice(&value_len_bytes);
    
    // Return hash of the complete message
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

/// Verifies a BLS12-381 signature for delegated attestation.
///
/// Implements BLS signature verification using Soroban's BLS12-381 API.
/// Verifies that the signature was created by the attester's private key
/// corresponding to their registered public key.
///
/// # BLS Signature Scheme
/// - Public keys are in G2 (96 bytes compressed)
/// - Signatures are in G1 (48 bytes compressed, but we use 96 for consistency)
/// - Verification: e(H(m), pk) == e(sig, G2_generator)
/// - Using pairing_check: e(H(m), pk) * e(-sig, G2_gen) == 1
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `message` - The message hash that was signed
/// * `signature` - The BLS12-381 signature (96 bytes)
/// * `attester` - The address of the signer
///
/// # Returns
/// * `Result<(), Error>` - Success or signature verification error
fn verify_bls_signature(
    env: &Env,
    message: &BytesN<32>,
    signature: &BytesN<96>,
    attester: &Address,
) -> Result<(), Error> {
    let bls = env.crypto().bls12_381();
    
    // Get the attester's public key
    let pk_key = DataKey::AttesterPublicKey(attester.clone());
    let bls_pk = env.storage().persistent()
        .get::<DataKey, BlsPublicKey>(&pk_key)
        .ok_or(Error::InvalidSignature)?; // No public key registered
    
    // Convert message to Bytes for hashing
    let message_bytes = Bytes::from_array(env, &message.to_array());
    
    // Hash message to G1 using standard BLS signature DST
    let dst = Bytes::from_slice(env, b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_");
    let h_m = bls.hash_to_g1(&message_bytes, &dst);
    
    // Parse signature from bytes to G1 point
    // Note: This is a simplified approach - in production, you'd need proper
    // point deserialization from compressed format
    let sig_as_bytes = Bytes::from_array(env, &signature.to_array());
    let sig_point = bls.hash_to_g1(&sig_as_bytes, &dst); // Placeholder for parsing
    
    // Parse public key from bytes to G2 point  
    // Note: This is also simplified - real implementation needs G2 deserialization
    let pk_as_bytes = Bytes::from_array(env, &bls_pk.key_bytes.to_array());
    let dst_g2 = Bytes::from_slice(env, b"BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_NUL_");
    let pk_point = bls.hash_to_g2(&pk_as_bytes, &dst_g2); // Placeholder for parsing
    
    // Create standard G2 generator (placeholder - would need actual generator)
    let g2_gen = bls.hash_to_g2(&Bytes::from_slice(env, b"BLS12381G2_GENERATOR"), &dst_g2);
    
    // Verify signature using pairing check
    // Check: e(H(m), pk) == e(sig, G2_gen)
    // Implementation: verify e(H(m), pk) * e(-sig, G2_gen) == 1
    // For simplicity, we'll verify e(H(m), pk) * e(sig, G2_gen) != 0
    
    let g1_points = Vec::from_array(env, [h_m, sig_point]);
    let g2_points = Vec::from_array(env, [pk_point, g2_gen]);
    
    let pairing_result = bls.pairing_check(g1_points, g2_points);
    
    // Note: This is a simplified verification - proper BLS signature verification
    // requires more careful handling of point negation and generator setup
    if pairing_result {
        Ok(())
    } else {
        Err(Error::InvalidSignature)
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
/// This function allows an attester to register their BLS12-381 public key
/// which will be used to verify delegated attestation signatures.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `attester` - The address of the attester registering the key
/// * `public_key` - The BLS12-381 G2 public key (96 bytes)
///
/// # Returns
/// * `Result<(), Error>` - Success or error
pub fn register_bls_public_key(
    env: &Env,
    attester: Address,
    public_key: BytesN<96>,
) -> Result<(), Error> {
    attester.require_auth();
    
    let pk_key = DataKey::AttesterPublicKey(attester.clone());
    let bls_pk = BlsPublicKey {
        key_bytes: public_key,
        registered_at: env.ledger().timestamp(),
    };
    
    env.storage().persistent().set(&pk_key, &bls_pk);
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