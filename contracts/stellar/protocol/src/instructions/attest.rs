use soroban_sdk::{Address, Env, String, BytesN, Vec};
use crate::state::{DataKey, Attestation};
use crate::errors::Error;
use crate::utils;
use crate::events;
use crate::instructions::delegation;

/// Creates a new attestation using nonce-based system for unique identification.
///
/// This function follows the Solana/EAS pattern of using nonces to allow multiple
/// attestations for the same schema/subject pair. Each attestation is uniquely
/// identified by (schema_uid, subject, nonce).
///
/// # Authorization
/// Requires authorization from the caller (attester).
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `attester` - The address creating the attestation
/// * `schema_uid` - The unique identifier of the schema
/// * `subject` - The address that is the subject of the attestation
/// * `value` - The attestation data
/// * `expiration_time` - Optional expiration timestamp
///
/// # Returns
/// * `Result<u64, Error>` - The nonce of the created attestation or error
pub fn attest(
    env: &Env,
    attester: Address,
    schema_uid: BytesN<32>,
    subject: Address,
    value: String,
    expiration_time: Option<u64>,
) -> Result<u64, Error> {
    attester.require_auth();
    
    // Verify schema exists
    let _schema = utils::get_schema(env, &schema_uid)
        .ok_or(Error::SchemaNotFound)?;
    
    // Get next nonce for this attester
    let nonce = delegation::get_next_nonce(env, &attester);
    
    // Create attestation record
    let current_time = env.ledger().timestamp();
    
    // Check if expiration time is valid (if provided)
    if let Some(exp_time) = expiration_time {
        if exp_time <= current_time {
            return Err(Error::InvalidDeadline);
        }
    }
    
    let attestation = Attestation {
        schema_uid: schema_uid.clone(),
        subject: subject.clone(),
        attester: attester.clone(),
        value: value.clone(),
        nonce,
        timestamp: current_time,
        expiration_time,
        revoked: false,
        revocation_time: None,
    };
    
    // Store attestation with nonce-based key
    let attest_key = DataKey::Attestation(
        schema_uid.clone(),
        subject.clone(),
        nonce
    );
    env.storage().persistent().set(&attest_key, &attestation);
    
    // Increment nonce for next attestation
    let nonce_key = DataKey::AttesterNonce(attester.clone());
    let new_nonce = nonce + 1;
    env.storage().persistent().set(&nonce_key, &new_nonce);
    
    // Emit event
    events::publish_attestation_event(env, &attestation);
    
    Ok(nonce)
}

/// Retrieves an attestation using the nonce-based system.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `schema_uid` - The unique identifier of the schema
/// * `subject` - The address that is the subject of the attestation
/// * `nonce` - The nonce of the attestation
///
/// # Returns
/// * `Result<Attestation, Error>` - The attestation record or error
pub fn get_attestation(
    env: &Env,
    schema_uid: BytesN<32>,
    subject: Address,
    nonce: u64,
) -> Result<Attestation, Error> {
    // Verify schema exists
    let _schema = utils::get_schema(env, &schema_uid)
        .ok_or(Error::SchemaNotFound)?;
    
    // Get attestation
    let attest_key = DataKey::Attestation(schema_uid, subject, nonce);
    let attestation = env.storage().persistent()
        .get::<DataKey, Attestation>(&attest_key)
        .ok_or(Error::AttestationNotFound)?;
    
    // Check if attestation is expired
    if let Some(exp_time) = attestation.expiration_time {
        if env.ledger().timestamp() > exp_time {
            return Err(Error::AttestationExpired);
        }
    }
    
    Ok(attestation)
}

/// Revokes an attestation using the nonce-based system.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `revoker` - The address revoking the attestation (must be the original attester)
/// * `schema_uid` - The unique identifier of the schema
/// * `subject` - The address that is the subject of the attestation
/// * `nonce` - The nonce of the attestation to revoke
///
/// # Returns
/// * `Result<(), Error>` - Success or error
pub fn revoke_attestation(
    env: &Env,
    revoker: Address,
    schema_uid: BytesN<32>,
    subject: Address,
    nonce: u64,
) -> Result<(), Error> {
    revoker.require_auth();
    
    // Get the attestation
    let attest_key = DataKey::Attestation(schema_uid.clone(), subject.clone(), nonce);
    let mut attestation = env.storage().persistent()
        .get::<DataKey, Attestation>(&attest_key)
        .ok_or(Error::AttestationNotFound)?;
    
    // Verify the revoker is the original attester
    if attestation.attester != revoker {
        return Err(Error::NotAuthorized);
    }
    
    // Verify the attestation isn't already revoked
    if attestation.revoked {
        return Err(Error::AttestationNotFound);
    }
    
    // Verify schema is revocable
    let schema = utils::get_schema(env, &schema_uid)
        .ok_or(Error::SchemaNotFound)?;
    if !schema.revocable {
        return Err(Error::AttestationNotRevocable);
    }
    
    // Update attestation
    attestation.revoked = true;
    attestation.revocation_time = Some(env.ledger().timestamp());
    
    // Store updated attestation
    env.storage().persistent().set(&attest_key, &attestation);
    
    // Emit revocation event
    events::publish_revocation_event(env, &attestation);
    
    Ok(())
}

/// Lists all attestations for a given schema and subject.
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `schema_uid` - The unique identifier of the schema
/// * `subject` - The address that is the subject of the attestations
/// * `limit` - Maximum number of attestations to return
///
/// # Returns
/// * `Vec<AttestationRecord>` - List of attestation records
pub fn list_attestations(
    env: &Env,
    schema_uid: BytesN<32>,
    subject: Address,
    limit: u32,
) -> Vec<Attestation> {
    let mut attestations = Vec::new(env);
    let mut found = 0u32;
    
    // Try to get attestations with increasing nonces
    // This is a simple implementation - in production, you might want
    // to store an index or use a more efficient lookup method
    for nonce in 0u64..1000u64 {
        if found >= limit {
            break;
        }
        
        let attest_key = DataKey::Attestation(
            schema_uid.clone(),
            subject.clone(),
            nonce
        );
        
        if let Some(attestation) = env.storage().persistent()
            .get::<DataKey, Attestation>(&attest_key) {
            // Skip expired attestations
            if let Some(exp_time) = attestation.expiration_time {
                if env.ledger().timestamp() > exp_time {
                    continue;
                }
            }
            attestations.push_back(attestation);
            found += 1;
        }
    }
    
    attestations
}