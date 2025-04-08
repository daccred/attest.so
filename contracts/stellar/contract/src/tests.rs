use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke, Events},
    Address, Env, String as SorobanString, BytesN, IntoVal, vec, symbol_short, Symbol, TryFromVal,
};
use crate::{AttestationContract, AttestationContractClient, errors, state::{Authority, Schema, AttestationRecord}};

#[test]
fn test_initialization() {
    // Setup environment
    let env = Env::default();
    let contract_id = env.register_contract(None, AttestationContract {});
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    // Initialize the contract with admin authorization
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

    let init_result = client.try_initialize(&admin);
    assert!(init_result.is_ok());

    // Test that re-initialization fails
    let admin_clone_for_reinit_args = admin.clone();
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "initialize",
            args: (admin_clone_for_reinit_args,).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let reinit_result = client.try_initialize(&admin);
    assert!(matches!(reinit_result.err().unwrap().unwrap(), errors::Error::AlreadyInitialized));
}

#[test]
fn test_authority_registration() {
    // Setup environment
    let env = Env::default();
    let contract_id = env.register_contract(None, AttestationContract {});
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let university = Address::generate(&env);

    // Initialize the contract
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

    // Verify admin is set correctly (requires direct storage access or a helper function, cannot use client)
    // Let's assume initialization worked and proceed. We can add a get_admin function later if needed.

    // Test successful authority registration
    let auth_metadata = "University Authority";
    let auth_metadata_val = SorobanString::from_str(&env, auth_metadata);
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "reg_auth",
            args: (admin.clone(), university.clone(), auth_metadata_val.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let reg_result = client.try_reg_auth(&admin, &university, &auth_metadata_val);
    assert!(reg_result.is_ok());

    // Verify authority was registered (requires direct storage access or helper)
    // Assuming success based on ok result for now.

    // Test registering same authority again (should overwrite)
    let updated_metadata = "Updated University Authority";
    let updated_metadata_val = SorobanString::from_str(&env, updated_metadata);
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "reg_auth",
            args: (admin.clone(), university.clone(), updated_metadata_val.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let update_result = client.try_reg_auth(&admin, &university, &updated_metadata_val);
    assert!(update_result.is_ok());

    // Verify authority was updated (requires direct storage access or helper)
    // Assuming success based on ok result for now.

    // Test unauthorized registration attempt
    let unauthorized = Address::generate(&env);
    let unauthorized_auth = Address::generate(&env);
    let unauthorized_metadata = "Unauthorized";
    let unauthorized_metadata_val = SorobanString::from_str(&env, unauthorized_metadata);
    env.mock_auths(&[MockAuth {
        address: &unauthorized,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "reg_auth",
            args: (unauthorized.clone(), unauthorized_auth.clone(), unauthorized_metadata_val.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let unauthorized_result = client.try_reg_auth(&unauthorized, &unauthorized_auth, &unauthorized_metadata_val);
    assert!(matches!(unauthorized_result.err().unwrap().unwrap(), errors::Error::NotAuthorized));
}

#[test]
fn test_schema_registration() {
    // Setup environment
    let env = Env::default();
    let contract_id = env.register_contract(None, AttestationContract {});
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let university = Address::generate(&env);

    // Initialize the contract
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

    // Register authority
    let auth_metadata = "University Authority";
    let auth_metadata_val = SorobanString::from_str(&env, auth_metadata);
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "reg_auth",
            args: (admin.clone(), university.clone(), auth_metadata_val.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.reg_auth(&admin, &university, &auth_metadata_val);

    // Test successful schema registration
    let schema_definition = r#"{
        "name": "Degree",
        "version": "1.0",
        "description": "University degree attestation",
        "fields": [
            {"name": "degree", "type": "string"},
            {"name": "field", "type": "string"},
            {"name": "graduation_date", "type": "string"}
        ]
    }"#;
    let schema_definition_val = SorobanString::from_str(&env, schema_definition);
    let resolver_option: Option<Address> = None;
    let revocable = true;
    env.mock_auths(&[MockAuth {
        address: &university,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "register",
            args: (university.clone(), schema_definition_val.clone(), resolver_option.clone(), revocable).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let schema_uid_result = client.try_register(&university, &schema_definition_val, &resolver_option, &revocable);
    assert!(schema_uid_result.is_ok());
    // let schema_uid = schema_uid_result.unwrap().unwrap(); // If needed for later verification

    // Test registering schema with resolver
    let resolver = Address::generate(&env);
    let resolver_option_some = Some(resolver.clone());
    let revocable_false = false;
    env.mock_auths(&[MockAuth {
        address: &university,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "register",
            args: (university.clone(), schema_definition_val.clone(), resolver_option_some.clone(), revocable_false).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let schema_uid_resolver_result = client.try_register(&university, &schema_definition_val, &resolver_option_some, &revocable_false);
    assert!(schema_uid_resolver_result.is_ok());

    // Test unauthorized schema registration
    let unauthorized = Address::generate(&env);
    env.mock_auths(&[MockAuth {
        address: &unauthorized,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "register",
            args: (unauthorized.clone(), schema_definition_val.clone(), resolver_option.clone(), revocable).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_register(&unauthorized, &schema_definition_val, &resolver_option, &revocable);
    assert!(matches!(result.err().unwrap().unwrap(), errors::Error::AuthorityNotRegistered));
}

#[test]
fn test_attestation() {
    // Setup environment
    let env = Env::default();
    let contract_id = env.register_contract(None, AttestationContract {});
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let university = Address::generate(&env);
    let student_alice = Address::generate(&env);

    // Initialize the contract
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

    // Register authority
    let auth_metadata = "University Authority";
    let auth_metadata_val = SorobanString::from_str(&env, auth_metadata);
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "reg_auth",
            args: (admin.clone(), university.clone(), auth_metadata_val.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.reg_auth(&admin, &university, &auth_metadata_val);

    // Register schema
    let schema_definition = r#"{
        "name": "Degree",
        "version": "1.0",
        "description": "University degree attestation",
        "fields": [
            {"name": "degree", "type": "string"},
            {"name": "field", "type": "string"},
            {"name": "graduation_date", "type": "string"}
        ]
    }"#;
    let schema_definition_val = SorobanString::from_str(&env, schema_definition);
    let resolver_option: Option<Address> = None;
    let revocable = true;
    env.mock_auths(&[MockAuth {
        address: &university,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "register",
            args: (university.clone(), schema_definition_val.clone(), resolver_option.clone(), revocable).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let schema_uid = client.register(&university, &schema_definition_val, &resolver_option, &revocable);

    // Test successful attestation
    let attestation_value = r#"{
        "degree": "Bachelor of Science",
        "field": "Computer Science",
        "graduation_date": "2024-05-15"
    }"#;
    let attestation_value_val = SorobanString::from_str(&env, attestation_value);
    let reference_option: Option<SorobanString> = None;
    env.mock_auths(&[MockAuth {
        address: &university,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "attest",
            args: (university.clone(), schema_uid.clone(), student_alice.clone(), attestation_value_val.clone(), reference_option.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let attest_result = client.try_attest(&university, &schema_uid, &student_alice, &attestation_value_val, &reference_option);
    assert!(attest_result.is_ok());

    // Verify attestation was recorded using the client's get_attestation method
    let attestation = client.get_attestation(&schema_uid, &student_alice, &reference_option);
    assert_eq!(attestation.schema_uid, schema_uid);
    assert_eq!(attestation.subject, student_alice);
    assert_eq!(attestation.value, attestation_value_val);
    assert!(!attestation.revoked);

    // Test unauthorized attestation
    let unauthorized = Address::generate(&env);
    env.mock_auths(&[MockAuth {
        address: &unauthorized,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "attest",
            args: (unauthorized.clone(), schema_uid.clone(), student_alice.clone(), attestation_value_val.clone(), reference_option.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let unauthorized_result = client.try_attest(&unauthorized, &schema_uid, &student_alice, &attestation_value_val, &reference_option);
    assert!(matches!(unauthorized_result.err().unwrap().unwrap(), errors::Error::NotAuthorized));
}

#[test]
fn test_revocation() {
    // Setup environment
    let env = Env::default();
    let contract_id = env.register_contract(None, AttestationContract {});
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let university = Address::generate(&env);
    let student_alice = Address::generate(&env);

    // Initialize the contract
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

    // Register authority
    let auth_metadata = "University Authority";
    let auth_metadata_val = SorobanString::from_str(&env, auth_metadata);
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "reg_auth",
            args: (admin.clone(), university.clone(), auth_metadata_val.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.reg_auth(&admin, &university, &auth_metadata_val);

    // Register schema (revocable = true)
    let schema_definition = r#"{
        "name": "Degree",
        "version": "1.0",
        "description": "University degree attestation",
        "fields": [
            {"name": "degree", "type": "string"},
            {"name": "field", "type": "string"},
            {"name": "graduation_date", "type": "string"}
        ]
    }"#;
    let schema_definition_val = SorobanString::from_str(&env, schema_definition);
    let resolver_option: Option<Address> = None;
    let revocable = true;
    env.mock_auths(&[MockAuth {
        address: &university,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "register",
            args: (university.clone(), schema_definition_val.clone(), resolver_option.clone(), revocable).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    let schema_uid = client.register(&university, &schema_definition_val, &resolver_option, &revocable);

    // Create attestation
    let attestation_value = r#"{
        "degree": "Bachelor of Science",
        "field": "Computer Science",
        "graduation_date": "2024-05-15"
    }"#;
    let attestation_value_val = SorobanString::from_str(&env, attestation_value);
    let reference_option: Option<SorobanString> = None;
    env.mock_auths(&[MockAuth {
        address: &university,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "attest",
            args: (university.clone(), schema_uid.clone(), student_alice.clone(), attestation_value_val.clone(), reference_option.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.attest(&university, &schema_uid, &student_alice, &attestation_value_val, &reference_option);

    // Test successful revocation
    env.mock_auths(&[MockAuth {
        address: &university,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "revoke_attestation",
            args: (university.clone(), schema_uid.clone(), student_alice.clone(), reference_option.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let revoke_result = client.try_revoke_attestation(&university, &schema_uid, &student_alice, &reference_option);
    assert!(revoke_result.is_ok());

    // Verify attestation was revoked
    let attestation = client.get_attestation(&schema_uid, &student_alice, &reference_option);
    assert!(attestation.revoked);

    // Test unauthorized revocation
    let unauthorized = Address::generate(&env);
    env.mock_auths(&[MockAuth {
        address: &unauthorized,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "revoke_attestation",
            args: (unauthorized.clone(), schema_uid.clone(), student_alice.clone(), reference_option.clone()).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let unauthorized_result = client.try_revoke_attestation(&unauthorized, &schema_uid, &student_alice, &reference_option);
    assert!(matches!(unauthorized_result.err().unwrap().unwrap(), errors::Error::AuthorityNotRegistered));
}
