use protocol::{AttestationContract, AttestationContractClient};
use soroban_sdk::{testutils::{Address as _, MockAuth, MockAuthInvoke, Events}, Address, Env, String as SorobanString, symbol_short, IntoVal, BytesN, TryIntoVal};

#[test]
fn initialize_and_register_schema() {
	let env = Env::default();
	let contract_id = env.register(AttestationContract {}, ());
	let client = AttestationContractClient::new(&env, &contract_id);
	let admin = Address::generate(&env);
	let authority = Address::generate(&env);

	// initialize
	let admin_clone_for_init_args = admin.clone();
	env.mock_auths(&[MockAuth { address: &admin, invoke: &MockAuthInvoke { contract: &contract_id, fn_name: "initialize", args: (admin_clone_for_init_args,).into_val(&env), sub_invokes: &[] } }]);
	client.initialize(&admin);

	// register schema
	let schema_definition = SorobanString::from_str(&env, r#"{"name":"Degree","version":"1.0","description":"University degree","fields":[{"name":"degree","type":"string"}]}"#);
	let resolver: Option<Address> = None;
	let revocable = true;
	env.mock_auths(&[MockAuth { address: &authority, invoke: &MockAuthInvoke { contract: &contract_id, fn_name: "register", args: (authority.clone(), schema_definition.clone(), resolver.clone(), revocable).into_val(&env), sub_invokes: &[] } }]);
	let schema_uid: BytesN<32> = client.register(&authority, &schema_definition, &resolver, &revocable);

	// verify event shape
	let events = env.events().all();
	let last = events.last().unwrap();
	assert_eq!(last.0, contract_id);
	let expected_topics = (symbol_short!("SCHEMA"), symbol_short!("REGISTER")).into_val(&env);
	assert_eq!(last.1, expected_topics);
	let event_data: (BytesN<32>, Address) = last.2.try_into_val(&env).unwrap();
	assert_eq!(event_data.0, schema_uid);
	assert_eq!(event_data.1, authority);
} 