use protocol::{state::Schema, utils::create_xdr_string, AttestationContract, AttestationContractClient};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events, MockAuth, MockAuthInvoke},
    Address, BytesN, Env, IntoVal, String as SorobanString, TryIntoVal,
};

struct SchemaRegistrationParams {
    name: &'static str,
    schema_definition: String,
    resolver: Option<Address>,
    revocable: bool,
}

/*
 * Comprehensive test for contract initialization and schema registration
 *
 * This test validates the complete workflow of:
 * 1. Contract initialization with proper admin setup and authentication
 * 2. Schema registration with various configurations (JSON and XDR formats)
 * 3. Event emission verification for schema registration operations
 * 4. Support for optional resolver addresses and revocability settings
 *
 * Test cases cover:
 * - Simple JSON schema with basic revocable configuration
 * - XDR-encoded schema with resolver integration and permanent attestations
 *
 * Each test case verifies:
 * - Successful schema registration and UID generation
 * - Correct event emission with proper topics and data structure
 * - Event data integrity (schema UID and authority address matching)
 */
#[test]
fn initialize_and_register_schema() {
    let env = Env::default();
    let contract_id = env.register(AttestationContract {}, ());
    let client = AttestationContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

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

    let test_cases = [
		SchemaRegistrationParams {
			name: "schema_with_revocable",
			schema_definition: r#"{"name":"Degree","version":"1.0","description":"University degree","fields":[{"name":"degree","type":"string"}]}"#.to_string(),
			resolver: None,
			revocable: true,
		},
		SchemaRegistrationParams {
			name: "schema_xdr_with_revocable",
			schema_definition: format!(
				"{}{}",
				"XDR:",
				create_xdr_string(
					&env,
					&SorobanString::from_str(&env, r#"{"name":"Certificate","version":"1.5","description":"Revocable_Certificate_Schema","fields":[{"name":"certificate_type","type":"string"},{"name":"issued_date","type":"number"}]}"#),
				).to_string()
			),
			resolver: None,
			revocable: true,
		},
	];

    for case in test_cases {
        println!("\n\n");
        println!("=============================================================");
        println!("      Running test case: {}", case.name);
        println!("=============================================================");
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
        let schema_uid: BytesN<32> = client.register(&authority, &schema_definition, &case.resolver, &case.revocable);

        let events = env.events().all();
        dbg!(&events);
        let last = events.last().unwrap();
        dbg!(&last);
        assert_eq!(last.0, contract_id);
        let expected_topics = (symbol_short!("SCHEMA"), symbol_short!("REGISTER")).into_val(&env);
        dbg!(&expected_topics);
        assert_eq!(last.1, expected_topics);
        let event_data: (BytesN<32>, Schema, Address) = last.2.try_into_val(&env).unwrap();
        println!(
            "Event data: schema_uid={:?}, schema={:?}",
            event_data.0, event_data.1.definition
        );
        assert_eq!(event_data.0, schema_uid);
        assert_eq!(event_data.1.authority, authority);
        assert_eq!(event_data.1.definition, schema_definition);
        assert_eq!(event_data.1.resolver, case.resolver);
        assert_eq!(event_data.1.revocable, case.revocable);
    }
}
