use soroban_sdk::{
    Address, Bytes, BytesN, Env,
    contracttype,
    symbol_short,
    xdr::{ToXdr},
};

#[derive(Debug, Clone)]
#[contracttype]
pub struct Schema {
    pub uid: BytesN<32>, // Use BytesN<32> for fixed-size UIDs
    pub schema: soroban_sdk::String, // Explicitly use soroban_sdk::String
    pub resolver: Option<Address>,
    pub revocable: bool,
    pub authority: Address,
    pub levy: Option<Bytes>, // Store serialized Levy
}

#[derive(Debug, Clone)]
#[contracttype]
pub struct Levy {
    pub amount: i128, // Use i128 for amounts in Soroban
    pub asset: Address,
    pub recipient: Address,
}

pub fn register_schema(
    env: &Env,
    caller: Address, // Pass caller directly
    schema: soroban_sdk::String, // Explicitly use soroban_sdk::String
    resolver: Option<Address>, // Pass Option<Address> directly
    revocable: bool,
) -> Result<BytesN<32>, super::Error> { // Return super::Error
    caller.require_auth();

    // Generate unique uid using Keccak256 hash
    let mut data_to_hash = Bytes::new(env);
    data_to_hash.append(&caller.clone().to_xdr(env));
    data_to_hash.append(&schema.clone().to_xdr(env));
    if let Some(res) = &resolver {
        data_to_hash.append(&res.clone().to_xdr(env));
    }

    let uid: BytesN<32> = env.crypto().keccak256(&data_to_hash).into();

    // Create the schema object
    let schema_obj = Schema {
        uid: uid.clone(),
        schema: schema.clone(),
        resolver: resolver.clone(),
        revocable,
        authority: caller.clone(),
        levy: None, // Initialize levy as None
    };

    // Store the schema using the UID as the key
    // Use DataKey from the parent module (lib.rs)
    let data_key = super::DataKey::Schema(uid.clone());
    env.storage().instance().set(&data_key, &schema_obj);

    // Emit schema registration event
    env.events()
        .publish((symbol_short!("schema"), symbol_short!("register")), schema_obj);

    Ok(uid)
} 