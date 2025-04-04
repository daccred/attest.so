#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    vec, Env, IntoVal, String,
};

#[test]
fn test() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SchemaContract, ());
    let client = SchemaContractClient::new(&env, &contract_id);

    let caller = Address::generate(&env);
    let resolver = Address::generate(&env);

    let schema = String::from_str(&env, "blah blah blah");
    let revocable = false;

    client.register(&caller, &schema, &Some(resolver), &revocable);
}
