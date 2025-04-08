#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String as SorobanString, Bytes, BytesN,
    contracterror, symbol_short, vec,
    IntoVal, xdr::ToXdr, TryFromVal, Vec, Symbol,
};

mod schema;
mod resolver_interface;

use resolver_interface::{AttestationRecord};
use schema::register_schema as register_schema_internal;

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
    pub ref_uid: Option<Bytes>,
    pub data: Bytes,
    pub value: Option<i128>,
}

#[derive(Debug, Clone)]
#[contracttype]
pub struct Authority {
    pub address: Address,
    pub metadata: SorobanString,
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
    InvalidUid = 9,
    ResolverError = 10,
    SchemaHasNoResolver = 11,
    AdminNotSet = 12,
    AlreadyInitialized = 13,
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
        schema_definition: SorobanString,
        resolver: Option<Address>,
        revocable: bool,
    ) -> Result<BytesN<32>, Error> {
        let schema_uid = register_schema_internal(&env, caller, schema_definition, resolver, revocable)?;
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

        let schema_key = DataKey::Schema(schema_uid.clone());
        let schema: schema::Schema = env.storage().instance().get(&schema_key)
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
            ref_uid: ref_uid.map(|r_uid| Bytes::from_slice(&env, &r_uid.to_array())),
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

        let schema_key = DataKey::Schema(attestation.schema_uid.clone());
        let schema: schema::Schema = env.storage().instance().get(&schema_key)
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
        metadata: SorobanString,
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
    use soroban_sdk::testutils::{Address as _, Ledger, Events};
    use soroban_sdk::{symbol_short, String as SorobanString, TryFromVal, Vec, Symbol};
    
    // --- Test Helpers ---
    
    fn setup_env() -> (Env, Address, AttestationContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register_contract(None, AttestationContract);
        let client = AttestationContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        env.mock_all_auths(); 
        admin.require_auth();
        client.initialize(&admin);
        
        (env, admin, client)
    }
    
    // Helper to register authority, NO internal auth mocking
    fn _register_authority_internal(env: &Env, client: &AttestationContractClient, auth_to_reg: &Address, metadata: &str) {
        client.reg_auth(
            auth_to_reg,
            &SorobanString::from_str(env, metadata)
        );
    }
    
    // Helper to register schema, NO internal auth mocking
    fn _register_schema_internal(
        env: &Env,
        client: &AttestationContractClient,
        authority: &Address,
        definition: &str,
        resolver: Option<Address>,
        revocable: bool
    ) -> BytesN<32> {
        client.register_schema(
            authority,
            &SorobanString::from_str(env, definition),
            &resolver,
            &revocable
        )
    }
    
    // --- Initialization Tests ---
    
    #[test]
    fn test_initialization() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register_contract(None, AttestationContract);
        let client = AttestationContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        
        env.mock_all_auths(); 
        admin.require_auth();
        client.initialize(&admin);
        
        env.mock_all_auths(); 
        admin.require_auth();
        let result = client.try_initialize(&admin);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap().unwrap(), Error::AlreadyInitialized);
    }
    
    // --- Authority Registration Tests ---
    
    #[test]
    fn test_register_authority() {
        let (env, admin, client) = setup_env();
        
        let metadata = "Test Authority";
        let auth_address = Address::generate(&env);
        
        env.mock_all_auths(); 
        admin.require_auth();
        _register_authority_internal(&env, &client, &auth_address, metadata);
        
        env.mock_all_auths(); 
        auth_address.require_auth();
        let _schema_uid = _register_schema_internal(&env, &client, &auth_address, "Test Schema", None, true);
        
        let events = env.events().all();
        
        let auth_events = events.iter()
            .filter(|event: &(Address, Vec<soroban_sdk::Val>, soroban_sdk::Val)| {
                let (_contract_id, topics, _data) = event;
                if topics.len() >= 2 {
                    if let (Ok(topic1), Ok(topic2)) = (
                        Symbol::try_from_val(&env, &topics.get_unchecked(0)),
                        Symbol::try_from_val(&env, &topics.get_unchecked(1))
                    ) {
                        topic1 == symbol_short!("auth") && topic2 == symbol_short!("register")
                    } else { false }
                } else { false }
            })
            .count();
            
        assert_eq!(auth_events, 1, "Expected one auth register event");
    }
    
    #[test]
    fn test_register_authority_unauthorized() {
        let (env, _admin, client) = setup_env(); // admin is set up but not used as caller
        
        let non_admin = Address::generate(&env);
        let auth_address = Address::generate(&env);
        
        env.mock_all_auths();
        non_admin.require_auth(); 
        
        let result = client.try_reg_auth(
            &auth_address,
            &SorobanString::from_str(&env, "Test Authority")
        );
        
        assert!(result.is_err(), "Expected transaction to fail due to lack of admin auth");
    }
    
    // --- Schema Registration Tests ---
    
    #[test]
    fn test_register_schema_without_resolver() {
        let (env, admin, client) = setup_env();
        let auth = Address::generate(&env);
        
        env.mock_all_auths(); 
        admin.require_auth();
        _register_authority_internal(&env, &client, &auth, "Auth");
        
        env.mock_all_auths(); 
        auth.require_auth();
        let schema_def = "{ \"type\": \"object\", \"properties\": {} }";
        let _schema_uid = _register_schema_internal(&env, &client, &auth, schema_def, None, true); 
        
        assert!(true, "Schema registration succeeded"); 
    }
    
    #[test]
    fn test_register_schema_with_resolver() {
        let (env, admin, client) = setup_env();
        let auth = Address::generate(&env);
        let resolver_id = Address::generate(&env);
        
        env.mock_all_auths(); 
        admin.require_auth();
        _register_authority_internal(&env, &client, &auth, "Auth");
        
        env.mock_all_auths(); 
        auth.require_auth();
        let schema_def = "{ \"type\": \"object\", \"properties\": {} }";
        let _schema_uid = _register_schema_internal(
            &env,
            &client,
            &auth,
            schema_def,
            Some(resolver_id),
            true
        );
        
        assert!(true, "Schema registration with resolver succeeded");
    }
    
    // --- Attestation Tests ---
    
    #[test]
    fn test_create_and_get_attestation() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        
        env.mock_all_auths(); admin.require_auth();
        _register_authority_internal(&env, &client, &authority, "Auth");
        
        env.mock_all_auths(); authority.require_auth();
        let schema_uid = _register_schema_internal(&env, &client, &authority, "Schema", None, true);
        
        let recipient = Address::generate(&env);
        let attestation_data = Bytes::from_slice(&env, &[1, 2, 3]);
        let ref_uid: Option<BytesN<32>> = None;
        let value: Option<i128> = None;

        env.mock_all_auths(); authority.require_auth();
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
    fn test_attestation_with_reference_and_value() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        
        env.mock_all_auths(); admin.require_auth();
        _register_authority_internal(&env, &client, &authority, "Auth");
        env.mock_all_auths(); authority.require_auth();
        let schema_uid = _register_schema_internal(&env, &client, &authority, "Schema", None, true);
        
        let recipient = Address::generate(&env);
        let attestation_data = Bytes::from_slice(&env, &[1, 2, 3]);
        let first_uid = BytesN::from_array(&env, &[1; 32]);
        let value = Some(100i128);

        env.mock_all_auths(); authority.require_auth();
        let attestation_uid = client.attest(
            &authority,
            &attestation_data,
            &recipient,
            &schema_uid,
            &Some(env.ledger().timestamp() + 1000),
            &Some(first_uid.clone()),
            &value,
            &true
        );

        let fetched = client.get_attest(&attestation_uid);

        assert_eq!(fetched.ref_uid, Some(Bytes::from_slice(&env, &first_uid.to_array())));
        assert_eq!(fetched.value, value);
    }
    
    #[test]
    fn test_duplicate_attestation_fails() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        
        env.mock_all_auths(); admin.require_auth();
        _register_authority_internal(&env, &client, &authority, "Auth");
        env.mock_all_auths(); authority.require_auth();
        let schema_uid = _register_schema_internal(&env, &client, &authority, "Schema", None, true);
        
        let recipient = Address::generate(&env);
        let attestation_data = Bytes::from_slice(&env, &[7, 8, 9]);
        
        env.mock_all_auths(); authority.require_auth();
        client.attest(
            &authority,
            &attestation_data.clone(),
            &recipient,
            &schema_uid,
            &None,
            &None,
            &None,
            &true
        );
        
        env.mock_all_auths(); authority.require_auth();
        let result = client.try_attest(
            &authority,
            &attestation_data,
            &recipient,
            &schema_uid,
            &None,
            &None,
            &None,
            &true
        );
        
        assert!(result.is_err());
        assert_eq!(result.err().unwrap().unwrap(), Error::AttestationExists);
    }
    
    #[test]
    fn test_attest_fails_if_not_authority() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        let non_authority = Address::generate(&env);
        
        env.mock_all_auths(); admin.require_auth();
        _register_authority_internal(&env, &client, &authority, "Auth");
        env.mock_all_auths(); authority.require_auth();
        let schema_uid = _register_schema_internal(&env, &client, &authority, "Schema", None, true);
        
        let recipient = Address::generate(&env);
        let attestation_data = Bytes::from_slice(&env, &[7, 8, 9]);
        let ref_uid: Option<BytesN<32>> = None;
        let value: Option<i128> = None;

        env.mock_all_auths(); 
        non_authority.require_auth();

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
    
    // --- Revocation Tests ---
    
    #[test]
    fn test_revoke_attestation() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        
        env.mock_all_auths(); admin.require_auth();
        _register_authority_internal(&env, &client, &authority, "Auth");
        env.mock_all_auths(); authority.require_auth();
        let schema_uid = _register_schema_internal(&env, &client, &authority, "Schema", None, true);
        
        let recipient = Address::generate(&env);
        let attestation_data = Bytes::from_slice(&env, &[4, 5, 6]);
        let ref_uid: Option<BytesN<32>> = None;
        let value: Option<i128> = None;

        env.mock_all_auths(); authority.require_auth();
        let att_uid = client.attest(
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

        env.mock_all_auths(); authority.require_auth();
        client.revoke_attest(
            &authority,
            &att_uid
        );

        let fetched_attestation = client.get_attest(&att_uid);

        assert!(fetched_attestation.revocation_time.is_some());
        assert_eq!(fetched_attestation.revocation_time.unwrap(), revocation_time);
    }
    
    #[test]
    fn test_revoke_non_revocable_attestation_fails() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        
        env.mock_all_auths(); admin.require_auth();
        _register_authority_internal(&env, &client, &authority, "Auth");
        env.mock_all_auths(); authority.require_auth();
        let schema_uid = _register_schema_internal(&env, &client, &authority, "Schema", None, true);
        
        let recipient = Address::generate(&env);
        let attestation_data = Bytes::from_slice(&env, &[10, 11, 12]);
        let ref_uid: Option<BytesN<32>> = None;
        let value: Option<i128> = None;

        env.mock_all_auths(); authority.require_auth();
        let att_uid = client.attest(
            &authority,
            &attestation_data,
            &recipient,
            &schema_uid,
            &None,
            &ref_uid,
            &value,
            &false // Not revocable
        );

        env.mock_all_auths(); authority.require_auth();
        let result = client.try_revoke_attest(
            &authority,
            &att_uid
        );
        
        assert!(result.is_err());
        assert_eq!(result.err().unwrap().unwrap(), Error::NotAuthorized);
    }
    
    #[test]
    fn test_revoke_by_non_schema_authority_fails() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        let different_auth = Address::generate(&env);
        
        env.mock_all_auths(); admin.require_auth();
        _register_authority_internal(&env, &client, &authority, "Auth");
        
        env.mock_all_auths(); authority.require_auth();
        let schema_uid = _register_schema_internal(&env, &client, &authority, "Schema", None, true);
        
        let recipient = Address::generate(&env);
        let attestation_data = Bytes::from_slice(&env, &[13, 14, 15]);
        let ref_uid: Option<BytesN<32>> = None;
        let value: Option<i128> = None;

        env.mock_all_auths(); authority.require_auth();
        let att_uid = client.attest(
            &authority,
            &attestation_data,
            &recipient,
            &schema_uid,
            &None,
            &ref_uid,
            &value,
            &true
        );

        env.mock_all_auths();
        different_auth.require_auth(); 

        let result = client.try_revoke_attest(
            &different_auth,
            &att_uid
        );
        
        assert!(result.is_err());
        assert_eq!(result.err().unwrap().unwrap(), Error::NotAuthorized);
    }
    
    #[test]
    fn test_revoke_non_existent_attestation_fails() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        
        env.mock_all_auths(); admin.require_auth();
        _register_authority_internal(&env, &client, &authority, "Auth");
        
        let non_existent_uid = BytesN::from_array(&env, &[0; 32]);
        
        env.mock_all_auths(); authority.require_auth();
        let result = client.try_revoke_attest(&authority, &non_existent_uid);
        
        assert!(result.is_err());
        assert_eq!(result.err().unwrap().unwrap(), Error::AttestationNotFound);
    }
    
    // --- Query Tests ---
    
    #[test]
    fn test_get_non_existent_attestation_fails() {
        let (env, _admin, client) = setup_env(); 
        
        let non_existent_uid = BytesN::from_array(&env, &[0; 32]);
        
        let result = client.try_get_attest(&non_existent_uid);
        
        assert!(result.is_err());
        assert_eq!(result.err().unwrap().unwrap(), Error::AttestationNotFound);
    }
} 