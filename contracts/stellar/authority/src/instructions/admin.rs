use crate::errors::Error;
use crate::events;
use crate::state::{
    set_authority_data, set_registration_fee,
    RegisteredAuthorityData,
};
use soroban_sdk::{Address, Env, String};
// Import macros we actually use
use crate::require_owner;

// ══════════════════════════════════════════════════════════════════════════════
// ► Admin utility functions
// ══════════════════════════════════════════════════════════════════════════════

/// Get the admin address, returning an error if not initialized
pub fn get_admin(env: &Env) -> Result<Address, Error> {
    crate::state::get_admin(env).ok_or(Error::NotInitialized)
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
        ref_id: String::from_str(env, "admin_registered"), // Default ref_id for admin registrations
    };

    set_authority_data(env, &data);

    // Publish event
    events::admin_register_authority(env, auth_to_reg, metadata);

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

