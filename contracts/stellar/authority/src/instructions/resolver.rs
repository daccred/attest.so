use soroban_sdk::{token, Address, Env, String, log};
use crate::errors::Error;
use crate::state::{
    AttestationRecord, RegisteredAuthorityData, is_authority, get_schema_rules, 
    get_collected_levy, set_collected_levy, remove_collected_levy,
    update_collected_levy, set_authority_data
};
use crate::events;
use crate::instructions::admin::{require_init, get_token_id};

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
    let token_client = token::Client::new(&env, &token_id);

    token_client.transfer(
        &caller,
        &env.current_contract_address(),
        &REGISTRATION_FEE
    );

    let data = RegisteredAuthorityData {
        address: authority_to_reg.clone(),
        metadata: metadata.clone(),
        registration_time: env.ledger().timestamp(),
    };

    set_authority_data(env, &data);

    events::authority_registered(env, caller, authority_to_reg, metadata);

    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Attestation & Revocation Hook Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Attestation hook for verifying authority and collecting levies
pub fn attest(env: &Env, attestation: &AttestationRecord) -> Result<bool, Error> {
    require_init(env)?;
    if !is_authority(env, &attestation.attester) {
        log!(env, "Attest hook: {} is NOT an authority.", attestation.attester);
        return Err(Error::AttesterNotAuthority);
    }

    // Get schema rules
    let rules = get_schema_rules(env, &attestation.schema_uid)
        .ok_or_else(|| {
            log!(env, "Attest hook: Schema {:?} not registered.", attestation.schema_uid);
            Error::SchemaNotRegistered
        })?;

    // Check if levy should be collected
    if let (Some(amount), Some(recipient)) = (rules.levy_amount, rules.levy_recipient) {
        if amount > 0 {
            log!(
                env,
                "Attest hook: Levy of {} applies for schema {:?} to recipient {}",
                amount, attestation.schema_uid, recipient
            );

            // Transfer levy from attester to contract
            let token_id = get_token_id(env)?;
            let token_client = token::Client::new(&env, &token_id);

            token_client.transfer(
                &attestation.attester,
                &env.current_contract_address(),
                &amount
            );

            // Update levy balance for recipient
            update_collected_levy(env, &recipient, &amount);

            // Publish levy collected event
            events::levy_collected(env, &attestation.attester, &recipient, &attestation.schema_uid, amount);

            log!(env, "Attest hook: Levy collected. New balance for {}: {}", 
                recipient, get_collected_levy(env, &recipient));
        }
    }

    log!(env, "Attest hook: Authority {} authorized for schema {:?}", 
        attestation.attester, attestation.schema_uid);
    Ok(true)
}

/// Revocation hook for verifying authority
pub fn revoke(env: &Env, attestation: &AttestationRecord) -> Result<bool, Error> {
    require_init(env)?;
    if is_authority(env, &attestation.attester) {
        log!(env, "Revoke hook: Authority {} authorized for schema {:?}", 
            attestation.attester, attestation.schema_uid);
        Ok(true)
    } else {
         log!(env, "Revoke hook: {} is NOT an authority.", attestation.attester);
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
        log!(env, "Withdrawal attempt by {}: No balance to withdraw.", caller);
        return Err(Error::NothingToWithdraw);
    }

    log!(env, "Attempting withdrawal for {}: amount {}", caller, balance);

    let token_id = get_token_id(env)?;
    let token_client = token::Client::new(&env, &token_id);

    // Reset balance before transfer to prevent reentrancy issues
    set_collected_levy(env, caller, &0i128);

    token_client.transfer(
        &env.current_contract_address(),
        &caller,
        &balance
    );

    // Remove the storage entry completely to save space
    remove_collected_levy(env, caller);

    // Publish withdrawal event
    events::levy_withdrawn(env, caller, balance);

    log!(env, "Withdrawal successful for {}: amount {}", caller, balance);
    Ok(())
} 