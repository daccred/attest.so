#![cfg(test)]
use soroban_sdk::{
    testutils::{Address as _, BytesN as _, Events},
    Address, Env, String as SorobanString, BytesN,
    Bytes,
};
use crate::{AuthorityResolverContract, AuthorityResolverContractClient, Error, AttestationRecord, SchemaLevyInfo};

fn setup_env<'a>() -> (Env, Address, Address, AuthorityResolverContractClient<'a>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, AuthorityResolverContract);
    let client = AuthorityResolverContractClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, contract_id, admin, client)
}

fn create_dummy_attestation(env: &Env, attester: &Address, schema_uid: &BytesN<32>) -> AttestationRecord {
    AttestationRecord {
        uid: BytesN::from_array(env, &[0; 32]), // Dummy UID
        schema_uid: schema_uid.clone(),
        recipient: Address::generate(env),
        attester: attester.clone(),
        time: env.ledger().timestamp(),
        expiration_time: None,
        revocable: true,
        ref_uid: None,
        data: Bytes::new(env),
        value: None,
    }
}

#[test]
fn test_initialize() {
    let (_env, _contract_id, admin, client) = setup_env();

    let reinit_result = client.try_initialize(&admin);
    assert!(matches!(reinit_result.err().unwrap().unwrap(), Error::AlreadyInitialized));
}

#[test]
fn test_admin_register_authority() {
    let (env, contract_id, admin, client) = setup_env();

    let authority = Address::generate(&env);
    let metadata = SorobanString::from_str(&env, "Test Authority Metadata");

    client.admin_register_authority(&admin, &authority, &metadata);

    assert!(client.is_authority(&authority));

    let unauthorized_user = Address::generate(&env);

    let env_unauth = Env::default();
    let client_unauth = AuthorityResolverContractClient::new(&env_unauth, &contract_id);
}

#[test]
fn test_admin_set_schema_levy() {
    let (env, _contract_id, admin, client) = setup_env();

    let schema_uid = BytesN::random(&env);
    let levy_amount: i128 = 100;
    let authority_for_levy = Address::generate(&env);

    client.admin_register_authority(&admin, &authority_for_levy, &SorobanString::from_str(&env, "Levy Authority"));
    assert!(client.is_authority(&authority_for_levy));

    client.admin_set_schema_levy(&admin, &schema_uid, &levy_amount, &authority_for_levy);

    let levy_info_option = client.get_schema_levy(&schema_uid);
    assert!(levy_info_option.is_some());
    let levy_info = levy_info_option.unwrap();
    assert_eq!(levy_info.levy_amount, levy_amount);
    assert_eq!(levy_info.authority_for_levy, authority_for_levy);
}

#[test]
fn test_attest_hook() {
    let (env, _contract_id, admin, client) = setup_env();

    let authority = Address::generate(&env);
    let non_authority = Address::generate(&env);
    let schema_uid_no_levy: BytesN<32> = BytesN::from_array(&env, &[1; 32]);
    let schema_uid_with_levy: BytesN<32> = BytesN::from_array(&env, &[2; 32]);
    let levy_amount = 5_000_000;

    client.admin_register_authority(&admin, &authority, &SorobanString::from_str(&env, "Attester"));
    client.admin_set_schema_levy(&admin, &schema_uid_with_levy, &levy_amount, &authority);

    let attestation1 = create_dummy_attestation(&env, &authority, &schema_uid_no_levy);
    let result1 = client.try_attest(&attestation1);
    assert_eq!(result1, Ok(Ok(true)));

    let attestation2 = create_dummy_attestation(&env, &authority, &schema_uid_with_levy);
    let result2 = client.try_attest(&attestation2);
    assert_eq!(result2, Ok(Ok(true)));

    let attestation3 = create_dummy_attestation(&env, &non_authority, &schema_uid_no_levy);
    let result3 = client.try_attest(&attestation3);
    assert!(matches!(result3.err().unwrap().unwrap(), Error::AttesterNotAuthority));
}

#[test]
fn test_revoke_hook() {
    let (env, _contract_id, admin, client) = setup_env();

    let authority = Address::generate(&env);
    let non_authority = Address::generate(&env);
    let schema_uid: BytesN<32> = BytesN::from_array(&env, &[1; 32]);

    client.admin_register_authority(&admin, &authority, &SorobanString::from_str(&env, "Revoker"));

    let attestation1 = create_dummy_attestation(&env, &authority, &schema_uid);
    let result1 = client.try_revoke(&attestation1);
    assert_eq!(result1, Ok(Ok(true)));

    let attestation2 = create_dummy_attestation(&env, &non_authority, &schema_uid);
    let result2 = client.try_revoke(&attestation2);
    assert!(matches!(result2.err().unwrap().unwrap(), Error::AttesterNotAuthority));
} 