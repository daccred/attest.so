use soroban_sdk::{contracttype, Address, Bytes, BytesN, Env, String};

// ══════════════════════════════════════════════════════════════════════════════
// ► Contract Data Structures
// ══════════════════════════════════════════════════════════════════════════════
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct Attestation {
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

/// Payment record for organizations that paid the verification fee
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct PaymentRecord {
    pub recipient: Address,      // wallet address that paid
    pub timestamp: u64,          // timestamp of payment
    pub ref_id: String,          // their org data_uid on our platform
    pub amount_paid: i128,       // amount paid in stroops
}

/// Data stored for an authority that paid for verification
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct RegisteredAuthorityData {
    pub address: Address,
    pub metadata: String,
    pub registration_time: u64,
    pub ref_id: String,          // reference to their org data on platform
}



#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Initialized,
    RegistrationFee,
    PaymentRecord,      // Payment ledger entries
    Authority,          // Registered authorities (post-payment)
    TokenId,           // Token contract ID
    TokenWasmHash,     // Token WASM hash
    CollectedLevies,   // Collected levies per authority
    CollectedFees,     // Collected fees per authority
    RegAuthPrefix,     // Legacy prefix for registered authorities
    CollLevyPrefix,    // Prefix for collected levies
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


/// Writes the registration fee to storage.
pub fn set_registration_fee(env: &Env, fee: &i128) {
    env.storage().instance().set(&DataKey::RegistrationFee, fee);
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Payment Ledger Functions
// ══════════════════════════════════════════════════════════════════════════════

/// **CRITICAL BUSINESS FUNCTION**: Records payment in immutable ledger for access control
pub fn record_payment(env: &Env, payment: &PaymentRecord) {
    let key = (DataKey::PaymentRecord, payment.recipient.clone());
    env.storage().persistent().set(&key, payment);
    env.storage().persistent().extend_ttl(
        &key,
        env.storage().max_ttl() - 100,
        env.storage().max_ttl(),
    );
}

/// Gets a payment record for an address
pub fn get_payment_record(env: &Env, payer: &Address) -> Option<PaymentRecord> {
    let key = (DataKey::PaymentRecord, payer.clone());
    env.storage().persistent().get(&key)
}

/// Gets the registration fee from storage
pub fn get_registration_fee(env: &Env) -> Option<i128> {
    env.storage().instance().get(&DataKey::RegistrationFee)
}

/// **CRITICAL ACCESS CONTROL FUNCTION**: Validates payment eligibility for attestations
pub fn has_confirmed_payment(env: &Env, payer: &Address) -> bool {
    get_payment_record(env, payer).is_some()
}

/// Reads authority data from storage using a composite key.
pub fn get_authority_data(env: &Env, authority: &Address) -> Option<RegisteredAuthorityData> {
    let key = (DataKey::Authority, authority.clone());
    env.storage().persistent().get(&key)
}
/// Writes authority data to storage with appropriate TTL using a composite key.
pub fn set_authority_data(env: &Env, data: &RegisteredAuthorityData) {
    let key = (DataKey::Authority, data.address.clone());
    env.storage().persistent().set(&key, data);
    env.storage().persistent().extend_ttl(
        &key,
        env.storage().max_ttl() - 100,
        env.storage().max_ttl(),
    );
}


/// Sets the initialized flag.
pub fn set_initialized(env: &Env) {
    env.storage().instance().set(&DataKey::Initialized, &true);
}

pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Initialized)
}

pub fn is_authority(env: &Env, authority: &Address) -> bool {
    let key = (DataKey::Authority, authority.clone());
    env.storage().persistent().has(&key)
}


/// Get collected levy amount for an authority
pub fn get_collected_levy(env: &Env, authority: &Address) -> i128 {
    let key = (DataKey::CollectedLevies, authority.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

/// Set collected levy amount for an authority
pub fn set_collected_levy(env: &Env, authority: &Address, amount: &i128) {
    let key = (DataKey::CollectedLevies, authority.clone());
    env.storage().persistent().set(&key, amount);
}

/// Update collected levy amount for an authority (add to existing)
pub fn update_collected_levy(env: &Env, authority: &Address, additional_amount: &i128) {
    let current = get_collected_levy(env, authority);
    let new_amount = current + additional_amount;
    set_collected_levy(env, authority, &new_amount);
}

/// Remove collected levy entry for an authority  
pub fn remove_collected_levy(env: &Env, authority: &Address) {
    let key = (DataKey::CollectedLevies, authority.clone());
    env.storage().persistent().remove(&key);
}

/// Get collected fees amount for an authority
pub fn get_collected_fees(env: &Env, authority: &Address) -> i128 {
    let key = (DataKey::CollectedFees, authority.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

/// Update collected fees amount for an authority (add to existing)
pub fn update_collected_fees(env: &Env, authority: &Address, additional_amount: &i128) {
    let current = get_collected_fees(env, authority);
    let new_amount = current + additional_amount;
    let key = (DataKey::CollectedFees, authority.clone());
    env.storage().persistent().set(&key, &new_amount);
}

/// Get token contract ID from storage
pub fn get_token_id(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::TokenId)
}

/// Set token contract ID in storage
pub fn set_token_id(env: &Env, token_id: &Address) {
    env.storage().instance().set(&DataKey::TokenId, token_id);
}

/// Set token WASM hash in storage
pub fn set_token_wasm_hash(env: &Env, wasm_hash: &BytesN<32>) {
    env.storage().instance().set(&DataKey::TokenWasmHash, wasm_hash);
}


