use crate::errors::Error;
use crate::events;
use crate::instructions::admin::{get_token_id, require_init};
use crate::state::{
    get_collected_levy, get_schema_rules, is_authority, remove_collected_levy, set_authority_data,
    set_collected_levy, update_collected_fees, update_collected_levy, Attestation,
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
    };

    set_authority_data(env, &data);

    events::authority_registered(env, caller, authority_to_reg, metadata);

    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Attestation & Revocation Hook Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Attestation hook for verifying authority and collecting levies
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

    // Get schema rules
    let rules = get_schema_rules(env, &attestation.schema_uid).ok_or_else(|| {
        log!(
            env,
            "Attest hook: Schema {:?} not registered.",
            attestation.schema_uid
        );
        Error::SchemaNotRegistered
    })?;

    // Handle legacy levy system (backwards compatibility)
    if let (Some(amount), Some(recipient)) = (rules.levy_amount, rules.levy_recipient) {
        if amount > 0 {
            log!(
                env,
                "Attest hook: Legacy levy of {} applies for schema {:?} to recipient {}",
                amount,
                attestation.schema_uid,
                recipient
            );

            // Transfer levy from attester to contract
            let token_id = get_token_id(env)?;
            let token_client = token::Client::new(env, &token_id);

            token_client.transfer(
                &attestation.attester,
                &env.current_contract_address(),
                &amount,
            );

            // Update levy balance for recipient
            update_collected_levy(env, &recipient, &amount);

            // Publish levy collected event
            events::levy_collected(
                env,
                &attestation.attester,
                &recipient,
                &attestation.schema_uid,
                amount,
            );

            log!(
                env,
                "Attest hook: Legacy levy collected. New balance for {}: {}",
                recipient,
                get_collected_levy(env, &recipient)
            );
        }
    }

    // Handle new XLM fee collection
    if let (Some(fee_amount), Some(fee_recipient)) = (rules.attestation_fee, rules.fee_recipient) {
        if fee_amount > 0 {
            log!(
                env,
                "Attest hook: XLM fee of {} stroops applies for schema {:?} to authority {}",
                fee_amount,
                attestation.schema_uid,
                fee_recipient
            );

            // Transfer XLM fee from attester to contract (using native XLM)
            // Note: This requires the contract to have XLM allowance from the attester
            // For now, we'll use the token system but in production this should be native XLM
            let token_id = get_token_id(env)?;
            let token_client = token::Client::new(env, &token_id);

            token_client.transfer(
                &attestation.attester,
                &env.current_contract_address(),
                &fee_amount,
            );

            // Update fee balance for the authority
            update_collected_fees(env, &fee_recipient, &fee_amount);

            log!(
                env,
                "Attest hook: XLM fee collected for authority {}",
                fee_recipient
            );
        }
    }

    // Handle reward token distribution
    if let (Some(reward_token), Some(reward_amount)) = (rules.reward_token, rules.reward_amount) {
        if reward_amount > 0 {
            log!(
                env,
                "Attest hook: Distributing {} reward tokens to attester {}",
                reward_amount,
                attestation.attester
            );

            // Mint/transfer reward tokens to the attester
            let reward_token_client = token::Client::new(env, &reward_token);

            // Try to transfer from contract to attester
            // Note: This assumes the contract has sufficient reward tokens
            // In production, this might need to mint new tokens
            reward_token_client.transfer(
                &env.current_contract_address(),
                &attestation.attester,
                &reward_amount,
            );

            log!(
                env,
                "Attest hook: Reward tokens distributed to attester {}",
                attestation.attester
            );
        }
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
