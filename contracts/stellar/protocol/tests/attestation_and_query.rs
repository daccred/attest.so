use protocol::{AttestationContract, AttestationContractClient};
use soroban_sdk::{testutils::{Address as _, MockAuth, MockAuthInvoke, Events}, Address, Env, String as SorobanString, symbol_short, IntoVal, BytesN, TryIntoVal};

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
	env.mock_auths(&[MockAuth { address: &admin, invoke: &MockAuthInvoke { contract: &contract_id, fn_name: "initialize", args: (admin_clone_for_init_args,).into_val(&env), sub_invokes: &[] } }]);
	client.initialize(&admin);

	// register schema
	let schema_definition = SorobanString::from_str(&env, r#"{"name":"Simple","version":"1.0","description":"Simple","fields":[]}"#);
	let resolver: Option<Address> = None;
	let revocable = true;
	env.mock_auths(&[MockAuth { address: &attester, invoke: &MockAuthInvoke { contract: &contract_id, fn_name: "register", args: (attester.clone(), schema_definition.clone(), resolver.clone(), revocable).into_val(&env), sub_invokes: &[] } }]);
	let schema_uid: BytesN<32> = client.register(&attester, &schema_definition, &resolver, &revocable);

	// attest
	let value = SorobanString::from_str(&env, "{\"foo\":\"bar\"}");
	let expiration_time = Some(123456789u64);
	env.mock_auths(&[MockAuth { address: &attester, invoke: &MockAuthInvoke { contract: &contract_id, fn_name: "attest", args: (attester.clone(), schema_uid.clone(), subject.clone(), value.clone(), expiration_time.clone()).into_val(&env), sub_invokes: &[] } }]);
	let nonce: u64 = client.attest(&attester, &schema_uid, &subject, &value, &expiration_time);

	// verify event shape
	let events = env.events().all();
	let last = events.last().unwrap();
	assert_eq!(last.0, contract_id);
	let expected_topics = (symbol_short!("ATTEST"), symbol_short!("CREATE")).into_val(&env);
	assert_eq!(last.1, expected_topics);
	let (_schema_uid_ev, subject_ev, attester_ev, value_ev, nonce_ev, timestamp_ev): (BytesN<32>, Address, Address, SorobanString, u64, u64) = last.2.try_into_val(&env).unwrap();
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