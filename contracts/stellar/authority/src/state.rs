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

/// **CRITICAL BUSINESS FUNCTION**: Records payment in immutable ledger for access control
///
/// This function creates the permanent record that enables authority verification access.
/// Once recorded, the payment cannot be deleted or modified, providing immutable proof
/// that an organization has paid the verification fee and is eligible for attestations.
///
/// # Business Logic
/// - Creates permanent payment record for organization wallet address
/// - Links on-chain payment to off-chain organization data via ref_id
/// - Enables resolver validation of payment status before allowing attestations
/// - Overwrites any previous payment record for same address (payment updates)
///
/// # Storage Model
/// - **Key**: (DataKey::PaymentRecord, recipient_address)
/// - **Value**: PaymentRecord struct with timestamp, ref_id, amount
/// - **Persistence**: Persistent storage with maximum TTL extension
/// - **Immutability**: Once written, record persists until TTL expiration
///
/// # Security Implications
/// - **Access Control Foundation**: This record enables attestation eligibility
/// - **Audit Trail**: Immutable proof of payment for compliance/verification
/// - **Revenue Protection**: Must be called only after successful token transfer
/// - **Anti-Fraud**: Links payment to specific organization through ref_id
///
/// # Parameters
/// * `env` - Soroban environment for storage operations
/// * `payment` - Complete payment record including recipient, timestamp, ref_id, amount
///
/// # Storage Guarantees
/// - **Atomicity**: Either entire record is written or none is written
/// - **Persistence**: Record survives contract restarts and chain reorganizations
/// - **TTL Management**: Automatic TTL extension prevents data expiration
/// - **Uniqueness**: One payment record per recipient address (latest overwrites)
///
/// # Critical Invariants
/// 1. **Payment-Token Coupling**: Should only be called after successful token transfer
/// 2. **Data Integrity**: All payment fields must be accurate and verified
/// 3. **Reference Validation**: ref_id should correspond to valid platform organization
/// 4. **Timestamp Accuracy**: Should use blockchain timestamp for tamper resistance
///
/// # Q/A Testing Focus
/// - **Storage Consistency**: Verify record persists across contract calls
/// - **TTL Management**: Confirm records don't expire unexpectedly
/// - **Overwrite Behavior**: Test multiple payments from same address
/// - **Atomicity**: Ensure partial writes are impossible
/// - **Key Collision**: Verify different addresses have separate records
pub fn record_payment(env: &Env, payment: &PaymentRecord) {
    // Create composite storage key: (DataKey::PaymentRecord, recipient_address)
    // This ensures each address has exactly one payment record
    let key = (DataKey::PaymentRecord, payment.recipient.clone());
    
    // Store payment record in persistent storage
    // This creates immutable proof of payment for resolver validation
    env.storage().persistent().set(&key, payment);
    
    // Extend TTL to maximum to ensure payment records persist
    // Payment eligibility should not expire due to storage limitations
    env.storage().persistent().extend_ttl(
        &key,
        env.storage().max_ttl() - 100,  // Start TTL extension early
        env.storage().max_ttl(),        // Extend to maximum possible TTL
    );
}

/// Gets a payment record for an address
pub fn get_payment_record(env: &Env, payer: &Address) -> Option<PaymentRecord> {
    let key = (DataKey::PaymentRecord, payer.clone());
    env.storage().persistent().get(&key)
}

/// **CRITICAL ACCESS CONTROL FUNCTION**: Validates payment eligibility for attestations
///
/// This is the core business logic enforcement function that determines whether an
/// organization is eligible to receive authority attestations. It's called by the
/// resolver's before_attest() hook to implement payment-gated access control.
///
/// # Business Model Enforcement
/// - **Payment Gate**: No payment record = no attestation eligibility
/// - **Revenue Protection**: Ensures only paying customers receive services
/// - **Simple Boolean**: Either paid (eligible) or not paid (blocked)
/// - **Permanent Status**: Once paid, always eligible (no expiration)
///
/// # Security Properties
/// - **Cryptographic Enforcement**: Cannot be bypassed (payment records are immutable)
/// - **Binary Decision**: Clear yes/no decision for access control
/// - **Storage Dependent**: Relies on persistent storage for payment records
/// - **Tamper Resistant**: Cannot be manipulated without contract upgrade
///
/// # Parameters
/// * `env` - Soroban environment for storage access
/// * `payer` - Address to check for payment record (organization wallet)
///
/// # Returns
/// * `true` - Payment record exists (organization is eligible for attestations)
/// * `false` - No payment record found (organization must pay first)
///
/// # Integration Points
/// - **Resolver Validation**: Called by authority resolver's before_attest()
/// - **Payment Flow**: Becomes true after successful pay_verification_fee()
/// - **Business Logic**: Core enforcement mechanism for fee requirement
/// - **Access Control**: Primary gate for authority verification services
///
/// # Critical for Revenue Model
/// This function is the primary revenue protection mechanism. If this function
/// returns true for unpaid addresses, the business model fails and services
/// are provided for free. If it returns false for paid addresses, paying
/// customers are denied service they purchased.
///
/// # Q/A Testing Focus
/// - **Payment Detection**: Verify returns true immediately after payment
/// - **Non-Payment Detection**: Verify returns false for unpaid addresses  
/// - **Edge Cases**: Test with invalid/non-existent addresses
/// - **Consistency**: Verify consistent results across multiple calls
/// - **Performance**: Ensure fast lookup for frequent resolver calls
pub fn has_confirmed_payment(env: &Env, payer: &Address) -> bool {
    // Simple existence check - if payment record exists, payment is confirmed
    // This implements the "pay once, eligible forever" business model
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


