#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};

pub trait AuthorityContract {
    type Error;

    fn authority_registered(address: Address, metadata: String);

    fn register_authority(metadata: String) -> Result<(), Self::Error>;
}

#[contract]
pub struct AuthorityContractImpl;

#[contractimpl]
impl AuthorityContract for AuthorityContractImpl {
    type Error = String;

    fn authority_registered(env: Env, address: Address, metadata: String) {
        env.emit()
            .authority_registered(Authority { address, metadata });
    }

    fn register_authority(env: Env, metadata: String) -> Result<(), Self::Error> {
        let caller = env.caller();
        let authority = Authority {
            address: caller,
            metadata,
        };

        env.storage().set(caller, &authority)?;
        env.storage().set(
            b"authorities_count",
            &authorities_count(env).unwrap_or_default() + 1,
        )?;

        env.emit().authority_registered(caller, metadata.clone());

        Ok(())
    }
}

#[derive(Debug)]
pub struct Authority {
    pub address: Address,
    pub metadata: String,
}

fn authorities_count(env: Env) -> u64 {
    env.storage()
        .get::<u64>(b"authorities_count")
        .unwrap_or_default()
}
