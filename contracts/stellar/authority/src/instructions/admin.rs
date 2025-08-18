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
        // Validate schema rules
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
