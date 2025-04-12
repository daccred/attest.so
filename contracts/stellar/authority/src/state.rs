use soroban_sdk::{
    contracttype, Bytes, BytesN, Address, Env, String
};

// ══════════════════════════════════════════════════════════════════════════════
// ► Contract Data Structures
// ══════════════════════════════════════════════════════════════════════════════
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct AttestationRecord {
    pub uid: BytesN<32>,
    pub schema_uid: BytesN<32>,
    pub recipient: Address,
    pub attester: Address,
    pub time: u64,
    pub expiration_time: Option<u64>,
    pub revocable: bool,
    pub ref_uid: Option<Bytes>,
    pub data: Bytes,
    pub value: Option<i128>,
}

/// Data stored for an authority registered by the admin.
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct RegisteredAuthorityData {
    pub address: Address,
    pub metadata: String,
    pub registration_time: u64,
}

/// Data stored for schema levy information.
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct SchemaRules {
    pub levy_amount: Option<i128>,
    pub levy_recipient: Option<Address>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    TokenId,
    RegistrationFee,
    Initialized,
    RegAuthPrefix,
    SchemaRulePrefix,
    CollLevyPrefix,
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Storage Helper Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Reads the admin address from storage.
pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}

/// Writes the admin address to storage.
pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

/// Reads the token contract ID from storage.
pub fn get_token_id(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::TokenId)
}

/// Writes the token contract ID to storage.
pub fn set_token_id(env: &Env, token_id: &Address) {
    env.storage().instance().set(&DataKey::TokenId, token_id);
}

/// Reads the registration fee from storage.
pub fn get_registration_fee(env: &Env) -> Option<i128> {
    env.storage().instance().get(&DataKey::RegistrationFee)
}

/// Writes the registration fee to storage.
pub fn set_registration_fee(env: &Env, fee: &i128) {
    env.storage().instance().set(&DataKey::RegistrationFee, fee);
}

/// Reads authority data from storage using a composite key.
pub fn get_authority_data(env: &Env, authority: &Address) -> Option<RegisteredAuthorityData> {
    let key = (DataKey::RegAuthPrefix, authority.clone());
    env.storage().persistent().get(&key)
}

/// Writes authority data to storage with appropriate TTL using a composite key.
pub fn set_authority_data(env: &Env, data: &RegisteredAuthorityData) {
    let key = (DataKey::RegAuthPrefix, data.address.clone());
    env.storage().persistent().set(&key, data);
    env.storage().persistent().extend_ttl(
        &key,
        env.storage().max_ttl() - 100,
        env.storage().max_ttl(),
    );
}

/// Reads schema rules from storage using a composite key.
pub fn get_schema_rules(env: &Env, schema_uid: &BytesN<32>) -> Option<SchemaRules> {
    let key = (DataKey::SchemaRulePrefix, schema_uid.clone());
    env.storage().persistent().get(&key)
}

/// Writes schema rules to storage with appropriate TTL using a composite key.
pub fn set_schema_rules(env: &Env, schema_uid: &BytesN<32>, rules: &SchemaRules) {
    let key = (DataKey::SchemaRulePrefix, schema_uid.clone());
    env.storage().persistent().set(&key, rules);
    env.storage().persistent().extend_ttl(
        &key,
        env.storage().max_ttl() - 100,
        env.storage().max_ttl(),
    );
}

/// Gets the collected levy balance for a recipient using a composite key.
pub fn get_collected_levy(env: &Env, recipient: &Address) -> i128 {
    let key = (DataKey::CollLevyPrefix, recipient.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

/// Sets the collected levy balance for a recipient using a composite key.
pub fn set_collected_levy(env: &Env, recipient: &Address, amount: &i128) {
    let key = (DataKey::CollLevyPrefix, recipient.clone());
    env.storage().persistent().set(&key, amount);
    env.storage().persistent().extend_ttl(
        &key,
        env.storage().max_ttl() - 100,
        env.storage().max_ttl(),
    );
}

/// Removes the collected levy balance for a recipient using a composite key.
pub fn remove_collected_levy(env: &Env, recipient: &Address) {
    let key = (DataKey::CollLevyPrefix, recipient.clone());
    env.storage().persistent().remove(&key);
}

/// Updates (increments) the collected levy balance for a recipient.
pub fn update_collected_levy(env: &Env, recipient: &Address, additional_amount: &i128) {
    let current = get_collected_levy(env, recipient);
    let new_amount = current.checked_add(*additional_amount).expect("Levy balance overflow");
    set_collected_levy(env, recipient, &new_amount);
}

/// Sets the initialized flag.
pub fn set_initialized(env: &Env) {
    env.storage().instance().set(&DataKey::Initialized, &true);
}

pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Initialized)
}

pub fn is_authority(env: &Env, authority: &Address) -> bool {
    let key = (DataKey::RegAuthPrefix, authority.clone());
    env.storage().persistent().has(&key)
} 