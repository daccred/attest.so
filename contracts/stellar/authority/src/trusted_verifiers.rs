#![no_std]

use soroban_sdk::{contracttype, Address, Env, String};
use crate::errors::Error;
use crate::state::DataKey;

/// Trusted verifier structure (similar to SAS credential issuer model)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TrustedVerifier {
    pub address: Address,
    pub max_verification_level: u8,
    pub verifier_type: String,  // "KYC_Provider", "Business_Registry", "Domain_Verifier"
    pub active: bool,
    pub added_by: Address,
    pub added_time: u64,
    pub verifications_count: u64,
}

/// Verification levels that verifiers can grant
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum VerificationLevel {
    Basic = 1,      // Basic verification - email/domain
    Enhanced = 2,   // Enhanced verification - business registration
    Premium = 3,    // Premium verification - full KYC/AML
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Trusted Verifier Storage Functions
// ══════════════════════════════════════════════════════════════════════════════

pub fn set_trusted_verifier(env: &Env, verifier: &Address, data: &TrustedVerifier) {
    let key = (DataKey::TrustedVerifier, verifier.clone());
    env.storage().persistent().set(&key, data);
    env.storage().persistent().extend_ttl(&key, env.storage().max_ttl() - 100, env.storage().max_ttl());
}

pub fn get_trusted_verifier(env: &Env, verifier: &Address) -> Option<TrustedVerifier> {
    let key = (DataKey::TrustedVerifier, verifier.clone());
    env.storage().persistent().get(&key)
}

pub fn remove_trusted_verifier(env: &Env, verifier: &Address) {
    let key = (DataKey::TrustedVerifier, verifier.clone());
    env.storage().persistent().remove(&key);
}

pub fn is_trusted_verifier(env: &Env, verifier: &Address) -> bool {
    get_trusted_verifier(env, verifier)
        .map(|v| v.active)
        .unwrap_or(false)
}

pub fn increment_verifier_count(env: &Env, verifier: &Address) -> Result<(), Error> {
    let mut verifier_data = get_trusted_verifier(env, verifier)
        .ok_or(Error::UnauthorizedVerifier)?;
    
    verifier_data.verifications_count += 1;
    set_trusted_verifier(env, verifier, &verifier_data);
    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Verifier Management Functions
// ══════════════════════════════════════════════════════════════════════════════

pub fn add_verifier(
    env: &Env,
    verifier: &Address,
    max_level: u8,
    verifier_type: &String,
    added_by: &Address,
) -> Result<(), Error> {
    if max_level < 1 || max_level > 3 {
        return Err(Error::InvalidVerificationLevel);
    }

    let verifier_data = TrustedVerifier {
        address: verifier.clone(),
        max_verification_level: max_level,
        verifier_type: verifier_type.clone(),
        active: true,
        added_by: added_by.clone(),
        added_time: env.ledger().timestamp(),
        verifications_count: 0,
    };

    set_trusted_verifier(env, verifier, &verifier_data);
    Ok(())
}

pub fn deactivate_verifier(env: &Env, verifier: &Address) -> Result<(), Error> {
    let mut verifier_data = get_trusted_verifier(env, verifier)
        .ok_or(Error::VerifierNotFound)?;
    
    verifier_data.active = false;
    set_trusted_verifier(env, verifier, &verifier_data);
    Ok(())
}

pub fn update_verifier_level(
    env: &Env,
    verifier: &Address,
    new_max_level: u8,
) -> Result<(), Error> {
    if new_max_level < 1 || new_max_level > 3 {
        return Err(Error::InvalidVerificationLevel);
    }

    let mut verifier_data = get_trusted_verifier(env, verifier)
        .ok_or(Error::VerifierNotFound)?;
    
    verifier_data.max_verification_level = new_max_level;
    set_trusted_verifier(env, verifier, &verifier_data);
    Ok(())
}

pub fn validate_verifier_authority(
    env: &Env,
    verifier: &Address,
    requested_level: u8,
) -> Result<(), Error> {
    let verifier_data = get_trusted_verifier(env, verifier)
        .ok_or(Error::UnauthorizedVerifier)?;

    if !verifier_data.active {
        return Err(Error::VerifierInactive);
    }

    if requested_level > verifier_data.max_verification_level {
        return Err(Error::ExceedsVerificationLevel);
    }

    Ok(())
}