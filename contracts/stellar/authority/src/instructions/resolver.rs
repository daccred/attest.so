use crate::errors::Error;
use crate::events;
use crate::instructions::admin::{get_token_id, require_init};
use crate::state::{
    get_collected_levy, is_authority, remove_collected_levy, set_authority_data,
    set_collected_levy, Attestation,
    RegisteredAuthorityData,
};
use soroban_sdk::{log, token, Address, Env, String};

// ══════════════════════════════════════════════════════════════════════════════
// ► Public Authority Registration
// ══════════════════════════════════════════════════════════════════════════════

/// Register an authority by paying the registration fee
pub fn register_authority(
    env: &Env,
    caller: &Address,
    authority_to_reg: &Address,
    metadata: &String,
) -> Result<(), Error> {
    require_init(env)?;
    caller.require_auth();

    const REGISTRATION_FEE: i128 = 100_0000000; // 100 XLM in stroops

    let token_id = get_token_id(env)?;
    let token_client = token::Client::new(env, &token_id);

    token_client.transfer(caller, &env.current_contract_address(), &REGISTRATION_FEE);

    let data = RegisteredAuthorityData {
        address: authority_to_reg.clone(),
        metadata: metadata.clone(),
        registration_time: env.ledger().timestamp(),
        ref_id: String::from_str(env, "public_registration"), // Default ref_id for public registrations
    };

    set_authority_data(env, &data);

    events::authority_registered(env, caller, authority_to_reg, metadata);

    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Attestation & Revocation Hook Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Attestation hook for verifying authority
pub fn attest(env: &Env, attestation: &Attestation) -> Result<bool, Error> {
    require_init(env)?;
    if !is_authority(env, &attestation.attester) {
        log!(
            env,
            "Attest hook: {} is NOT an authority.",
            attestation.attester
        );
        return Err(Error::AttesterNotAuthority);
    }

    log!(
        env,
        "Attest hook: Authority {} authorized for schema {:?}",
        attestation.attester,
        attestation.schema_uid
    );
    Ok(true)
}

/// Revocation hook for verifying authority
pub fn revoke(env: &Env, attestation: &Attestation) -> Result<bool, Error> {
    require_init(env)?;
    if is_authority(env, &attestation.attester) {
        log!(
            env,
            "Revoke hook: Authority {} authorized for schema {:?}",
            attestation.attester,
            attestation.schema_uid
        );
        Ok(true)
    } else {
        log!(
            env,
            "Revoke hook: {} is NOT an authority.",
            attestation.attester
        );
        Err(Error::AttesterNotAuthority)
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Levy Withdrawal
// ══════════════════════════════════════════════════════════════════════════════

/// Withdraw collected levies for a recipient
pub fn withdraw_levies(env: &Env, caller: &Address) -> Result<(), Error> {
    require_init(env)?;
    caller.require_auth();
    if !is_authority(env, caller) {
        log!(env, "Withdrawal attempt by non-authority: {}", caller);
        return Err(Error::NotAuthorized);
    }

    let balance = get_collected_levy(env, caller);

    if balance <= 0 {
        log!(
            env,
            "Withdrawal attempt by {}: No balance to withdraw.",
            caller
        );
        return Err(Error::NothingToWithdraw);
    }

    log!(
        env,
        "Attempting withdrawal for {}: amount {}",
        caller,
        balance
    );

    let token_id = get_token_id(env)?;
    let token_client = token::Client::new(env, &token_id);

    // Reset balance before transfer to prevent reentrancy issues
    set_collected_levy(env, caller, &0i128);

    token_client.transfer(&env.current_contract_address(), caller, &balance);

    // Remove the storage entry completely to save space
    remove_collected_levy(env, caller);

    // Publish withdrawal event
    events::levy_withdrawn(env, caller, balance);

    log!(
        env,
        "Withdrawal successful for {}: amount {}",
        caller,
        balance
    );
    Ok(())
}

/// Withdraw collected XLM fees for an authority
pub fn withdraw_fees(env: &Env, caller: &Address) -> Result<(), Error> {
    require_init(env)?;
    caller.require_auth();
    if !is_authority(env, caller) {
        log!(env, "Fee withdrawal attempt by non-authority: {}", caller);
        return Err(Error::NotAuthorized);
    }

    let balance = crate::state::get_collected_fees(env, caller);

    if balance <= 0 {
        log!(
            env,
            "Fee withdrawal attempt by {}: No balance to withdraw.",
            caller
        );
        return Err(Error::NothingToWithdraw);
    }

    log!(
        env,
        "Attempting fee withdrawal for authority {}: amount {}",
        caller,
        balance
    );

    let token_id = get_token_id(env)?;
    let token_client = token::Client::new(env, &token_id);

    // Reset balance before transfer to prevent reentrancy issues
    set_collected_levy(env, caller, &0i128);

    token_client.transfer(&env.current_contract_address(), caller, &balance);

    // Remove the storage entry completely to save space
    remove_collected_levy(env, caller);

    // Publish withdrawal event (reuse levy_withdrawn event for now)
    events::levy_withdrawn(env, caller, balance);

    log!(
        env,
        "Fee withdrawal successful for authority {}: amount {}",
        caller,
        balance
    );
    Ok(())
}
