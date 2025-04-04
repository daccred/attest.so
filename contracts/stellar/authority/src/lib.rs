#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, Symbol,
};

const REGISTER: Symbol = symbol_short!("REGISTER");
const VERIFY: Symbol = symbol_short!("VERIFY");

#[contract]
pub struct AuthorityContract;

#[contractimpl]
impl AuthorityContract {
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

mod test;
