#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Bytes, BytesN,
    Env, String as SorobanString, Symbol, log,
};

// ══════════════════════════════════════════════════════════════════════════════
// ► Contract Errors
// ══════════════════════════════════════════════════════════════════════════════
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,         // General auth failure
    RecipientNotAuthority = 4, // Levy recipient must be registered
    AttesterNotAuthority = 5,
    SchemaNotRegistered = 6,
    InvalidSchemaRules = 7,
    InsufficientPayment = 8,   // For registration fee
    NothingToWithdraw = 9,
    TokenTransferFailed = 10,  // Deprecated/internal - transfer panics
    WithdrawalFailed = 11,     // Deprecated/internal - transfer panics
}

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
    pub metadata: SorobanString,
    pub registration_time: u64,
}

/// Data stored for schema levy information.
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct SchemaRules {
    pub levy_amount: Option<i128>,
    pub levy_recipient: Option<Address>,
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Contract Events (Public constants)
// ══════════════════════════════════════════════════════════════════════════════
pub const ADMIN_REG_AUTH: Symbol = symbol_short!("adm_rg_at");
pub const AUTHORITY_REGISTERED: Symbol = symbol_short!("auth_reg");
pub const SCHEMA_REGISTERED: Symbol = symbol_short!("schm_reg");
pub const LEVY_COLLECTED: Symbol = symbol_short!("levy_coll");
pub const LEVY_WITHDRAWN: Symbol = symbol_short!("levy_wdrw");

#[contract]
pub struct AuthorityResolverContract;

// ══════════════════════════════════════════════════════════════════════════════
// ► Contract Implementation
// ══════════════════════════════════════════════════════════════════════════════
#[contractimpl]
impl AuthorityResolverContract {

    // ──────────────────────────────────────────────────────────────────────────
    //                         Internal Helper Functions (Moved inside impl)
    // ──────────────────────────────────────────────────────────────────────────

    // Checks if the Admin key exists in instance storage.
    fn is_initialized(env: &Env) -> bool {
        env.storage().instance().has(&DataKey::Admin)
    }

    // Returns Error::NotInitialized if the contract hasn't been initialized.
    fn require_init(env: &Env) -> Result<(), Error> {
        if !Self::is_initialized(env) {
            Err(Error::NotInitialized)
        } else {
            Ok(())
        }
    }

    // Retrieves the stored token contract ID.
    fn get_token_id_internal(env: &Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::TokenId).ok_or(Error::NotInitialized)
    }

    // Retrieves the stored admin address.
    fn get_admin_internal(env: &Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)
    }

    // Requires authorization from the caller and checks if they are the admin.
    fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
        caller.require_auth();
        let admin = Self::get_admin_internal(env)?;
        if caller != &admin {
            Err(Error::NotAuthorized)
        } else {
            Ok(())
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    //                           Initialization
    // ──────────────────────────────────────────────────────────────────────────
    pub fn initialize(env: Env, admin: Address, token_contract_id: Address) -> Result<(), Error> {
        if Self::is_initialized(&env) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenId, &token_contract_id);
        env.storage().instance().extend_ttl(
            env.storage().max_ttl() - 100,
            env.storage().max_ttl(),
        );
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    //                           Admin Functions
    // ──────────────────────────────────────────────────────────────────────────
    pub fn admin_register_authority(
        env: Env,
        admin: Address,
        auth_to_reg: Address,
        metadata: SorobanString,
    ) -> Result<(), Error> {
        Self::require_init(&env)?;
        Self::require_admin(&env, &admin)?;

        let data = RegisteredAuthorityData {
            address: auth_to_reg.clone(),
            metadata: metadata.clone(),
            registration_time: env.ledger().timestamp(),
        };

        let key = DataKey::RegisteredAuthority(auth_to_reg.clone());
        env.storage().persistent().set(&key, &data);

        env.storage().persistent().extend_ttl(
            &key,
            env.storage().max_ttl() - 100,
            env.storage().max_ttl(),
        );

        env.events().publish(
            (ADMIN_REG_AUTH, symbol_short!("register")),
            (auth_to_reg, metadata)
        );

        Ok(())
    }

    pub fn admin_register_schema(
        env: Env,
        admin: Address,
        schema_uid: BytesN<32>,
        rules: SchemaRules,
    ) -> Result<(), Error> {
        Self::require_init(&env)?;
        Self::require_admin(&env, &admin)?;
        if let Some(recipient) = &rules.levy_recipient {
            if rules.levy_amount.is_none() || rules.levy_amount.unwrap_or(0) <= 0 {
                return Err(Error::InvalidSchemaRules);
            }
            if !Self::is_authority(env.clone(), recipient.clone())? {
                return Err(Error::RecipientNotAuthority);
            }
        } else {
            if rules.levy_amount.is_some() && rules.levy_amount.unwrap() > 0 {
                return Err(Error::InvalidSchemaRules);
            }
        }

        let key = DataKey::SchemaRule(schema_uid.clone());
        env.storage().persistent().set(&key, &rules);

        env.storage().persistent().extend_ttl(
            &key,
            env.storage().max_ttl() - 100,
            env.storage().max_ttl(),
        );

        env.events().publish(
            (SCHEMA_REGISTERED, symbol_short!("register")),
            (schema_uid, rules)
        );

        Ok(())
    }

    // Simplified helper method for setting schema levy
    pub fn admin_set_schema_levy(
        env: Env,
        admin: Address,
        schema_uid: BytesN<32>,
        levy_amount: i128,
        levy_recipient: Address,
    ) -> Result<(), Error> {
        Self::require_init(&env)?;
        Self::require_admin(&env, &admin)?;
        
        // Check if recipient is a valid authority
        if !Self::is_authority(env.clone(), levy_recipient.clone())? {
            return Err(Error::RecipientNotAuthority);
        }
        
        // Create rules with the provided levy amount and recipient
        let rules = SchemaRules {
            levy_amount: Some(levy_amount),
            levy_recipient: Some(levy_recipient.clone()),
        };
        
        let key = DataKey::SchemaRule(schema_uid.clone());
        env.storage().persistent().set(&key, &rules);
        
        env.storage().persistent().extend_ttl(
            &key,
            env.storage().max_ttl() - 100,
            env.storage().max_ttl(),
        );
        
        env.events().publish(
            (SCHEMA_REGISTERED, symbol_short!("register")),
            (schema_uid, rules)
        );
        
        Ok(())
    }

    // Helper method for setting registration fee
    pub fn admin_set_registration_fee(
        env: Env,
        admin: Address,
        fee_amount: i128,
        token_id: Address,
    ) -> Result<(), Error> {
        Self::require_init(&env)?;
        Self::require_admin(&env, &admin)?;
        
        // Store the registration fee amount
        env.storage().instance().set(&DataKey::RegistrationFee, &fee_amount);
        
        // Store the token ID if different from the current one
        if token_id != Self::get_token_id_internal(&env)? {
            env.storage().instance().set(&DataKey::TokenId, &token_id);
        }
        
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    //                         Public/Hook Functions
    // ──────────────────────────────────────────────────────────────────────────
    pub fn register_authority(
        env: Env,
        caller: Address,
        authority_to_reg: Address,
        metadata: SorobanString,
    ) -> Result<(), Error> {
        Self::require_init(&env)?;
        caller.require_auth();

        const REGISTRATION_FEE: i128 = 100_0000000; // 100 XLM in stroops

        let token_id = Self::get_token_id_internal(&env)?;
        let token_client = token::Client::new(&env, &token_id);

        token_client.transfer(
            &caller,
            &env.current_contract_address(),
            &REGISTRATION_FEE
        );

        let data = RegisteredAuthorityData {
            address: authority_to_reg.clone(),
            metadata: metadata.clone(),
            registration_time: env.ledger().timestamp(),
        };

        let key = DataKey::RegisteredAuthority(authority_to_reg.clone());
        env.storage().persistent().set(&key, &data);

        env.storage().persistent().extend_ttl(
            &key,
            env.storage().max_ttl() - 100,
            env.storage().max_ttl(),
        );

        env.events().publish(
            (AUTHORITY_REGISTERED, symbol_short!("register")),
            (caller, authority_to_reg, metadata)
        );

        Ok(())
    }

    pub fn is_authority(env: Env, authority: Address) -> Result<bool, Error> {
        Self::require_init(&env)?;
        let key = DataKey::RegisteredAuthority(authority);
        Ok(env.storage().persistent().has(&key))
    }

    pub fn attest(env: Env, attestation: AttestationRecord) -> Result<bool, Error> {
        Self::require_init(&env)?;
        if !Self::is_authority(env.clone(), attestation.attester.clone())? {
            log!(&env, "Attest hook: {} is NOT an authority.", attestation.attester);
            return Err(Error::AttesterNotAuthority);
        }

        let rules_key = DataKey::SchemaRule(attestation.schema_uid.clone());
        let rules: SchemaRules = env.storage().persistent().get(&rules_key)
            .ok_or_else(|| {
                log!(&env, "Attest hook: Schema {:?} not registered.", attestation.schema_uid);
                Error::SchemaNotRegistered
            })?;

        if let (Some(amount), Some(recipient)) = (rules.levy_amount, rules.levy_recipient) {
            if amount > 0 {
                log!(
                    &env,
                    "Attest hook: Levy of {} applies for schema {:?} to recipient {}",
                    amount, attestation.schema_uid, recipient
                );

                let token_id = Self::get_token_id_internal(&env)?;
                let token_client = token::Client::new(&env, &token_id);

                token_client.transfer(
                    &attestation.attester,
                    &env.current_contract_address(),
                    &amount
                );

                let balance_key = DataKey::CollectedLevy(recipient.clone());
                let current_balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
                let new_balance = current_balance.checked_add(amount).expect("Levy balance overflow");
                env.storage().persistent().set(&balance_key, &new_balance);

                env.storage().persistent().extend_ttl(
                    &balance_key,
                    env.storage().max_ttl() - 100,
                    env.storage().max_ttl(),
                );

                env.events().publish(
                    (LEVY_COLLECTED, symbol_short!("collect")),
                    (attestation.attester.clone(), recipient.clone(), attestation.schema_uid.clone(), amount)
                );

                 log!(&env, "Attest hook: Levy collected. New balance for {}: {}", recipient, new_balance);
            }
        }

        log!(&env, "Attest hook: Authority {} authorized for schema {:?}", attestation.attester, attestation.schema_uid);
        Ok(true)
    }

    pub fn revoke(env: Env, attestation: AttestationRecord) -> Result<bool, Error> {
        Self::require_init(&env)?;
        if Self::is_authority(env.clone(), attestation.attester.clone())? {
            log!(&env, "Revoke hook: Authority {} authorized for schema {:?}", attestation.attester, attestation.schema_uid);
            Ok(true)
        } else {
             log!(&env, "Revoke hook: {} is NOT an authority.", attestation.attester);
            Err(Error::AttesterNotAuthority)
        }
    }

    pub fn withdraw_levies(env: Env, caller: Address) -> Result<(), Error> {
        Self::require_init(&env)?;
        caller.require_auth();
        if !Self::is_authority(env.clone(), caller.clone())? {
            log!(&env, "Withdrawal attempt by non-authority: {}", caller);
            return Err(Error::NotAuthorized);
        }

        let balance_key = DataKey::CollectedLevy(caller.clone());
        let balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);

        if balance <= 0 {
            log!(&env, "Withdrawal attempt by {}: No balance to withdraw.", caller);
            return Err(Error::NothingToWithdraw);
        }

        log!(&env, "Attempting withdrawal for {}: amount {}", caller, balance);

        let token_id = Self::get_token_id_internal(&env)?;
        let token_client = token::Client::new(&env, &token_id);

        env.storage().persistent().set(&balance_key, &0i128);

        token_client.transfer(
            &env.current_contract_address(),
            &caller,
            &balance
        );

        env.storage().persistent().remove(&balance_key);

        env.events().publish(
            (LEVY_WITHDRAWN, symbol_short!("withdraw")),
            (caller.clone(), balance)
        );

        log!(&env, "Withdrawal successful for {}: amount {}", caller, balance);
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────────
    //                             Getter Functions
    // ──────────────────────────────────────────────────────────────────────────
    pub fn get_schema_rules(env: Env, schema_uid: BytesN<32>) -> Result<Option<SchemaRules>, Error> {
        Self::require_init(&env)?;
        let key = DataKey::SchemaRule(schema_uid);
        Ok(env.storage().persistent().get(&key))
    }

    pub fn get_collected_levies(env: Env, authority: Address) -> Result<i128, Error> {
        Self::require_init(&env)?;
        let key = DataKey::CollectedLevy(authority);
        Ok(env.storage().persistent().get(&key).unwrap_or(0))
    }

    pub fn get_token_id(env: Env) -> Result<Address, Error> {
        Self::require_init(&env)?;
        Self::get_token_id_internal(&env)
    }

    pub fn get_admin_address(env: Env) -> Result<Address, Error> {
         Self::require_init(&env)?;
         Self::get_admin_internal(&env)
    }
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    TokenId,
    RegisteredAuthority(Address),
    SchemaRule(BytesN<32>),
    CollectedLevy(Address),
    RegistrationFee,
}

#[cfg(test)]
mod test;
