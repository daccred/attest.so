use crate::access_control;
use crate::errors::Error;
use crate::events;
use crate::state::{
    set_authority_data,
    RegisteredAuthorityData,
};
use soroban_sdk::{Address, Env, String};

// ══════════════════════════════════════════════════════════════════════════════
// ► Simplified Admin Functions (Phone Book Only)
// ══════════════════════════════════════════════════════════════════════════════

/// Register an authority by the admin (no fee required)
pub fn admin_register_authority(
    env: &Env,
    admin: &Address,
    auth_to_reg: &Address,
    metadata: &String,
) -> Result<(), Error> {
    access_control::only_owner(env, admin)?;

    let data = RegisteredAuthorityData {
        address: auth_to_reg.clone(),
        metadata: metadata.clone(),
        registration_time: env.ledger().timestamp(),
        ref_id: String::from_str(env, "admin-direct"), // Admin direct registration
    };

    set_authority_data(env, &data);

    // Publish event
    events::admin_register_authority(env, auth_to_reg, metadata);

    Ok(())
}

/// Basic init check
pub fn require_init(env: &Env) -> Result<(), Error> {
    if !crate::state::is_initialized(env) {
        return Err(Error::NotInitialized);
    }
    Ok(())
}