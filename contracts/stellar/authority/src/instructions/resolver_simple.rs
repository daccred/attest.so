use crate::errors::Error;
use crate::events;
use crate::instructions::admin_simple::require_init;
use crate::state::{
    set_authority_data, Attestation, RegisteredAuthorityData,
    get_registration_fee,
};
use soroban_sdk::{Address, Env, String};

// ══════════════════════════════════════════════════════════════════════════════
// ► Simplified Public Registration (No Legacy Levy System)
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

    let registration_fee = get_registration_fee(env).unwrap_or(100_0000000);

    // Note: In a real implementation, you'd collect the registration fee here
    // For now, this is just a placeholder since the fee collection logic
    // should be handled by a resolver

    let data = RegisteredAuthorityData {
        address: authority_to_reg.clone(),
        metadata: metadata.clone(),
        registration_time: env.ledger().timestamp(),
        verification_level: 1, // Public registration gets basic level
        verified_by: caller.clone(), // Self-verified through payment
        verification_data: None, // No additional data for public registration
    };

    set_authority_data(env, &data);

    events::authority_registered(env, caller, authority_to_reg, metadata);

    Ok(())
}