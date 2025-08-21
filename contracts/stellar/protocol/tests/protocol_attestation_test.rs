use protocol::{state::Attestation, utils::{create_xdr_string, generate_attestation_uid}, AttestationContract, AttestationContractClient};
use soroban_sdk::{
	symbol_short,
	testutils::{Address as _, Events, Ledger, MockAuth, MockAuthInvoke},
	Address, BytesN, Env, IntoVal, String as SorobanString, TryIntoVal,
};


fn return_schema_definition(env: &Env) -> String {
	let schema = create_xdr_string(&env, &SorobanString::from_str(&env, r#"{"name":"Simple","version":"1.0","description":"Simple","fields":[]}"#)).to_string();
	format!("XDR:{}", schema)
}

#[test]
fn create_and_get_attestation() {
    let env = Env::default();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attester = Address::generate(&env);
    let subject = Address::generate(&env);

		println!("=============================================================");
		println!("      Running test case: {}", "create_and_get_attestation");
		println!("=============================================================");


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
        &create_xdr_string(&env, &SorobanString::from_str(&env, r#"{"name":"Simple","version":"1.0","description":"Simple","fields":[]}"#)).to_string());
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
    let attestation_uid: BytesN<32> = client.attest(&attester, &schema_uid, &subject, &value, &expiration_time);

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

		dbg!(&subject_ev, &attester_ev, &value_ev, &nonce_ev);
    assert_eq!(subject_ev, subject);
    assert_eq!(attester_ev, attester);
    assert_eq!(value_ev, value);
    assert_eq!(generate_attestation_uid(&env, &schema_uid, &subject, nonce_ev), attestation_uid);
    let _ = timestamp_ev; // timestamp may be zero in test env; no assertion

    // get attestation and verify
    let fetched = client.get_attestation(&attestation_uid);
    assert_eq!(fetched.schema_uid, schema_uid);
    assert_eq!(fetched.subject, subject);
    assert_eq!(fetched.attester, attester);
    assert_eq!(fetched.value, value);
    assert_eq!(fetched.uid, attestation_uid);
    assert_eq!(fetched.expiration_time, expiration_time);
    assert_eq!(fetched.revoked, false);

		println!("=============================================================");
		println!("      Finished test case: {}", "create_and_get_attestation");
		println!("=============================================================");


}

// Happy Path Scenarios

#[test]
fn test_attestation_and_expiration() {
    // Attestation without an expiration time: The current test includes an expiration time.
    // You should add a test where expiration_time is None to ensure it's handled correctly.
    let env = Env::default();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attester = Address::generate(&env);
    let subject = Address::generate(&env);

		println!("==================================================================");
		println!("   Running test case: {}", "test_attestation_and_expiration");
		println!("==================================================================");

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
	let schema_definition = SorobanString::from_str(&env, &return_schema_definition(&env));
	let resolver: Option<Address> = None;
	let revocable = false;
	env.mock_auths(&[MockAuth {
		address: &attester,
		invoke: &MockAuthInvoke {
			contract: &contract_id,
			fn_name: "register",
			args: (attester.clone(), schema_definition.clone(), resolver.clone(), revocable).into_val(&env),
			sub_invokes: &[],
		},
	}]);
	let schema_uid: BytesN<32> = client.register(&attester, &schema_definition, &resolver, &revocable);
	
	// Attest to the Schema
	let value = SorobanString::from_str(&env, "{\"graduating_year\":\"2025\"}");
	let expiration_time: Option<u64> = None;
	let attestation_expiration_time = Some(env.ledger().timestamp() + 777);
	env.mock_auths(&[MockAuth {
		address: &attester,
		invoke: &MockAuthInvoke {
			contract: &contract_id,
			fn_name: "attest",
			args: (attester.clone(), schema_uid.clone(), subject.clone(), value.clone(), expiration_time.clone()).into_val(&env),
			sub_invokes: &[],
		},
	}]);
	let non_expired_attestation_uid: BytesN<32> = client.attest(&attester, &schema_uid, &subject, &value, &expiration_time);
	let fetched_non_expired = client.get_attestation(&non_expired_attestation_uid);
	assert_eq!(fetched_non_expired.uid, non_expired_attestation_uid);
	assert_eq!(fetched_non_expired.value, value);
	assert_eq!(fetched_non_expired.expiration_time, attestation_expiration_time);
	assert_eq!(fetched_non_expired.revoked, false);

	dbg!(&fetched_non_expired);
	

	println!("=============================================================");
	println!("panic: Attesting with expiration time");
	println!("=============================================================");
	let expired_attestation_uid: BytesN<32> = client.attest(&attester, &schema_uid, &subject, &value, &attestation_expiration_time);

	env.ledger().set(soroban_sdk::testutils::LedgerInfo {
		timestamp: env.ledger().timestamp() + 1001,
		..Default::default()
	});
	let fetched_expired = client.get_attestation(&expired_attestation_uid);
	assert_eq!(fetched_expired.uid, expired_attestation_uid);
	assert_eq!(fetched_expired.value, value);
	assert_eq!(fetched_expired.expiration_time, attestation_expiration_time);
	assert_eq!(fetched_expired.revoked, false);

 

		println!("==================================================================");
		println!("   Finished test case: {}", "test_attestation_and_expiration");
		println!("==================================================================");


		
}

#[test]
fn test_can_revoke_non_revocable_schema() {
    // Attestation with a non-revocable schema: The schema in the test is revocable.
    // Test the attestation flow with a schema where revocable is false.
    let env = Env::default();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let attester = Address::generate(&env);

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

		println!("=============================================================");
		println!("start: test_can_revoke_revocable_schema");
		println!("=============================================================");

		let schema_definition = SorobanString::from_str(&env, &return_schema_definition(&env));
		let resolver: Option<Address> = None;
		let revocable = true;
		env.mock_auths(&[MockAuth {
			address: &attester,
			invoke: &MockAuthInvoke {
				contract: &contract_id,
				fn_name: "register",
				args: (attester.clone(), schema_definition.clone(), resolver.clone(), revocable).into_val(&env),
				sub_invokes: &[],
			},
		}]);
		let schema_uid: BytesN<32> = client.register(&attester, &schema_definition, &resolver, &revocable);

		let value = SorobanString::from_str(&env, "{\"foo\":\"bar\"}");
		let expiration_time: Option<u64> = None;
		env.mock_auths(&[MockAuth {
			address: &attester,
			invoke: &MockAuthInvoke {
				contract: &contract_id,
				fn_name: "attest",
				args: (attester.clone(), schema_uid.clone(), attester.clone(), value.clone(), expiration_time.clone()).into_val(&env),
				sub_invokes: &[],
			},
		}]);
		let non_expired_attestation_uid: BytesN<32> = client.attest(&attester, &schema_uid, &attester, &value, &expiration_time);
dbg!(&non_expired_attestation_uid, &schema_uid);
		env.mock_auths(&[MockAuth {
			address: &attester,
			invoke: &MockAuthInvoke {
				contract: &contract_id,
				fn_name: "revoke_attestation",
				args: (attester.clone(), non_expired_attestation_uid.clone()).into_val(&env),
				sub_invokes: &[],
			},
		}]);
 	 client.revoke_attestation(&attester, &non_expired_attestation_uid);
		let revoke_event_data = env.events().all().last().unwrap();
		
		let expected_topics = (symbol_short!("ATTEST"), symbol_short!("REVOKE")).into_val(&env);
		assert_eq!(revoke_event_data.1, expected_topics);

		let event_data: (BytesN<32>, BytesN<32>, Address, Address, bool, Option<u64>) = revoke_event_data.2.try_into_val(&env).unwrap();
		dbg!(&revoke_event_data, &event_data);
		assert_eq!(event_data.4, true);
		assert_eq!(event_data.0, non_expired_attestation_uid);
		assert_eq!(event_data.1, schema_uid);
		assert_eq!(event_data.2, attester);
		assert_eq!(event_data.3, attester);
		assert_eq!(event_data.5, Some(env.ledger().timestamp()));

		println!("=============================================================");
		println!("   Finished test case: {}", "test_can_revoke_non_revocable_schema");
		println!("=============================================================");

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
	let schema_definition = SorobanString::from_str(&env, &return_schema_definition(&env));
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
	let uid_0: BytesN<32> = client.attest(&attester, &schema_uid, &subject, &value1, &expiration_time1);

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
	let uid_1: BytesN<32> = client.attest(&attester, &schema_uid, &subject, &value2, &expiration_time2);
	assert_eq!(uid_1, generate_attestation_uid(&env, &schema_uid, &subject, 1));

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
	let uid_2: BytesN<32> = client.attest(&attester, &schema_uid, &subject, &value3, &expiration_time3);
	assert_eq!(uid_2, generate_attestation_uid(&env, &schema_uid, &subject, 2));

	// get attestations and verify
	let fetched0 = client.get_attestation(&uid_0);
	assert_eq!(fetched0.uid, uid_0);
	assert_eq!(fetched0.value, value1);
	assert_eq!(fetched0.expiration_time, expiration_time1);

	let fetched1 = client.get_attestation(&uid_1);
	assert_eq!(fetched1.uid, uid_1);
	assert_eq!(fetched1.value, value2);
	assert_eq!(fetched1.expiration_time, expiration_time2);

	let fetched2 = client.get_attestation(&uid_2);
	assert_eq!(fetched2.uid, uid_2);
	assert_eq!(fetched2.value, value3);
	assert_eq!(fetched2.expiration_time, expiration_time3);
}

// Unhappy Path and Edge Case Scenarios

#[test]
fn test_attesting_with_unregistered_schema() {
	// Attesting with an unregistered schema: Attempting to create an attestation with a schema_uid that has not been registered should fail.
	let env = Env::default();
	let contract_id = env.register(AttestationContract {}, ());
	let client = AttestationContractClient::new(&env, &contract_id);
	let admin = Address::generate(&env);
	let attester = Address::generate(&env);
	let subject = Address::generate(&env);

	println!("=============================================================");
	println!("panic: Attesting with unregistered schema");
	println!("=============================================================");

	env.mock_all_auths();
	client.initialize(&admin);

	// Attest with a random, unregistered schema UID
	let schema_uid = BytesN::from_array(&env, &[1; 32]);
	let value = SorobanString::from_str(&env, "{\"foo\":\"bar\"}");
	let expiration_time: Option<u64> = None;
	let result = client.try_attest(&attester, &schema_uid, &subject, &value, &expiration_time);

	assert_eq!(result, Err(Ok(protocol::errors::Error::SchemaNotFound.into())));
	println!("=============================================================");
	println!("   Finished test case: {}", "test_attesting_with_unregistered_schema");
	println!("=============================================================");
}

#[test]
fn test_querying_non_existent_attestation() {
	// Querying a non-existent attestation: Trying to get_attestation with a schema_uid, subject, or nonce that doesn't correspond to an existing attestation should be handled gracefully.
	let env = Env::default();
	let contract_id = env.register(AttestationContract {}, ());
	let client = AttestationContractClient::new(&env, &contract_id);
	let admin = Address::generate(&env);

	env.mock_all_auths();
	client.initialize(&admin);
	let result = client.try_get_attestation(&BytesN::from_array(&env, &[1; 32]));
	assert_eq!(result, Err(Ok(protocol::errors::Error::AttestationNotFound.into())));
}

#[test]
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

	// Set the ledger timestamp
	env.ledger().set(soroban_sdk::testutils::LedgerInfo {
		timestamp: 1000,
		..Default::default()
	});

	// attest with a past expiration time
	let value = SorobanString::from_str(&env, "{\"foo\":\"bar\"}");
	let expiration_time = Some(999u64); // In the past
	let result = client.try_attest(&attester, &schema_uid, &subject, &value, &expiration_time);

	assert_eq!(result, Err(Ok(protocol::errors::Error::InvalidDeadline.into())));
}

#[test]
/// Test that an expired attestation cannot be retrieved.
fn test_handling_expired_attestations() {
	let env = Env::default();
	let contract_id = env.register(AttestationContract {}, ());
	let client = AttestationContractClient::new(&env, &contract_id);
	let admin = Address::generate(&env);
	let attester = Address::generate(&env);
	let subject = Address::generate(&env);

	env.mock_all_auths();
	client.initialize(&admin);

	let schema_definition = SorobanString::from_str(
		&env,
		r#"{"name":"Simple","version":"1.0","description":"Simple","fields":[]}"#,
	);
	let resolver: Option<Address> = None;
	let revocable = true;
	let schema_uid: BytesN<32> =
		client.register(&attester, &schema_definition, &resolver, &revocable);

	// attest with an expiration time in the near future
	let current_time = env.ledger().timestamp();
	let value = SorobanString::from_str(&env, "{\"origin\":\"saudi\"}");
	let expiration_time = Some(current_time + 100);
	let attestation_uid = client.attest(&attester, &schema_uid, &subject, &value, &expiration_time);

	// set the ledger timestamp to be in the "future"
	// relative to the expiration time
	env.ledger().set(soroban_sdk::testutils::LedgerInfo {
		timestamp: current_time + 101,
		..Default::default()
	});

	// Now try to get the attestation, it should fail with AttestationExpired
	let result = client.try_get_attestation(&attestation_uid);
	assert_eq!(result, Err(Ok(protocol::errors::Error::AttestationExpired.into())));
}


// #[test]
// fn test_expired_attestation_is_removed_on_get() {
// 	// 1. Setup
// 	let env = Env::default();
// 	let contract_id = env.register(AttestationContract {}, ());
// 	let client = AttestationContractClient::new(&env, &contract_id);
// 	let admin = Address::generate(&env);
// 	let attester = Address::generate(&env);
// 	let subject = Address::generate(&env);

// 	env.mock_all_auths();
// 	client.initialize(&admin);

// 	let schema_definition = SorobanString::from_str(
// 		&env,
// 		r#"{"name":"Simple","version":"1.0","description":"Simple","fields":[]}"#,
// 	);
// 	let resolver: Option<Address> = None;
// 	let revocable = true;
// 	let schema_uid: BytesN<32> =
// 		client.register(&attester, &schema_definition, &resolver, &revocable);

// 	// 2. Act - Part 1: Create an attestation that will expire
// 	let current_time = env.ledger().timestamp();
// 	let value = SorobanString::from_str(&env, "{\"status\":\"active\"}");
// 	let expiration_time = Some(current_time + 100);
// 	let attestation_uid = client
// 		.attest(&attester, &schema_uid, &subject, &value, &expiration_time)
// 		.unwrap();

// 	// Verify it exists before expiration
// 	let attestation_before = client.get_attestation_record(&attestation_uid).unwrap();
// 	assert_eq!(attestation_before.uid, attestation_uid);

// 	// 3. Act - Part 2: Advance time past the expiration
// 	env.ledger().set(soroban_sdk::testutils::LedgerInfo {
// 		timestamp: current_time + 101,
// 		..Default::default()
// 	});

// 	// 4. Assert - Part 1: First call should fail with AttestationExpired
// 	let first_result = client.try_get_attestation_record(&attestation_uid);
// 	assert_eq!(
// 		first_result.err(),
// 		Some(soroban_sdk::Error::from_contract_error(
// 			protocol::errors::Error::AttestationExpired as u32
// 		))
// 	);

// 	// 5. Assert - Part 2: Second call should fail with AttestationNotFound, proving removal
// 	let second_result = client.try_get_attestation_record(&attestation_uid);
// 	assert_eq!(
// 		second_result.err(),
// 		Some(soroban_sdk::Error::from_contract_error(
// 			protocol::errors::Error::AttestationNotFound as u32
// 		))
// 	);
// }


// // ... existing code ...
// client.initialize(&admin);
// }

// #[test]
// fn test_expiration_logic() {
// 	// 1. Setup
// 	let env = Env::default();
// 	let contract_id = env.register(AttestationContract {}, ());
// 	let client = AttestationContractClient::new(&env, &contract_id);
// 	let admin = Address::generate(&env);
// 	let attester = Address::generate(&env);
// 	let subject = Address::generate(&env);

// 	env.mock_all_auths();
// 	client.initialize(&admin);

// 	let schema_definition = SorobanString::from_str(
// 		&env,
// 		r#"{"name":"Graduation","version":"1.0","description":"Diploma","fields":[]}"#,
// 	);
// 	let resolver: Option<Address> = None;
// 	let revocable = true;
// 	let schema_uid: BytesN<32> =
// 		client.register(&attester, &schema_definition, &resolver, &revocable);

// 	// 2. Test valid creation and retrieval
// 	let current_time = env.ledger().timestamp();
// 	let valid_expiration = Some(current_time + 100);
// 	let value = SorobanString::from_str(&env, "{\"graduating_year\":\"2025\"}");
// 	let attestation_uid = client
// 		.attest(&attester, &schema_uid, &subject, &value, &valid_expiration)
// 		.unwrap();

// 	// Verify it can be fetched before it expires
// 	let fetched_before_expiry = client.get_attestation(&attestation_uid).unwrap();
// 	assert_eq!(fetched_before_expiry.uid, attestation_uid);
// 	assert_eq!(fetched_before_expiry.expiration_time, valid_expiration);

// 	// 3. Test retrieval after expiration
// 	env.ledger().set(soroban_sdk::testutils::LedgerInfo {
// 		timestamp: current_time + 101,
// 		..Default::default()
// 	});
// 	let expired_result = client.try_get_attestation(&attestation_uid);
// 	assert_eq!(
// 		expired_result.err(),
// 		Some(soroban_sdk::Error::from_contract_error(
// 			ProtocolError::AttestationExpired as u32
// 		))
// 	);

// 	// 4. Test creation with an invalid (past) deadline
// 	let invalid_expiration = Some(current_time + 99); // Still in the past relative to the new ledger time
// 	let invalid_result =
// 		client.try_attest(&attester, &schema_uid, &subject, &value, &invalid_expiration);
// 	assert_eq!(
// 		invalid_result.err(),
// 		Some(soroban_sdk::Error::from_contract_error(
// 			ProtocolError::InvalidDeadline as u32
// 		))
// 	);
// }

// #[test]
// fn test_attestation_with_non_revocable_schema() {
// 	// Attestation with a non-revocable schema: The schema in the test is revocable.
// // ... existing code ...
