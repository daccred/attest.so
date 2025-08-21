use protocol::{AttestationContract, AttestationContractClient};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events, Ledger, MockAuth, MockAuthInvoke},
    Address, BytesN, Env, IntoVal, String as SorobanString, TryIntoVal,
};

#[test]
fn create_and_get_attestation() {
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
        r#"{"name":"Simple","version":"1.0","description":"Simple","fields":[]}"#,
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

    // attest
    let value = SorobanString::from_str(&env, "{\"foo\":\"bar\"}");
    let expiration_time = Some(123456789u64);
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
    let nonce: u64 = client.attest(&attester, &schema_uid, &subject, &value, &expiration_time);

    // verify event shape
    let events = env.events().all();
    let last = events.last().unwrap();
    assert_eq!(last.0, contract_id);
    let expected_topics = (symbol_short!("ATTEST"), symbol_short!("CREATE")).into_val(&env);
    assert_eq!(last.1, expected_topics);
    let (_schema_uid_ev, subject_ev, attester_ev, value_ev, nonce_ev, timestamp_ev): (
        BytesN<32>,
        Address,
        Address,
        SorobanString,
        u64,
        u64,
    ) = last.2.try_into_val(&env).unwrap();
    assert_eq!(subject_ev, subject);
    assert_eq!(attester_ev, attester);
    assert_eq!(value_ev, value);
    assert_eq!(nonce_ev, nonce);
    let _ = timestamp_ev; // timestamp may be zero in test env; no assertion

    // get attestation and verify
    let fetched = client.get_attestation(&schema_uid, &subject, &nonce);
    assert_eq!(fetched.schema_uid, schema_uid);
    assert_eq!(fetched.subject, subject);
    assert_eq!(fetched.attester, attester);
    assert_eq!(fetched.value, value);
    assert_eq!(fetched.nonce, nonce);
    assert_eq!(fetched.expiration_time, expiration_time);
    assert_eq!(fetched.revoked, false);
}

// Happy Path Scenarios

#[test]
fn test_attestation_without_expiration() {
    // Attestation without an expiration time: The current test includes an expiration time.
    // You should add a test where expiration_time is None to ensure it's handled correctly.
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
}

#[test]
fn test_attestation_with_non_revocable_schema() {
    // Attestation with a non-revocable schema: The schema in the test is revocable.
    // Test the attestation flow with a schema where revocable is false.
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
}

#[test]
fn test_multiple_attestations_for_same_subject_and_schema() {
	// Multiple attestations for the same subject and schema: A subject can have multiple attestations for the same schema.
	// The test should create several attestations for the same (schema_uid, subject) pair and verify that they are all stored and retrievable with their unique nonces.
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
		r#"{"name":"Simple","version":"1.0","description":"Simple","fields":[]}"#,
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

	// attest - 1
	let value1 = SorobanString::from_str(&env, "{\"foo\":\"bar1\"}");
	let expiration_time1: Option<u64> = None;
	env.mock_auths(&[MockAuth {
		address: &attester,
		invoke: &MockAuthInvoke {
			contract: &contract_id,
			fn_name: "attest",
			args: (
				attester.clone(),
				schema_uid.clone(),
				subject.clone(),
				value1.clone(),
				expiration_time1.clone(),
			)
				.into_val(&env),
			sub_invokes: &[],
		},
	}]);
	let nonce1: u64 = client.attest(&attester, &schema_uid, &subject, &value1, &expiration_time1);
	assert_eq!(nonce1, 0);

	// attest - 2
	let value2 = SorobanString::from_str(&env, "{\"foo\":\"bar2\"}");
	let expiration_time2 = Some(123456789u64);
	env.mock_auths(&[MockAuth {
		address: &attester,
		invoke: &MockAuthInvoke {
			contract: &contract_id,
			fn_name: "attest",
			args: (
				attester.clone(),
				schema_uid.clone(),
				subject.clone(),
				value2.clone(),
				expiration_time2.clone(),
			)
				.into_val(&env),
			sub_invokes: &[],
		},
	}]);
	let nonce2: u64 = client.attest(&attester, &schema_uid, &subject, &value2, &expiration_time2);
	assert_eq!(nonce2, 1);

	// attest - 3
	let value3 = SorobanString::from_str(&env, "{\"foo\":\"bar3\"}");
	let expiration_time3: Option<u64> = None;
	env.mock_auths(&[MockAuth {
		address: &attester,
		invoke: &MockAuthInvoke {
			contract: &contract_id,
			fn_name: "attest",
			args: (
				attester.clone(),
				schema_uid.clone(),
				subject.clone(),
				value3.clone(),
				expiration_time3.clone(),
			)
				.into_val(&env),
			sub_invokes: &[],
		},
	}]);
	let nonce3: u64 = client.attest(&attester, &schema_uid, &subject, &value3, &expiration_time3);
	assert_eq!(nonce3, 2);

	// get attestations and verify
	let fetched1 = client.get_attestation(&schema_uid, &subject, &nonce1);
	assert_eq!(fetched1.nonce, nonce1);
	assert_eq!(fetched1.value, value1);
	assert_eq!(fetched1.expiration_time, expiration_time1);

	let fetched2 = client.get_attestation(&schema_uid, &subject, &nonce2);
	assert_eq!(fetched2.nonce, nonce2);
	assert_eq!(fetched2.value, value2);
	assert_eq!(fetched2.expiration_time, expiration_time2);

	let fetched3 = client.get_attestation(&schema_uid, &subject, &nonce3);
	assert_eq!(fetched3.nonce, nonce3);
	assert_eq!(fetched3.value, value3);
	assert_eq!(fetched3.expiration_time, expiration_time3);
}

#[test]
fn test_multiple_attesters() {
    // Multiple attesters: Test that different attesters can create attestations for the same subject and schema.
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
}

// Unhappy Path and Edge Case Scenarios

#[test]
#[should_panic]
fn test_attesting_with_unregistered_schema() {
    // Attesting with an unregistered schema: Attempting to create an attestation with a schema_uid that has not been registered should fail.
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
}

#[test]
#[should_panic]
fn test_querying_non_existent_attestation() {
    // Querying a non-existent attestation: Trying to get_attestation with a schema_uid, subject, or nonce that doesn't correspond to an existing attestation should be handled gracefully (e.g., panic with a specific error).
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
}

#[test]
#[should_panic(expected = "expiration time must be in the future")]
fn test_attest_with_past_expiration_fails() {
	// Test creating an attestation with an expiration time in the past. This should fail.
	let env = Env::default();
	let contract_id = env.register(AttestationContract {}, ());
	let client = AttestationContractClient::new(&env, &contract_id);
	let admin = Address::generate(&env);
	let attester = Address::generate(&env);
	let subject = Address::generate(&env);

	// Mock all authorizations
	env.mock_all_auths();

	// initialize
	client.initialize(&admin);

	// register schema
	let schema_definition = SorobanString::from_str(
		&env,
		r#"{"name":"Simple","version":"1.0","description":"Simple","fields":[]}"#,
	);
	let resolver: Option<Address> = None;
	let revocable = true;
	let schema_uid: BytesN<32> =
		client.register(&attester, &schema_definition, &resolver, &revocable);

	// attest with a past expiration time
	let value = SorobanString::from_str(&env, "{\"foo\":\"bar\"}");
	let expiration_time = Some(999); // In the past

	// Set the ledger timestamp to be in the "future" relative to the expiration time
	env.ledger().set(soroban_sdk::testutils::LedgerInfo {
		timestamp: 1000,
		..Default::default()
	});

	client.attest(&attester, &schema_uid, &subject, &value, &expiration_time);
}

#[test]
fn test_handling_expired_attestations() {
    // Handling expired attestations: If an attestation has an expiration_time, you should test what happens when it is queried after this time.
    // You can manipulate the ledger timestamp in the test environment for this.
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
}
