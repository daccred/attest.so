// use protocol::{
//     errors::Error,
//     state::{Attestation, DataKey},
//     utils::{create_xdr_string, generate_attestation_uid},
//     AttestationContract, AttestationContractClient,
// };
// use soroban_sdk::{
//     panic_with_error, symbol_short,
//     testutils::{Address as _, Events, Ledger, LedgerInfo, MockAuth, MockAuthInvoke},
//     Address, BytesN, Env, IntoVal, String as SorobanString, TryIntoVal,
// };

/// **Test: Resolver Rejection of Revocation**
/// - Create schema with resolver that denies revocation
/// - Attempt revocation should fail with Error::ResolverError

/// **Test: Resolver Call Failure**
/// - Create schema with invalid resolver address
/// - Attempt revocation should fail with Error::ResolverCallFailed

/// **Test: Schema Without Resolver**
/// - Create schema without resolver (resolver = None)
/// - Revocation should succeed (no resolver checks)
///
#[test]
fn test_resolver_rejection_of_revocation() {
    let env = soroban_sdk::Env::default();
    let contract_id = env.register(protocol::AttestationContract {}, ());
    let client = protocol::AttestationContractClient::new(&env, &contract_id);
    let admin = <soroban_sdk::Address as soroban_sdk::testutils::Address>::generate(&env);
    let attester = <soroban_sdk::Address as soroban_sdk::testutils::Address>::generate(&env);
    let subject = <soroban_sdk::Address as soroban_sdk::testutils::Address>::generate(&env);
}
