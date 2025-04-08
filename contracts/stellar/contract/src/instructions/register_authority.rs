use soroban_sdk::{Address, Env, String as SorobanString};
use crate::state::{DataKey, Authority};
use crate::errors::Error;
use crate::events;
use crate::utils;

pub fn register_authority(
    env: &Env,
    admin: Address, // Assuming admin calls this
    auth_to_reg: Address,
    metadata: SorobanString,
) -> Result<(), Error> {
    admin.require_auth(); // Only admin can register authorities

    // Optional: Check if admin is the stored admin, though require_auth() might suffice
    let stored_admin = utils::get_admin(env).ok_or(Error::NotInitialized)?;
    if admin != stored_admin {
        return Err(Error::NotAuthorized);
    }

    let authority_data = Authority {
        address: auth_to_reg.clone(),
        metadata,
    };
    let key = DataKey::Authority(auth_to_reg);
    env.storage().instance().set(&key, &authority_data);

    events::publish_authority_registration_event(env, &authority_data);

    Ok(())
} 