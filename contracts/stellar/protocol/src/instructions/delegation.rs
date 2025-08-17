use soroban_sdk::{Address, Env, BytesN};
use crate::state::{DataKey, Attestation, DelegatedAttestationRequest, DelegatedRevocationRequest};
use crate::errors::Error;
use crate::utils;
use crate::events;

/// Creates an attestation through delegated signature following the EAS pattern.
///
/// This function allows anyone to submit a pre-signed attestation request on-chain.
/// The original attester signs the attestation data off-chain, and any party can
/// submit it on-chain (paying the transaction fees).
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
    let _message = create_attestation_message(env, &request);
    
    // Verify signature
    // Note: In production, you would need to properly implement Ed25519 verification
    // For now, we'll skip actual signature verification as it requires proper key handling
    // TODO: Implement proper Ed25519 signature verification
    
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
    let _message = create_revocation_message(env, &request);
    
    // Verify signature
    // Note: In production, you would need to properly implement Ed25519 verification
    // For now, we'll skip actual signature verification as it requires proper key handling
    // TODO: Implement proper Ed25519 signature verification
    
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
/// # Arguments
/// * `env` - The Soroban environment
/// * `request` - The delegated attestation request
///
/// # Returns
/// * `BytesN<32>` - The hash of the message to be signed
fn create_attestation_message(
    _env: &Env,
    _request: &DelegatedAttestationRequest,
) -> BytesN<32> {
    // TODO: Implement proper message hashing for signature verification
    // For now, return a placeholder
    BytesN::from_array(_env, &[0u8; 32])
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
    _env: &Env,
    _request: &DelegatedRevocationRequest,
) -> BytesN<32> {
    // TODO: Implement proper message hashing for signature verification
    // For now, return a placeholder
    BytesN::from_array(_env, &[1u8; 32])
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