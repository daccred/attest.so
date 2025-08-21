use protocol::{AttestationContract, AttestationContractClient};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events, MockAuth, MockAuthInvoke},
    Address, BytesN, Env, IntoVal, String as SorobanString, TryIntoVal,
};

#[test]
fn revoke_attestation_by_nonce() {
    let env = Env::default();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attester = Address::generate(&env);
    let subject = Address::generate(&env);

    // initialize
    let admin_clone_for_init_args = admin.clone();
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "initialize",
            args: (admin_clone_for_init_args,).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.initialize(&admin);

    // register schema
    let schema_definition = SorobanString::from_str(
        &env,
        r#"{"name":"Revocable","version":"1.0","description":"Revocable","fields":[]}"#,
    );
    let resolver: Option<Address> = None;
    let revocable = true;
    env.mock_auths(&[MockAuth {
        address: &attester,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "register",
            args: (
                attester.clone(),
                schema_definition.clone(),
                resolver.clone(),
                revocable,
            )
                .into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let schema_uid: BytesN<32> =
        client.register(&attester, &schema_definition, &resolver, &revocable);

    // create attestation
    let value = SorobanString::from_str(&env, "{\"k\":\"v\"}");
    let expiration_time = None;
    env.mock_auths(&[MockAuth {
        address: &attester,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "attest",
            args: (
                attester.clone(),
                schema_uid.clone(),
                subject.clone(),
                value.clone(),
                expiration_time.clone(),
            )
                .into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let attestation_uid: BytesN<32> = client.attest(&attester, &schema_uid, &subject, &value, &expiration_time);

    // revoke by attester
    env.mock_auths(&[MockAuth {
        address: &attester,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "revoke_attestation",
            args: (attester.clone(), attestation_uid.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.revoke_attestation(&attester, &attestation_uid);

    // verify revocation event shape
    let events = env.events().all();
    let last = events.last().unwrap();
    assert_eq!(last.0, contract_id);
    let expected_topics = (symbol_short!("ATTEST"), symbol_short!("REVOKE")).into_val(&env);
    assert_eq!(last.1, expected_topics);
    let (_schema_uid_ev, subject_ev, attester_ev, attestation_uid_ev, revocation_time_ev): (
        BytesN<32>,
        Address,
        Address, BytesN<32>,
        Option<u64>,
    ) = last.2.try_into_val(&env).unwrap();
    assert_eq!(subject_ev, subject);
    assert_eq!(attester_ev, attester);
    assert_eq!(attestation_uid_ev, attestation_uid);
    assert!(revocation_time_ev.is_some());

    // verify state reflects revocation
    let fetched = client.get_attestation(&attestation_uid);
    assert!(fetched.revoked);
    assert!(fetched.revocation_time.is_some());
}
