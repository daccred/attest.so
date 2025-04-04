#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Bytes, Env, String,
};

#[derive(Debug)]
pub struct Authority {
    pub address: Address,
    pub metadata: String,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    LimitReached = 1,
}

#[contracttype]
pub enum DataKey {
    MyKey,
}

#[derive(Debug, Clone)]
#[contracttype]
pub struct Schema {
    uid: Bytes,
    schema: String,
    resolver: Option<Address>,
    revocable: bool,
}

#[derive(Debug, Clone)]
#[contracttype]
pub struct Levy {
    pub amount: u64,
    pub asset: Address,
    pub recipient: Address,
}

#[contract]
pub struct SchemaContract;

#[contractimpl]
impl SchemaContract {
    pub fn register(
        env: Env,
        caller: Address,
        schema: String,
        resolver: Option<Address>,
        revocable: bool,
    ) -> Result<(), Error> {
        caller.require_auth();

        // generate unique uid with caller, schema and resolver
        let slice = &mut [0u8; 32];
        schema.copy_into_slice(slice);
        caller.to_string().copy_into_slice(slice);
        if let Some(address) = &resolver {
            address.to_string().copy_into_slice(slice);
        }
        let uid = env.crypto().keccak256(&Bytes::from_slice(&env, slice));

        // Create the schema
        let schema = Schema {
            uid: uid.to_bytes().try_into().unwrap(), // remove unwrap
            schema,
            resolver,
            revocable,
        };

        env.storage().instance().set(&DataKey::MyKey, &schema);

        env.events()
            .publish((symbol_short!("schema"), symbol_short!("register")), schema);

        Ok(())
    }
}
mod test;
