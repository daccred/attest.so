#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, Symbol,
    Bytes, BytesN, log, String as SorobanString,
};

const ADMIN_REG_AUTH: Symbol = symbol_short!("reg_auth");
const ADMIN_SET_LEVY: Symbol = symbol_short!("set_levy");

#[derive(Debug, Clone)]
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
#[derive(Debug, Clone)]
#[contracttype]
pub struct RegisteredAuthorityData {
    pub address: Address,
    pub metadata: SorobanString,
}

/// Data stored for schema levy information.
#[derive(Debug, Clone)]
#[contracttype]
pub struct SchemaLevyInfo {
    pub levy_amount: i128,
    pub authority_for_levy: Address,
}

#[contract]
pub struct AuthorityResolverContract;

#[contractimpl]
impl AuthorityResolverContract {
    /// Initializes the contract, setting the provided address as the admin.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Allows the contract admin to register another address as a recognized authority.
    /// Overwrites existing metadata if the authority is already registered.
    pub fn admin_register_authority(
        env: &Env,
        admin: Address,
        auth_to_reg: Address,
        metadata: SorobanString,
    ) -> Result<(), Error> {
        admin.require_auth();

        let stored_admin = env.storage().instance().get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        if admin != stored_admin {
            return Err(Error::NotAuthorized);
        }

        let authority_data = RegisteredAuthorityData {
            address: auth_to_reg.clone(),
            metadata,
        };
        let key = DataKey::RegisteredAuthority(auth_to_reg);
        env.storage().instance().set(&key, &authority_data);

        env.events().publish((ADMIN_REG_AUTH,), authority_data);

        Ok(())
    }

    /// Allows the contract admin to set levy details for a specific schema UID.
    /// Setting levy_amount to 0 effectively removes the levy.
    pub fn admin_set_schema_levy(
        env: &Env,
        admin: Address,
        schema_uid: BytesN<32>,
        levy_amount: i128,
        authority_for_levy: Address,
    ) -> Result<(), Error> {
        admin.require_auth();

        let stored_admin = env.storage().instance().get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        if admin != stored_admin {
            return Err(Error::NotAuthorized);
        }

        let key = DataKey::SchemaLevy(schema_uid.clone());

        if levy_amount > 0 {
            let authority_for_levy_clone = authority_for_levy.clone();
            if !Self::is_authority(env, authority_for_levy_clone) {
                 return Err(Error::ReceivingAuthorityNotRegistered);
            }

            let levy_info = SchemaLevyInfo {
                levy_amount,
                authority_for_levy: authority_for_levy.clone(),
            };
            env.storage().instance().set(&key, &levy_info);
            env.events().publish((ADMIN_SET_LEVY, schema_uid.clone()), levy_info);
        } else {
            env.storage().instance().remove(&key);
        }

        Ok(())
    }

    /// Checks if a given address is a registered authority.
    pub fn is_authority(env: &Env, authority_addr: Address) -> bool {
        let key = DataKey::RegisteredAuthority(authority_addr.clone());
        env.storage().instance().has(&key)
    }

    /// Retrieves the levy information for a given schema UID, if any.
    pub fn get_schema_levy(env: &Env, schema_uid: BytesN<32>) -> Option<SchemaLevyInfo> {
        let key = DataKey::SchemaLevy(schema_uid.clone());
        env.storage().instance().get(&key)
    }

    /// Hook called during attestation. Verifies authority and returns required levy.
    /// Does NOT handle payment collection.
    /// # Returns
    /// * `Result<i128, Error>` - The levy amount in stroops (0 if no levy), or an error.
    pub fn on_attest(env: &Env, attestation: AttestationRecord) -> Result<i128, Error> {
        log!(env, "AuthorityResolver: on_attest hook called for UID: {}", attestation.uid);

        if !Self::is_authority(env, attestation.attester.clone()) {
            return Err(Error::AttesterNotAuthority);
        }

        if let Some(levy_info) = Self::get_schema_levy(env, attestation.schema_uid.clone()) {
            Ok(levy_info.levy_amount)
        } else {
            Ok(0)
        }
    }

    /// Hook called during revocation. Verifies the revoker is the original authority.
    pub fn on_revoke(env: &Env, attestation: AttestationRecord) -> Result<(), Error> {
        log!(env, "AuthorityResolver: on_revoke hook called for UID: {}", attestation.uid);

        if !Self::is_authority(env, attestation.attester.clone()) {
             return Err(Error::AttesterNotAuthority);
        }

        Ok(())
    }

    /// Handles attestation logic by calling the `on_attest` hook.
    /// The return value `Ok(true)` indicates the authority check passed,
    /// but the actual levy amount needs to be checked separately by the caller.
    pub fn attest(env: Env, attestation: AttestationRecord) -> Result<bool, Error> {
        Self::on_attest(&env, attestation)?;
        Ok(true)
    }

    /// Handles revocation logic by calling the `on_revoke` hook.
    pub fn revoke(env: Env, attestation: AttestationRecord) -> Result<bool, Error> {
        Self::on_revoke(&env, attestation)?;
        Ok(true)
    }
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    RegisteredAuthority(Address),
    SchemaLevy(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    ReceivingAuthorityNotRegistered = 4,
    AttesterNotAuthority = 5,
}

#[cfg(test)]
mod test;
