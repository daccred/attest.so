#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Env;

#[test]
fn test() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AuthorityContract, AuthorityContractArgs::__constructor());
    let client = AuthorityContractClient::new(&env, &contract_id);

    let not_admin: Address = Address::generate(&env);

    client.register_authority();
}
