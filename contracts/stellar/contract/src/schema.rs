use soroban_sdk::{
    contracttype, Address, Bytes, BytesN, Env,
    contracterror, symbol_short, String,
    xdr::ToXdr,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SchemaError {
    LimitReached = 1,
    // Add other potential schema-specific errors here
}

#[contracttype]
pub enum DataKey {
    Schema(BytesN<32>), // Use BytesN<32> for fixed-size UIDs
}

#[derive(Debug, Clone)]
#[contracttype]
pub struct Schema {
    pub uid: BytesN<32>, // Use BytesN<32> for fixed-size UIDs
    pub schema: String,
    pub resolver: Option<Address>,
    pub revocable: bool,
    pub authority: Address,
    pub levy: Option<Levy>,
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
    schema: String, // Pass String directly
    resolver: Option<Address>, // Pass Option<Address> directly
    revocable: bool,
) -> Result<BytesN<32>, SchemaError> {
    caller.require_auth();

    // Generate unique uid using Keccak256 hash
    // Combine relevant fields to ensure uniqueness. Example:
    let mut data_to_hash = Bytes::new(env);
    data_to_hash.append(&caller.clone().to_xdr(env));
    data_to_hash.append(&schema.clone().to_xdr(env));
    if let Some(res) = &resolver {
        data_to_hash.append(&res.clone().to_xdr(env));
    }
    // Consider adding env.ledger().timestamp() or sequence for more uniqueness if needed

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
    let data_key = DataKey::Schema(uid.clone());
    env.storage().instance().set(&data_key, &schema_obj);

    // Emit schema registration event
    env.events()
        .publish((symbol_short!("schema"), symbol_short!("register")), schema_obj);

    Ok(uid)
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events, Ledger, BytesN as _},
        Env,
    };

    #[test]
    fn test_schema_registration() {
        let env = Env::default();
        env.mock_all_auths();

        let caller = Address::generate(&env);
        let resolver = Address::generate(&env);

        let schema_str = String::from_str(&env, "test schema definition");
        let revocable = false;

        let uid = register_schema(
            &env,
            caller.clone(),
            schema_str.clone(),
            Some(resolver.clone()),
            revocable
        ).unwrap();

        // Verify event was published
        let events = env.events().all();
        assert_eq!(events.len(), 1);

        // Verify schema is stored
        let data_key = DataKey::Schema(uid.clone());
        let stored_schema: Schema = env.storage().instance().get(&data_key).unwrap();
        assert_eq!(stored_schema.uid, uid);
        assert_eq!(stored_schema.schema, schema_str);
        assert_eq!(stored_schema.authority, caller);
        assert_eq!(stored_schema.resolver, Some(resolver));
        assert_eq!(stored_schema.revocable, revocable);
    }
} 