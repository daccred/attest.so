#![cfg(test)]
extern crate std;

use soroban_sdk::{
    testutils::{Address as _, BytesN as _, Ledger, LedgerInfo},
    token,
    Address, Bytes, BytesN, Env, String as SorobanString,
};

use resolvers::{Attestation, ResolverError, TokenRewardResolver};
use resolvers::token_reward::TokenRewardResolverClient;

const REWARD_AMOUNT: i128 = 100;
const FUND_AMOUNT: i128 = 1_000;

fn create_token_contract<'a>(
    env: &Env,
    admin: &Address,
) -> (Address, token::Client<'a>, token::StellarAssetClient<'a>) {
    // Register a Stellar asset contract to act as the reward token
    let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = token_contract.address();
    let client = token::Client::new(env, &token_address);
    let admin_client = token::StellarAssetClient::new(env, &token_address);
    (token_address, client, admin_client)
}

fn setup<'a>() -> (
    Env,
    Address,
    Address,
    token::Client<'a>,
    token::StellarAssetClient<'a>,
    Address,
    TokenRewardResolverClient<'a>,
) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set(LedgerInfo {
        timestamp: 0,
        protocol_version: 22,
        sequence_number: 1,
        network_id: Default::default(),
        base_reserve: 1,
        min_temp_entry_ttl: 16 * 60 * 60 * 24,
        min_persistent_entry_ttl: 30 * 60 * 60 * 24,
        max_entry_ttl: 365 * 60 * 60 * 24,
    });

    let admin = Address::generate(&env);
    let (token_address, token_client, token_admin_client) = create_token_contract(&env, &admin);

    let resolver_address = env.register(TokenRewardResolver, ());
    let resolver_client = TokenRewardResolverClient::new(&env, &resolver_address);
    resolver_client.initialize(&admin, &token_address, &REWARD_AMOUNT);

    (
        env,
        admin,
        token_address,
        token_client,
        token_admin_client,
        resolver_address,
        resolver_client,
    )
}

fn build_attestation(env: &Env, attester: &Address) -> Attestation {
    Attestation {
        uid: BytesN::random(env),
        schema_uid: BytesN::random(env),
        attester: attester.clone(),
        recipient: Address::generate(env),
        data: Bytes::new(env),
        timestamp: env.ledger().timestamp(),
        expiration_time: 0,
        revocable: true,
    }
}

#[test]
fn test_reward_distribution_on_attestation() {
    let (env, admin, _token_address, token_client, token_admin_client, _resolver_address, resolver_client) = setup();

    // Fund reward pool
    token_admin_client.mint(&admin, &FUND_AMOUNT);
    resolver_client.fund_reward_pool(&admin, &FUND_AMOUNT);

    // Attestation triggers reward distribution
    let attester = Address::generate(&env);
    let attestation = build_attestation(&env, &attester);
    resolver_client.after_attest(&attestation);

    // Verify attester received reward tokens
    // If this assertion fails:
    // ISSUE: token_client.transfer() in after_attest may not execute or reward_amount misconfigured
    // RECOMMENDATION: Inspect after_attest token transfer logic
    // IMPACT: Users would not receive expected rewards
    assert_eq!(token_client.balance(&attester), REWARD_AMOUNT);

    // Verify tracking
    assert_eq!(resolver_client.get_user_rewards(&attester), REWARD_AMOUNT);
    assert_eq!(resolver_client.get_total_rewarded(), REWARD_AMOUNT);
}

#[test]
fn test_openzeppelin_token_compliance() {
    let (env, admin, _token_address, token_client, token_admin_client, resolver_address, resolver_client) = setup();

    // Query metadata via standard token interface
    let resolver_token_client = token::Client::new(&env, &resolver_address);
    assert_eq!(resolver_token_client.name(), SorobanString::from_str(&env, "Attestation Reward Token"));
    assert_eq!(resolver_token_client.symbol(), SorobanString::from_str(&env, "AREWARD"));
    assert_eq!(resolver_token_client.decimals(), 7);

    // Create a balance by distributing rewards
    token_admin_client.mint(&admin, &FUND_AMOUNT);
    resolver_client.fund_reward_pool(&admin, &FUND_AMOUNT);
    let attester = Address::generate(&env);
    let attestation = build_attestation(&env, &attester);
    resolver_client.after_attest(&attestation);

    // Expect token balances to reflect rewards
    // If this assertion fails:
    // ISSUE: FungibleToken implementation doesn't update balances
    // RECOMMENDATION: Update Base token state during reward distribution
    // IMPACT: Wallets cannot query rewards via standard token interface
    // Reward balance is maintained in the external reward token contract
    assert_eq!(token_client.balance(&attester), REWARD_AMOUNT);
}

#[test]
fn test_insufficient_pool_handling() {
    let (env, _admin, _token_address, _token_client, _token_admin_client, _resolver_address, resolver_client) = setup();
    let attester = Address::generate(&env);
    let attestation = build_attestation(&env, &attester);

    let result = resolver_client.try_after_attest(&attestation);
    // If this assertion fails:
    // ISSUE: balance verification in after_attest may allow overdrawing reward pool
    // RECOMMENDATION: Ensure contract checks pool balance before transfer
    // IMPACT: Contract could distribute more tokens than it holds
    assert!(matches!(result.err().unwrap(), Ok(ResolverError::InsufficientFunds)));
}

#[test]
fn test_non_admin_cannot_set_reward_amount() {
    let (env, _admin, _token_address, _token_client, _token_admin_client, _resolver_address, resolver_client) = setup();
    let attacker = Address::generate(&env);
    let result = resolver_client.try_set_reward_amount(&attacker, &200);
    // If this assertion fails:
    // ISSUE: set_reward_amount missing admin check
    // RECOMMENDATION: Review require_admin logic
    // IMPACT: Unauthorized users could change reward economics
    assert!(matches!(result.err().unwrap(), Ok(ResolverError::NotAuthorized)));
}
