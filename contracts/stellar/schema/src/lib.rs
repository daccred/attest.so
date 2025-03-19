#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

#[derive(Debug, Clone)]
pub struct Schema {
    pub uid: Vec<u8>,
    pub name: String,
    pub definition: String,
    pub resolver: Option<Address>,
    pub revocable: bool,
    pub authority: Address,
    pub levy: Option<Levy>,
}

#[derive(Debug, Clone)]
pub struct Levy {
    pub amount: u64,
    pub asset: Address,
    pub recipient: Address,
}

#[derive(Debug)]
pub struct Authority {
    pub address: Address,
    pub metadata: String,
}

pub trait SchemaContract {
    type Error;

    fn schema_created(schema: Schema);

    fn create_schema(
        name: String,
        definition: String,
        resolver: Option<Address>,
        revocable: bool,
        levy: Option<Levy>,
    ) -> Result<(), Self::Error>;
}

#[contract]
pub struct SchemaContractImpl;

#[contractimpl]
impl SchemaContract for SchemaContractImpl {
    type Error = String;

    fn schema_created(env: Env, schema: Schema) {
        env.emit().schema_created(schema);
    }

    fn create_schema(
        env: Env,
        name: String,
        definition: String,
        resolver: Option<Address>,
        revocable: bool,
        levy: Option<Levy>,
    ) -> Result<(), Self::Error> {
        // Ensure the caller is a registered authority
        let caller = env.caller();
        let authority = authorities(env, caller).expect("Caller is not a registered authority");

        // Generate a unique schema UID
        let uid = env.hash(&name);

        // Create the schema
        let schema = Schema {
            uid: uid.to_vec(),
            name,
            definition,
            resolver,
            revocable,
            authority: caller,
            levy,
        };

        // Store the schema
        schemas(env, uid).set(&schema)?;

        // Emit the SchemaCreated event
        env.emit().schema_created(schema.clone());

        // Checks if the caller is a registered authority
        fn authorities(env: Env, address: Address) -> Option<Authority> {
            env.storage().get(address)
        }

        Ok(())
    }
}

// Storage functions
fn schemas(env: Env, uid: Vec<u8>) -> Option<Schema> {
    env.storage().get(uid)
}
