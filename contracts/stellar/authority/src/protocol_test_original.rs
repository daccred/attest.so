use crate::{errors, AttestationContract, AttestationContractClient, state::DelegatedAttestationRequest};
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke, Ledger},
    Address, BytesN, Env, IntoVal, String as SorobanString,
};

// Helper to initialize contract and return client, authority, schema UID, and contract ID
fn setup() -> (Env, AttestationContractClient<'static>, Address, soroban_sdk::BytesN<32>, Address) {
    let env = Env::default();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "initialize",
            args: (admin.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.initialize(&admin);

    // Register a simple schema for tests
    let schema_def = SorobanString::from_str(&env, "test schema");
    let authority = admin.clone();
    env.mock_auths(&[MockAuth {
        address: &authority,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "register",
            args: (authority.clone(), schema_def.clone(), None::<Address>, true).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let schema_uid = client.register(&authority, &schema_def, &None, &true);

    (env, client, authority, schema_uid, contract_id)
}

#[test]
fn test_schema_registration_prevents_duplicates() {
    let (env, client, authority, schema_uid, contract_id) = setup();
    // Attempt to register the same schema again
    let schema_def = SorobanString::from_str(&env, "test schema");
    env.mock_auths(&[MockAuth {
        address: &authority,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "register",
            args: (authority.clone(), schema_def.clone(), None::<Address>, true).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let duplicate = client.try_register(&authority, &schema_def, &None, &true);
    assert!(duplicate.is_err());
    // TODO: Test fails because register() does not prevent duplicate schemas
    // RECOMMENDATION: Add existence check in register_schema before storing
}

#[test]
fn test_attestation_nonce_management() {
    let (env, client, attester, schema_uid, contract_id) = setup();
    let subject = Address::generate(&env);
    let value = SorobanString::from_str(&env, "degree:1");

    env.mock_auths(&[MockAuth {
        address: &attester,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "attest",
            args: (attester.clone(), schema_uid.clone(), subject.clone(), value.clone(), None::<u64>).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let nonce0 = client.attest(&attester, &schema_uid, &subject, &value, &None);
    assert_eq!(nonce0, 0);

    env.mock_auths(&[MockAuth {
        address: &attester,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "attest",
            args: (attester.clone(), schema_uid.clone(), subject.clone(), value.clone(), None::<u64>).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let nonce1 = client.attest(&attester, &schema_uid, &subject, &value, &None);
    assert_eq!(nonce1, 1);

    let res = client.try_get_attestation(&schema_uid, &subject, &99);
    assert!(matches!(res.err().unwrap().unwrap(), errors::Error::AttestationNotFound));
}

#[test]
fn test_attestation_expiration_handling() {
    let (env, client, attester, schema_uid, contract_id) = setup();
    let subject = Address::generate(&env);
    let value = SorobanString::from_str(&env, "temp");
    let now = env.ledger().timestamp();
    let exp = now + 10;

    env.mock_auths(&[MockAuth {
        address: &attester,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "attest",
            args: (attester.clone(), schema_uid.clone(), subject.clone(), value.clone(), Some(exp)).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let nonce = client.attest(&attester, &schema_uid, &subject, &value, &Some(exp));

    let ok = client.try_get_attestation(&schema_uid, &subject, &nonce);
    assert!(ok.is_ok());

    env.ledger().set_timestamp(exp + 1);
    let expired = client.try_get_attestation(&schema_uid, &subject, &nonce);
    assert!(matches!(expired.err().unwrap().unwrap(), errors::Error::AttestationExpired));
}

#[test]
fn test_delegated_attestation_nonce_replay_protection() {
    let (env, client, attester, schema_uid, contract_id) = setup();
    let submitter = Address::generate(&env);
    let subject = Address::generate(&env);
    let value = SorobanString::from_str(&env, "delegated");
    let deadline = env.ledger().timestamp() + 100;

    // Register BLS key for attester
    let bls_key = BytesN::from_array(&env, &[2u8; 96]);
    env.mock_auths(&[MockAuth {
        address: &attester,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "register_bls_key",
            args: (attester.clone(), bls_key.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.register_bls_key(&attester, &bls_key);

    // Use incorrect nonce to trigger replay protection
    let bad_request = DelegatedAttestationRequest {
        schema_uid: schema_uid.clone(),
        subject: subject.clone(),
        attester: attester.clone(),
        value: value.clone(),
        nonce: 1, // first expected nonce is 0
        deadline,
        expiration_time: None,
        signature: BytesN::from_array(&env, &[0u8; 96]),
    };

    env.mock_auths(&[MockAuth {
        address: &submitter,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "attest_by_delegation",
            args: (submitter.clone(), bad_request.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let res = client.try_attest_by_delegation(&submitter, &bad_request);
    assert!(matches!(res.err().unwrap().unwrap(), errors::Error::InvalidNonce));
}

#[test]
fn test_revocation_permissions_and_nonexistent() {
    let (env, client, attester, schema_uid, contract_id) = setup();
    let subject = Address::generate(&env);
    let value = SorobanString::from_str(&env, "value");

    env.mock_auths(&[MockAuth {
        address: &attester,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "attest",
            args: (attester.clone(), schema_uid.clone(), subject.clone(), value.clone(), None::<u64>).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let nonce = client.attest(&attester, &schema_uid, &subject, &value, &None);

    let unauthorized = Address::generate(&env);
    env.mock_auths(&[MockAuth {
        address: &unauthorized,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "revoke_attestation",
            args: (unauthorized.clone(), schema_uid.clone(), subject.clone(), nonce).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let unauth_res = client.try_revoke_attestation(&unauthorized, &schema_uid, &subject, &nonce);
    assert!(matches!(unauth_res.err().unwrap().unwrap(), errors::Error::NotAuthorized));

    env.mock_auths(&[MockAuth {
        address: &attester,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "revoke_attestation",
            args: (attester.clone(), schema_uid.clone(), subject.clone(), nonce).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.revoke_attestation(&attester, &schema_uid, &subject, &nonce);

    env.mock_auths(&[MockAuth {
        address: &attester,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "revoke_attestation",
            args: (attester.clone(), schema_uid.clone(), subject.clone(), nonce).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    env.mock_auths(&[MockAuth {
        address: &attester,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "revoke_attestation",
            args: (attester.clone(), schema_uid.clone(), subject.clone(), 99).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let second = client.try_revoke_attestation(&attester, &schema_uid, &subject, &nonce);
    assert!(second.is_err());
    // TODO: Verify specific error once error mapping is exposed

    let nonexist = client.try_revoke_attestation(&attester, &schema_uid, &subject, &99);
    assert!(nonexist.is_err());
    // TODO: Should return Error::AttestationNotFound
}