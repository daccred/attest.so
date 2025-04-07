#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Bytes, BytesN,
    contracterror, symbol_short, vec,
    IntoVal, xdr::ToXdr,
};

mod schema;
use schema::{Schema, register_schema as create_schema, DataKey as SchemaDataKey, SchemaError};

#[contracttype]
pub enum DataKey {
    Authority(Address),
    Attestation(BytesN<32>),
    Schema(BytesN<32>),
}

#[derive(Debug, Clone)]
#[contracttype]
pub struct Attestation {
    pub uid: BytesN<32>,
    pub schema_uid: BytesN<32>,
    pub recipient: Address,
    pub attester: Address,
    pub data: String,
    pub time: u64,
    pub expiration_time: Option<u64>,
    pub revocation_time: Option<u64>,
    pub revocable: bool,
}

#[derive(Debug, Clone)]
#[contracttype]
pub struct Authority {
    pub address: Address,
    pub metadata: String,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    TransferFailed = 1,
    AuthorityNotRegistered = 2,
    SchemaNotFound = 3,
    AttestationExists = 4,
    AttestationNotFound = 5,
    NotAuthorized = 6,
    StorageFailed = 7,
    SchemaError = 8,
    InvalidUid = 9,
}

impl From<SchemaError> for Error {
    fn from(_err: SchemaError) -> Self {
        Error::SchemaError
    }
}

#[contract]
pub struct AttestationContract;

#[contractimpl]
impl AttestationContract {
    pub fn register_schema(
        env: Env,
        caller: Address,
        schema_definition: String,
        resolver: Option<Address>,
        revocable: bool,
    ) -> Result<BytesN<32>, Error> {
        let schema_uid = create_schema(&env, caller, schema_definition, resolver, revocable)?;
        Ok(schema_uid)
    }

    pub fn attest(
        env: Env,
        caller: Address,
        data: String,
        recipient_address: Address,
        schema_uid: BytesN<32>,
        expiration_time: Option<u64>,
        revocable: bool,
    ) -> Result<BytesN<32>, Error> {
        caller.require_auth();

        let _authority = get_authority(&env, &caller)
            .ok_or(Error::AuthorityNotRegistered)?;

        let schema_key = SchemaDataKey::Schema(schema_uid.clone());
        let schema: Schema = env.storage().instance().get(&schema_key)
            .ok_or(Error::SchemaNotFound)?;

        if let Some(levy) = &schema.levy {
            env.invoke_contract::<()>(
                &levy.asset,
                &symbol_short!("transfer"),
                vec![
                    &env,
                    caller.clone().into_val(&env),
                    levy.recipient.clone().into_val(&env),
                    levy.amount.into_val(&env),
                ],
            );
        }

        let mut attestation_data_to_hash = Bytes::new(&env);
        attestation_data_to_hash.append(&data.clone().to_xdr(&env));
        attestation_data_to_hash.append(&schema_uid.clone().to_xdr(&env));
        attestation_data_to_hash.append(&recipient_address.clone().to_xdr(&env));
        attestation_data_to_hash.append(&caller.clone().to_xdr(&env));
        let uid: BytesN<32> = env.crypto().sha256(&attestation_data_to_hash).into();

        let attestation_key = DataKey::Attestation(uid.clone());

        if env.storage().instance().has(&attestation_key) {
            return Err(Error::AttestationExists);
        }

        let attestation = Attestation {
            uid: uid.clone(),
            schema_uid,
            recipient: recipient_address,
            attester: caller,
            data,
            time: env.ledger().timestamp(),
            expiration_time,
            revocation_time: None,
            revocable,
        };

        store_attestation(&env, &uid, &attestation)?;

        env.events()
            .publish((symbol_short!("attest"), symbol_short!("create")), attestation.clone());

        Ok(uid)
    }

    pub fn revoke_attest(
        env: Env,
        caller: Address,
        uid: BytesN<32>,
    ) -> Result<(), Error> {
        caller.require_auth();

        let attestation_key = DataKey::Attestation(uid.clone());
        let mut attestation: Attestation = env.storage().instance().get(&attestation_key)
            .ok_or(Error::AttestationNotFound)?;

        let schema_key = SchemaDataKey::Schema(attestation.schema_uid.clone());
        let schema: Schema = env.storage().instance().get(&schema_key)
             .ok_or(Error::SchemaNotFound)?;
        if schema.authority != caller {
             return Err(Error::NotAuthorized);
        }

        if !attestation.revocable {
            return Err(Error::NotAuthorized);
        }

        attestation.revocation_time = Some(env.ledger().timestamp());

        store_attestation(&env, &uid, &attestation)?;

        env.events()
            .publish((symbol_short!("attest"), symbol_short!("revoke")), uid);

        Ok(())
    }

    pub fn get_attest(
        env: Env,
        uid: BytesN<32>
    ) -> Result<Attestation, Error> {
        let attestation_key = DataKey::Attestation(uid);
        env.storage().instance().get(&attestation_key)
            .ok_or(Error::AttestationNotFound)
    }

    pub fn reg_auth(
        env: Env,
        admin: Address,
        auth_to_reg: Address,
        metadata: String,
    ) -> Result<(), Error> {
        admin.require_auth();
        
        let authority = Authority {
            address: auth_to_reg.clone(),
            metadata,
        };
        let key = DataKey::Authority(auth_to_reg);
        env.storage().instance().set(&key, &authority);
        Ok(())
    }
}

fn get_authority(env: &Env, address: &Address) -> Option<Authority> {
    let key = DataKey::Authority(address.clone());
    env.storage().instance().get(&key)
}

fn store_attestation(env: &Env, uid: &BytesN<32>, attestation: &Attestation) -> Result<(), Error> {
    let key = DataKey::Attestation(uid.clone());
    env.storage().instance().set(&key, attestation);
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::schema::test::test_schema_registration;
    use soroban_sdk::testutils::{Address as _, Ledger, Events};
    use soroban_sdk::{vec, IntoVal, symbol_short};

    fn setup_env() -> (Env, AttestationContractClient) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, AttestationContract);
        let client = AttestationContractClient::new(&env, &contract_id);
        (env, client)
    }

    fn register_default_authority(env: &Env, client: &AttestationContractClient) -> Address {
        let admin = Address::generate(&env);
        let authority_address = Address::generate(&env);
        client.reg_auth(&admin, &authority_address, &String::from_str(env, "Test Authority"));
        authority_address
    }

    fn register_default_schema(env: &Env, client: &AttestationContractClient, authority: &Address) -> BytesN<32> {
        client.register_schema(
            &authority,
            &String::from_str(env, "Test Schema"),
            &None,
            &true
        )
    }

    #[test]
    fn test_register_and_get_attestation() {
        let (env, client) = setup_env();
        let authority = register_default_authority(&env, &client);
        let schema_uid = register_default_schema(&env, &client, &authority);
        let recipient = Address::generate(&env);
        let attestation_data = String::from_str(&env, "attestation data");

        let attestation_uid = client.attest(
            &authority,
            &attestation_data,
            &recipient,
            &schema_uid,
            &Some(env.ledger().timestamp() + 1000),
            &true
        );

        let fetched_attestation = client.get_attest(&attestation_uid);

        assert_eq!(fetched_attestation.uid, attestation_uid);
        assert_eq!(fetched_attestation.schema_uid, schema_uid);
        assert_eq!(fetched_attestation.recipient, recipient);
        assert_eq!(fetched_attestation.attester, authority);
        assert_eq!(fetched_attestation.data, attestation_data);
        assert!(fetched_attestation.expiration_time.is_some());
        assert!(fetched_attestation.revocation_time.is_none());
        assert_eq!(fetched_attestation.revocable, true);
    }

    #[test]
    fn test_revoke_attestation() {
        let (env, client) = setup_env();
        let authority = register_default_authority(&env, &client);
        let schema_uid = register_default_schema(&env, &client, &authority);
        let recipient = Address::generate(&env);
        let attestation_data = String::from_str(&env, "data to revoke");

        let attestation_uid = client.attest(
            &authority,
            &attestation_data,
            &recipient,
            &schema_uid,
            &None,
            &true
        );

        env.ledger().with_mut(|li| {
            li.timestamp += 100;
        });
        let revocation_time = env.ledger().timestamp();

        client.revoke_attest(
            &authority,
            &attestation_uid
        );

        let fetched_attestation = client.get_attest(&attestation_uid);

        assert!(fetched_attestation.revocation_time.is_some());
        assert_eq!(fetched_attestation.revocation_time.unwrap(), revocation_time);
    }

     #[test]
     fn test_attest_fails_if_not_authority() {
         let (env, client) = setup_env();
         let authority = register_default_authority(&env, &client);
         let schema_uid = register_default_schema(&env, &client, &authority);
         let non_authority = Address::generate(&env);
         let recipient = Address::generate(&env);
         let attestation_data = String::from_str(&env, "attestation data");

         let result = client.try_attest(
             &non_authority,
             &attestation_data,
             &recipient,
             &schema_uid,
             &None,
             &true
         );

         assert!(result.is_err());
         assert_eq!(result.err().unwrap().unwrap(), Error::AuthorityNotRegistered);
     }
} 