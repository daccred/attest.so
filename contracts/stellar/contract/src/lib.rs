#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Bytes, BytesN,
    contracterror, symbol_short, vec,
    IntoVal, xdr::ToXdr,
};

mod schema;
mod resolver_interface;

use resolver_interface::{AttestationRecord};
use schema::{register_schema as create_schema, DataKey as SchemaDataKey, SchemaError};

use schema::Schema as SchemaDefinition;

#[contracttype]
pub enum DataKey {
    Authority(Address),
    Attestation(BytesN<32>),
    Schema(BytesN<32>),
    Admin,
}

#[derive(Debug, Clone)]
#[contracttype]
pub struct StoredAttestation {
    pub schema_uid: BytesN<32>,
    pub recipient: Address,
    pub attester: Address,
    pub time: u64,
    pub expiration_time: Option<u64>,
    pub revocation_time: Option<u64>,
    pub revocable: bool,
    pub ref_uid: Option<BytesN<32>>,
    pub data: Bytes,
    pub value: Option<i128>,
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
    ResolverError = 10,
    SchemaHasNoResolver = 11,
    AdminNotSet = 12,
    AlreadyInitialized = 13,
}

impl From<SchemaError> for Error {
    fn from(_err: SchemaError) -> Self {
        Error::SchemaError
    }
}

fn to_attestation_record(
    _env: &Env,
    uid: &BytesN<32>,
    att: &StoredAttestation,
) -> AttestationRecord {
    AttestationRecord {
        uid: uid.clone(),
        schema_uid: att.schema_uid.clone(),
        recipient: att.recipient.clone(),
        attester: att.attester.clone(),
        time: att.time,
        expiration_time: att.expiration_time,
        revocation_time: att.revocation_time,
        revocable: att.revocable,
        ref_uid: att.ref_uid.clone(),
        data: att.data.clone(),
        value: att.value,
    }
}

#[contract]
pub struct AttestationContract;

#[contractimpl]
impl AttestationContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

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
        data: Bytes,
        recipient_address: Address,
        schema_uid: BytesN<32>,
        expiration_time: Option<u64>,
        ref_uid: Option<BytesN<32>>,
        value: Option<i128>,
        revocable: bool,
    ) -> Result<BytesN<32>, Error> {
        caller.require_auth();

        let _authority = get_authority(&env, &caller)
            .ok_or(Error::AuthorityNotRegistered)?;

        let schema_key = SchemaDataKey::Schema(schema_uid.clone());
        let schema: SchemaDefinition = env.storage().instance().get(&schema_key)
            .ok_or(Error::SchemaNotFound)?;

        let mut attestation_data_to_hash = Bytes::new(&env);
        attestation_data_to_hash.append(&data.clone().to_xdr(&env));
        attestation_data_to_hash.append(&schema_uid.clone().to_xdr(&env));
        attestation_data_to_hash.append(&recipient_address.clone().to_xdr(&env));
        attestation_data_to_hash.append(&caller.clone().to_xdr(&env));
        if let Some(r_uid) = &ref_uid {
            attestation_data_to_hash.append(&r_uid.to_xdr(&env));
        }
        let uid: BytesN<32> = env.crypto().sha256(&attestation_data_to_hash).into();

        let attestation_key = DataKey::Attestation(uid.clone());

        if env.storage().instance().has(&attestation_key) {
            return Err(Error::AttestationExists);
        }

        let time = env.ledger().timestamp();
        let attestation_to_store = StoredAttestation {
            schema_uid,
            recipient: recipient_address,
            attester: caller,
            time,
            expiration_time,
            revocation_time: None,
            revocable,
            ref_uid: ref_uid.clone(),
            data: data.clone(),
            value,
        };

        if let Some(resolver_address) = &schema.resolver {
            let attestation_record = to_attestation_record(&env, &uid, &attestation_to_store);
            env.invoke_contract::<()>(
                resolver_address,
                &symbol_short!("attest"),
                vec![&env, attestation_record.into_val(&env)],
            );
        }

        store_attestation(&env, &uid, &attestation_to_store)?;

        env.events()
            .publish((symbol_short!("attest"), symbol_short!("create")), attestation_to_store.clone());

        Ok(uid)
    }

    pub fn revoke_attest(
        env: Env,
        caller: Address,
        uid: BytesN<32>,
    ) -> Result<(), Error> {
        caller.require_auth();

        let attestation_key = DataKey::Attestation(uid.clone());
        let mut attestation: StoredAttestation = env.storage().instance().get(&attestation_key)
            .ok_or(Error::AttestationNotFound)?;

        let schema_key = SchemaDataKey::Schema(attestation.schema_uid.clone());
        let schema: SchemaDefinition = env.storage().instance().get(&schema_key)
             .ok_or(Error::SchemaNotFound)?;
        if schema.authority != caller {
             return Err(Error::NotAuthorized);
        }

        if !attestation.revocable {
            return Err(Error::NotAuthorized);
        }

        let original_attestation = attestation.clone();
        attestation.revocation_time = Some(env.ledger().timestamp());

        if let Some(resolver_address) = &schema.resolver {
            let attestation_record = to_attestation_record(&env, &uid, &original_attestation);
            env.invoke_contract::<()>(
                resolver_address,
                &symbol_short!("revoke"),
                vec![&env, attestation_record.into_val(&env)],
            );
        }

        store_attestation(&env, &uid, &attestation)?;

        env.events()
            .publish((symbol_short!("attest"), symbol_short!("revoke")), uid);

        Ok(())
    }

    pub fn get_attest(
        env: Env,
        uid: BytesN<32>
    ) -> Result<StoredAttestation, Error> {
        let attestation_key = DataKey::Attestation(uid);
        env.storage().instance().get(&attestation_key)
            .ok_or(Error::AttestationNotFound)
    }

    pub fn reg_auth(
        env: Env,
        auth_to_reg: Address,
        metadata: String,
    ) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(Error::AdminNotSet)?;
        admin.require_auth();
        
        let authority = Authority {
            address: auth_to_reg.clone(),
            metadata,
        };
        let key = DataKey::Authority(auth_to_reg);
        env.storage().instance().set(&key, &authority);
        env.events().publish(
            (symbol_short!("auth"), symbol_short!("register")),
            authority,
        );
        Ok(())
    }
}

fn get_authority(env: &Env, address: &Address) -> Option<Authority> {
    let key = DataKey::Authority(address.clone());
    env.storage().instance().get(&key)
}

fn store_attestation(env: &Env, uid: &BytesN<32>, attestation: &StoredAttestation) -> Result<(), Error> {
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
        let attestation_data = Bytes::from_slice(&env, &[1, 2, 3]);
        let ref_uid: Option<BytesN<32>> = None;
        let value: Option<i128> = None;

        let attestation_uid = client.attest(
            &authority,
            &attestation_data,
            &recipient,
            &schema_uid,
            &Some(env.ledger().timestamp() + 1000),
            &ref_uid,
            &value,
            &true
        );

        let fetched_attestation = client.get_attest(&attestation_uid);

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
        let attestation_data = Bytes::from_slice(&env, &[4, 5, 6]);
        let ref_uid: Option<BytesN<32>> = None;
        let value: Option<i128> = None;

        let attestation_uid = client.attest(
            &authority,
            &attestation_data,
            &recipient,
            &schema_uid,
            &None,
            &ref_uid,
            &value,
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
         let attestation_data = Bytes::from_slice(&env, &[7, 8, 9]);
         let ref_uid: Option<BytesN<32>> = None;
         let value: Option<i128> = None;

         let result = client.try_attest(
             &non_authority,
             &attestation_data,
             &recipient,
             &schema_uid,
             &None,
             &ref_uid,
             &value,
             &true
         );

         assert!(result.is_err());
         assert_eq!(result.err().unwrap().unwrap(), Error::AuthorityNotRegistered);
     }
} 