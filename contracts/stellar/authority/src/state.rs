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
    pub who_paid: Address,        // wallet address that paid
    pub when_paid: u64,          // timestamp of payment
    pub ref_id: String,          // their org data_uid on our platform
    pub amount_paid: i128,       // amount paid in stroops
    pub payment_confirmed: bool, // whether payment was confirmed
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
    PaymentRecord,  // Payment ledger entries
    Authority,      // Registered authorities (post-payment)
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


/// Reads the registration fee from storage.
pub fn get_registration_fee(env: &Env) -> Option<i128> {
    env.storage().instance().get(&DataKey::RegistrationFee)
}

/// Writes the registration fee to storage.
pub fn set_registration_fee(env: &Env, fee: &i128) {
    env.storage().instance().set(&DataKey::RegistrationFee, fee);
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Payment Ledger Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Records a payment in the ledger
pub fn record_payment(env: &Env, payment: &PaymentRecord) {
    let key = (DataKey::PaymentRecord, payment.who_paid.clone());
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

/// Checks if an address has a confirmed payment
pub fn has_confirmed_payment(env: &Env, payer: &Address) -> bool {
    if let Some(payment) = get_payment_record(env, payer) {
        payment.payment_confirmed
    } else {
        false
    }
}

/// Confirms a payment (marks it as verified)
pub fn confirm_payment(env: &Env, payer: &Address) -> bool {
    let key = (DataKey::PaymentRecord, payer.clone());
    if let Some(mut payment) = env.storage().persistent().get::<(DataKey, Address), PaymentRecord>(&key) {
        payment.payment_confirmed = true;
        env.storage().persistent().set(&key, &payment);
        true
    } else {
        false
    }
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


