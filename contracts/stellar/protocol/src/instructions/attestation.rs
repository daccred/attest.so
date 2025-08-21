use crate::errors::Error;
use crate::state::{Attestation, DataKey};
use soroban_sdk::{Address, Bytes, BytesN, Env, String, Vec};

use crate::events;
use crate::interfaces::resolver::{ResolverAttestation, ResolverClient};
use crate::utils;

// ══════════════════════════════════════════════════════════════════════════════
// ► Resolver Cross-Contract Call Helpers
// ══════════════════════════════════════════════════════════════════════════════

/// Calls before_attest on a resolver contract
/// Returns true if the attestation should be allowed, false otherwise
fn call_resolver_before_attest(
    env: &Env,
    resolver_address: &Address,
    attestation: &ResolverAttestation,
) -> Result<bool, Error> {
    let resolver_client = ResolverClient::new(env, resolver_address);

    match resolver_client.try_bef_att(attestation) {
        Ok(result) => match result {
            Ok(allowed) => Ok(allowed),
            Err(_) => Err(Error::ResolverCallFailed),
        },
        Err(_) => Err(Error::ResolverCallFailed),
    }
}

/// Calls after_attest on a resolver contract
/// Failures are logged but don't revert the attestation
fn call_resolver_after_attest(
    env: &Env,
    resolver_address: &Address,
    attestation: &ResolverAttestation,
) {
    let resolver_client = ResolverClient::new(env, resolver_address);

    // Ignore failures in after_attest - they're non-critical side effects
    let _ = resolver_client.try_aft_att(attestation);
}

/// Calls before_revoke on a resolver contract
/// Returns true if the revocation should be allowed, false otherwise
fn call_resolver_before_revoke(
    env: &Env,
    resolver_address: &Address,
    attestation: &ResolverAttestation,
) -> Result<bool, Error> {
    let resolver_client = ResolverClient::new(env, resolver_address);

    match resolver_client.try_bef_rev(attestation) {
        Ok(result) => match result {
            Ok(allowed) => Ok(allowed),
            Err(_) => Err(Error::ResolverCallFailed),
        },
        Err(_) => Err(Error::ResolverCallFailed),
    }
}

/// Calls after_revoke on a resolver contract
/// Failures are logged but don't revert the revocation
fn call_resolver_after_revoke(
    env: &Env,
    resolver_address: &Address,
    attestation: &ResolverAttestation,
) {
    let resolver_client = ResolverClient::new(env, resolver_address);

    // Ignore failures in after_revoke - they're non-critical side effects
    let _ = resolver_client.try_aft_rev(attestation);
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Helper Functions for Resolver Integration
// ══════════════════════════════════════════════════════════════════════════════

/// Creates a ResolverAttestation from protocol Attestation data
/// This converts between the protocol's internal format and the resolver interface format
fn create_resolver_attestation(
    env: &Env,
    attestation: &Attestation,
    schema_uid: &BytesN<32>,
    _value: &String,
) -> ResolverAttestation {
    // Generate a UID for this attestation (protocol doesn't store UIDs currently)
    let uid = generate_attestation_uid(env, schema_uid, &attestation.subject, attestation.nonce);

    ResolverAttestation {
        uid,
        schema_uid: schema_uid.clone(),
        recipient: attestation.subject.clone(),
        attester: attestation.attester.clone(),
        time: attestation.timestamp,
        expiration_time: attestation.expiration_time.unwrap_or(0), // Flattened: 0 = not set
        revocation_time: attestation.revocation_time.unwrap_or(0), // Flattened: 0 = not set
        revocable: true,                                           // Will be set based on schema
        ref_uid: Bytes::new(env), // Flattened: empty bytes = not set
        data: Bytes::from_slice(env, b"placeholder"), // TODO: Convert string to bytes properly
        value: 0, // Flattened: 0 = not set (protocol doesn't support value field yet)
    }
}

/// Generates a unique UID for an attestation based on its key components
/// This creates a deterministic UID that can be used for resolver calls
fn generate_attestation_uid(
    env: &Env,
    schema_uid: &BytesN<32>,
    _subject: &Address,
    nonce: u64,
) -> BytesN<32> {
    // Simple hash generation - combine schema_uid and nonce only for now
    let mut hash_input = Bytes::new(env);
    hash_input.extend_from_array(&schema_uid.to_array());

    // Add nonce bytes directly
    let nonce_bytes = nonce.to_be_bytes();
    hash_input.extend_from_array(&nonce_bytes);

    env.crypto().keccak256(&hash_input).into()
}

/// Creates a new attestation using nonce-based system for unique identification.
///
/// This function follows the security pattern of using nonces to allow multiple
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

    // Verify schema exists and get resolver info
    let schema = utils::get_schema(env, &schema_uid).ok_or(Error::SchemaNotFound)?;

    // Get next nonce for this attester
    let nonce = utils::get_next_nonce(env, &attester);

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

    // ═══════════════════════════════════════════════════════════════════════════
    // ► RESOLVER INTEGRATION: Before Attest Hook
    // ═══════════════════════════════════════════════════════════════════════════

    // Call resolver before_attest hook if schema has a resolver
    if let Some(resolver_address) = &schema.resolver {
        // Create resolver attestation format
        let resolver_attestation =
            create_resolver_attestation(env, &attestation, &schema_uid, &value);

        // Call before_attest hook - this is CRITICAL for access control
        let allowed = call_resolver_before_attest(env, resolver_address, &resolver_attestation)?;

        if !allowed {
            return Err(Error::ResolverError); // Resolver rejected the attestation
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ► CORE PROTOCOL: Store Attestation
    // ═══════════════════════════════════════════════════════════════════════════

    // Store attestation with nonce-based key
    let attest_key = DataKey::Attestation(schema_uid.clone(), subject.clone(), nonce);
    env.storage().persistent().set(&attest_key, &attestation);

    // Increment nonce for next attestation
    let nonce_key = DataKey::AttesterNonce(attester.clone());
    let new_nonce = nonce + 1;
    env.storage().persistent().set(&nonce_key, &new_nonce);

    // ═══════════════════════════════════════════════════════════════════════════
    // ► RESOLVER INTEGRATION: After Attest Hook
    // ═══════════════════════════════════════════════════════════════════════════

    // Call resolver after_attest hook if schema has a resolver
    if let Some(resolver_address) = &schema.resolver {
        // Create resolver attestation format
        let resolver_attestation =
            create_resolver_attestation(env, &attestation, &schema_uid, &value);

        // Call after_attest hook for side effects (rewards, registration, etc.)
        // Note: Failures here don't revert the attestation
        call_resolver_after_attest(env, resolver_address, &resolver_attestation);
    }

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
    let _schema = utils::get_schema(env, &schema_uid).ok_or(Error::SchemaNotFound)?;

    // Get attestation
    let attest_key = DataKey::Attestation(schema_uid, subject, nonce);
    let attestation = env
        .storage()
        .persistent()
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
    let mut attestation = env
        .storage()
        .persistent()
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
    let schema = utils::get_schema(env, &schema_uid).ok_or(Error::SchemaNotFound)?;
    if !schema.revocable {
        return Err(Error::AttestationNotRevocable);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ► RESOLVER INTEGRATION: Before Revoke Hook
    // ═══════════════════════════════════════════════════════════════════════════

    // Call resolver before_revoke hook if schema has a resolver
    if let Some(resolver_address) = &schema.resolver {
        // Create resolver attestation format
        let resolver_attestation =
            create_resolver_attestation(env, &attestation, &schema_uid, &attestation.value);

        // Call before_revoke hook - this is CRITICAL for access control
        let allowed = call_resolver_before_revoke(env, resolver_address, &resolver_attestation)?;

        if !allowed {
            return Err(Error::ResolverError); // Resolver rejected the revocation
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ► CORE PROTOCOL: Update Attestation
    // ═══════════════════════════════════════════════════════════════════════════

    // Update attestation
    attestation.revoked = true;
    attestation.revocation_time = Some(env.ledger().timestamp());

    // Store updated attestation
    env.storage().persistent().set(&attest_key, &attestation);

    // ═══════════════════════════════════════════════════════════════════════════
    // ► RESOLVER INTEGRATION: After Revoke Hook
    // ═══════════════════════════════════════════════════════════════════════════

    // Call resolver after_revoke hook if schema has a resolver
    if let Some(resolver_address) = &schema.resolver {
        // Create resolver attestation format with updated revocation status
        let resolver_attestation =
            create_resolver_attestation(env, &attestation, &schema_uid, &attestation.value);

        // Call after_revoke hook for side effects (cleanup, notifications, etc.)
        // Note: Failures here don't revert the revocation
        call_resolver_after_revoke(env, resolver_address, &resolver_attestation);
    }

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

        let attest_key = DataKey::Attestation(schema_uid.clone(), subject.clone(), nonce);

        if let Some(attestation) = env
            .storage()
            .persistent()
            .get::<DataKey, Attestation>(&attest_key)
        {
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
