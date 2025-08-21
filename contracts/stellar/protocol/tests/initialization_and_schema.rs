use protocol::{utils::create_xdr_string, AttestationContract, AttestationContractClient};
use soroban_sdk::{symbol_short, testutils::{Address as _, Events, MockAuth, MockAuthInvoke}, Address, BytesN, Env, IntoVal, String as SorobanString, TryIntoVal};

#[test]
fn initialize_and_register_schema() {
	let env = Env::default();
	let contract_id = env.register(AttestationContract {}, ());
	let client = AttestationContractClient::new(&env, &contract_id);
	let admin = Address::generate(&env);

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

	struct TestCase {
		name: &'static str,
		schema_definition: String,
		resolver: Option<Address>,
		revocable: bool,
	}

	let test_cases = [
		TestCase {
			name: "simple_schema",
			schema_definition: r#"{"name":"Degree","version":"1.0","description":"University degree","fields":[{"name":"degree","type":"string"}]}"#.to_string(),
			resolver: None,
			revocable: true,
		},
		TestCase {
			name: "schema_with_resolver_and_not_revocable",
			schema_definition: format!(
				"{}{}",
				"XDR:",
				create_xdr_string(
					&env,
					&SorobanString::from_str(&env, r#"{"name":"Identity","version":"2.0","description":"Basic_Identity_Schema","fields":[{"name":"name","type":"string"}]}"#),
				).to_string()
			),
			resolver: Some(Address::generate(&env)),
			revocable: false,
		},
	];

	for case in test_cases {
		println!("Running test case: {}", case.name);
		let authority = Address::generate(&env);
		// register schema
		let schema_definition = SorobanString::from_str(&env, &case.schema_definition);
		env.mock_auths(&[MockAuth {
			address: &authority,
			invoke: &MockAuthInvoke {
				contract: &contract_id,
				fn_name: "register",
				args: (
					authority.clone(),
					schema_definition.clone(),
					case.resolver.clone(),
					case.revocable,
				)
					.into_val(&env),
				sub_invokes: &[],
			},
		}]);
		let schema_uid: BytesN<32> =
			client.register(&authority, &schema_definition, &case.resolver, &case.revocable);

		// verify event shape
		let events = env.events().all();
		dbg!(&events);
		let last = events.last().unwrap();
		dbg!(&last);
		assert_eq!(last.0, contract_id);
		let expected_topics = (symbol_short!("SCHEMA"), symbol_short!("REGISTER")).into_val(&env);
		dbg!(&expected_topics);
		assert_eq!(last.1, expected_topics);
		let event_data: (BytesN<32>, Address) = last.2.try_into_val(&env).unwrap();
		dbg!(&event_data);
		dbg!(&schema_uid);
		dbg!(&authority);
		assert_eq!(event_data.0, schema_uid);
		assert_eq!(event_data.1, authority);
	}
} 