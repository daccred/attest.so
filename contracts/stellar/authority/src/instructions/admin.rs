use crate::access_control;
use crate::errors::Error;
use crate::events;
use crate::state::{
    is_authority, set_authority_data, set_registration_fee, set_schema_rules,
    RegisteredAuthorityData, SchemaRules,
};
use soroban_sdk::{Address, BytesN, Env, String};
// Import macros we actually use
use crate::{admin_guard, require_owner};

// ══════════════════════════════════════════════════════════════════════════════
// ► Admin utility functions
// ══════════════════════════════════════════════════════════════════════════════

/// Get the admin address, returning an error if not initialized
pub fn get_admin(env: &Env) -> Result<Address, Error> {
    crate::state::get_admin(env).ok_or(Error::NotInitialized)
}

/// Requires authorization from the caller and checks if they are the admin.
/// Uses the new access_control module for consistency with OpenZeppelin patterns.
pub fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
    access_control::only_owner(env, caller)
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Admin Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Register an authority by the admin (no fee required)
pub fn admin_register_authority(
    env: &Env,
    admin: &Address,
    auth_to_reg: &Address,
    metadata: &String,
) -> Result<(), Error> {
    // Use macro for cleaner access control
    crate::admin_guard!(env, admin);

    let data = RegisteredAuthorityData {
        address: auth_to_reg.clone(),
        metadata: metadata.clone(),
        registration_time: env.ledger().timestamp(),
    };

    set_authority_data(env, &data);

    // Publish event
    events::admin_register_authority(env, auth_to_reg, metadata);

    Ok(())
}

/// Register a schema and its rules by the admin
pub fn admin_register_schema(
    env: &Env,
    admin: &Address,
    schema_uid: &BytesN<32>,
    rules: &SchemaRules,
) -> Result<(), Error> {
    // Use macro with custom validation
    crate::admin_guard!(env, admin, {
        // Validate legacy levy rules (backwards compatibility)
        if let Some(recipient) = &rules.levy_recipient {
            if rules.levy_amount.is_none() || rules.levy_amount.unwrap_or(0) <= 0 {
                return Err(Error::InvalidSchemaRules);
            }
            if !is_authority(env, recipient) {
                return Err(Error::RecipientNotAuthority);
            }
        } else if rules.levy_amount.is_some() && rules.levy_amount.unwrap() > 0 {
            return Err(Error::InvalidSchemaRules);
        }

        // Validate new token incentive rules
        if let Some(fee_recipient) = &rules.fee_recipient {
            if rules.attestation_fee.is_none() || rules.attestation_fee.unwrap_or(0) <= 0 {
                return Err(Error::InvalidSchemaRules);
            }
            if !is_authority(env, fee_recipient) {
                return Err(Error::RecipientNotAuthority);
            }
        } else if rules.attestation_fee.is_some() && rules.attestation_fee.unwrap() > 0 {
            return Err(Error::InvalidSchemaRules);
        }

        // Validate reward token configuration
        if let Some(_reward_token) = &rules.reward_token {
            if rules.reward_amount.is_none() || rules.reward_amount.unwrap_or(0) <= 0 {
                return Err(Error::InvalidSchemaRules);
            }
        } else if rules.reward_amount.is_some() && rules.reward_amount.unwrap() > 0 {
            return Err(Error::InvalidSchemaRules);
        }
    });

    set_schema_rules(env, schema_uid, rules);

    // Publish event
    events::schema_registered(env, schema_uid, rules);

    Ok(())
}

/// Simplified helper method for setting schema levy
pub fn admin_set_schema_levy(
    env: &Env,
    admin: &Address,
    schema_uid: &BytesN<32>,
    levy_amount: i128,
    levy_recipient: &Address,
) -> Result<(), Error> {
    // Use macro for cleaner access control
    crate::admin_guard!(env, admin);

    // Check if recipient is a valid authority
    if !is_authority(env, levy_recipient) {
        return Err(Error::RecipientNotAuthority);
    }

    // Create rules with the provided levy amount and recipient
    let rules = SchemaRules {
        levy_amount: Some(levy_amount),
        levy_recipient: Some(levy_recipient.clone()),
        attestation_fee: None,
        reward_token: None,
        reward_amount: None,
        fee_recipient: None,
        reward_token_name: None,
        reward_token_symbol: None,
        reward_token_max_supply: None,
        reward_token_decimals: None,
    };

    set_schema_rules(env, schema_uid, &rules);

    // Publish event
    events::schema_registered(env, schema_uid, &rules);

    Ok(())
}

/// Helper method for setting registration fee
pub fn admin_set_registration_fee(
    env: &Env,
    admin: &Address,
    fee_amount: &i128,
    token_id: &Address,
) -> Result<(), Error> {
    // Use macro for cleaner access control
    crate::admin_guard!(env, admin);

    // Store the registration fee amount
    set_registration_fee(env, fee_amount);

    // Store the token ID if different from the current one
    if token_id != &crate::state::get_token_id(env).ok_or(Error::NotInitialized)? {
        crate::state::set_token_id(env, token_id);
    }

    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Helper functions
// ══════════════════════════════════════════════════════════════════════════════

/// Returns Error::NotInitialized if the contract hasn't been initialized.
pub fn require_init(env: &Env) -> Result<(), Error> {
    if !crate::state::is_initialized(env) {
        Err(Error::NotInitialized)
    } else {
        Ok(())
    }
}

/// Gets the token contract ID
pub fn get_token_id(env: &Env) -> Result<Address, Error> {
    crate::state::get_token_id(env).ok_or(Error::NotInitialized)
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Token Incentive Admin Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Set XLM attestation fee and fee recipient for a schema
pub fn admin_set_schema_fee(
    env: &Env,
    admin: &Address,
    schema_uid: &BytesN<32>,
    attestation_fee: i128,
    fee_recipient: &Address,
) -> Result<(), Error> {
    crate::admin_guard!(env, admin, {
        if attestation_fee <= 0 {
            return Err(Error::InvalidSchemaRules);
        }
        if !is_authority(env, fee_recipient) {
            return Err(Error::RecipientNotAuthority);
        }
    });

    // Get existing rules or create new ones
    let mut rules = crate::state::get_schema_rules(env, schema_uid).unwrap_or(SchemaRules {
        levy_amount: None,
        levy_recipient: None,
        attestation_fee: None,
        reward_token: None,
        reward_amount: None,
        fee_recipient: None,
        reward_token_name: None,
        reward_token_symbol: None,
        reward_token_max_supply: None,
        reward_token_decimals: None,
    });

    // Update fee configuration
    rules.attestation_fee = Some(attestation_fee);
    rules.fee_recipient = Some(fee_recipient.clone());

    crate::state::set_schema_rules(env, schema_uid, &rules);

    // Publish event
    events::schema_registered(env, schema_uid, &rules);

    Ok(())
}

/// Set reward token and amount for a schema
pub fn admin_set_schema_rewards(
    env: &Env,
    admin: &Address,
    schema_uid: &BytesN<32>,
    reward_token: &Address,
    reward_amount: i128,
) -> Result<(), Error> {
    crate::admin_guard!(env, admin, {
        if reward_amount <= 0 {
            return Err(Error::InvalidSchemaRules);
        }
    });

    // Get existing rules or create new ones
    let mut rules = crate::state::get_schema_rules(env, schema_uid).unwrap_or(SchemaRules {
        levy_amount: None,
        levy_recipient: None,
        attestation_fee: None,
        reward_token: None,
        reward_amount: None,
        fee_recipient: None,
        reward_token_name: None,
        reward_token_symbol: None,
        reward_token_max_supply: None,
        reward_token_decimals: None,
    });

    // Update reward configuration
    rules.reward_token = Some(reward_token.clone());
    rules.reward_amount = Some(reward_amount);

    crate::state::set_schema_rules(env, schema_uid, &rules);

    // Publish event
    events::schema_registered(env, schema_uid, &rules);

    Ok(())
}

/// Create schema with automatic token deployment and rewards
pub fn admin_create_schema_with_token(
    env: &Env,
    admin: &Address,
    schema_uid: &BytesN<32>,
    attestation_fee: Option<i128>,
    fee_recipient: Option<&Address>,
    reward_amount: i128,
    token_name: Option<&String>,
    token_symbol: Option<&String>,
    max_supply: Option<i128>,
    decimals: Option<u32>,
) -> Result<Address, Error> {
    crate::admin_guard!(env, admin, {
        if reward_amount <= 0 {
            return Err(Error::InvalidSchemaRules);
        }
        
        // Validate fee configuration if provided
        if let (Some(fee), Some(recipient)) = (attestation_fee, fee_recipient) {
            if fee <= 0 {
                return Err(Error::InvalidSchemaRules);
            }
            if !is_authority(env, recipient) {
                return Err(Error::RecipientNotAuthority);
            }
        }
    });

    // Generate default token name and symbol if not provided
    let final_token_name = match token_name {
        Some(name) => name.clone(),
        None => crate::token_factory::generate_default_token_name(env, schema_uid),
    };
    
    let final_token_symbol = match token_symbol {
        Some(symbol) => symbol.clone(),
        None => crate::token_factory::generate_default_token_symbol(env, schema_uid),
    };

    let final_decimals = decimals.unwrap_or(7); // Standard Stellar decimals

    // Deploy the reward token
    let token_address = crate::token_factory::deploy_schema_token(
        env,
        schema_uid,
        &final_token_name,
        &final_token_symbol,
        final_decimals,
        max_supply,
    )?;

    // Create schema rules with deployed token
    let rules = SchemaRules {
        levy_amount: None,
        levy_recipient: None,
        attestation_fee,
        reward_token: Some(token_address.clone()),
        reward_amount: Some(reward_amount),
        fee_recipient: fee_recipient.cloned(),
        reward_token_name: Some(final_token_name),
        reward_token_symbol: Some(final_token_symbol),
        reward_token_max_supply: max_supply,
        reward_token_decimals: Some(final_decimals),
    };

    // Store schema rules
    crate::state::set_schema_rules(env, schema_uid, &rules);

    // Publish event
    events::schema_registered(env, schema_uid, &rules);

    Ok(token_address)
}
