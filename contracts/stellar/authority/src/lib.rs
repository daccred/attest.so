#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, Symbol,
    Bytes, BytesN, log
};

const REGISTER: Symbol = symbol_short!("REGISTER");
const VERIFY: Symbol = symbol_short!("VERIFY");

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
    pub ref_uid: Option<BytesN<32>>,
    pub data: Bytes,
    pub value: Option<i128>,
}

#[contract]
pub struct AuthorityResolverContract;

#[contractimpl]
impl AuthorityResolverContract {
    pub fn __constructor(env: Env) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        let admin = env.current_contract_address();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    pub fn register_authority(env: Env) {
        let caller = env.current_contract_address();

        let signer_key = AuthorityRecord::Signer;
        let signer_verified_key = AuthorityRecord::SignerVerified;

        env.storage().instance().set(&signer_key, &caller);
        env.storage().instance().set(&signer_verified_key, &false);

        env.events().publish((REGISTER,), caller);
    }

    pub fn verify_authority(env: Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let signer_key = AuthorityRecord::Signer;
        let signer_verified_key = AuthorityRecord::SignerVerified;
        env.storage().instance().set(&signer_verified_key, &true);

        // TODO: remove unwrap
        let authority: Address = env.storage().instance().get(&signer_key).unwrap();

        env.events().publish((VERIFY,), authority);
    }

    pub fn attest(env: Env, attestation: AttestationRecord) -> Result<(), soroban_sdk::Error> {
        log!(&env, "AuthorityResolver: Attest hook called for UID: {}", attestation.uid);
        Ok(())
    }

    pub fn revoke(env: Env, attestation: AttestationRecord) -> Result<(), soroban_sdk::Error> {
        log!(&env, "AuthorityResolver: Revoke hook called for UID: {}", attestation.uid);
        Ok(())
    }

    pub fn is_payable(_env: Env) -> bool {
        false
    }
}

#[contracttype]
#[derive(Clone)]
enum AuthorityRecord {
    SignerVerified,
    Signer,
}
#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
}

#[cfg(test)]
mod test;
