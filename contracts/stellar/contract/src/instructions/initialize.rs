use soroban_sdk::{Address, Env};
use crate::state::DataKey;
use crate::errors::Error;

pub fn initialize(env: &Env, admin: Address) -> Result<(), Error> {
    if env.storage().instance().has(&DataKey::Admin) {
        return Err(Error::AlreadyInitialized);
    }
    env.storage().instance().set(&DataKey::Admin, &admin);
    Ok(())
} 