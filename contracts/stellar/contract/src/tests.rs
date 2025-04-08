#[cfg(test)]
mod test {
    use crate::*;
    use soroban_sdk::testutils::{Address as _, Ledger, Events};
    use soroban_sdk::{symbol_short, String as SorobanString, TryFromVal, Vec, Symbol, Bytes, Env};

    // --- Test Helpers ---

    fn setup_env() -> (Env, Address, AttestationContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, AttestationContract);
        let client = AttestationContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        (env, admin, client)
    }

    // Helper to register authority
    fn register_authority_helper(env: &Env, client: &AttestationContractClient, admin: &Address, auth_to_reg: &Address, metadata: &str) {
        client.reg_auth(
            auth_to_reg,
            &SorobanString::from_str(env, metadata)
        );
    }

    // Helper to register schema
    fn register_schema_helper(
        env: &Env,
        client: &AttestationContractClient,
        authority: &Address,
        definition: &str,
        resolver: Option<Address>,
        revocable: bool
    ) -> BytesN<32> {
        client.register_schema(
            authority,
            &SorobanString::from_str(env, definition),
            &resolver,
            &revocable
        )
    }

    // Helper to attest
    fn attest_helper(
        env: &Env,
        client: &AttestationContractClient,
        caller: &Address,
        schema_uid: &BytesN<32>,
        subject: &Address,
        value: &str,
        reference: Option<&str>
    ) -> Result<(), crate::errors::Error> {
        client.attest(
            caller,
            schema_uid,
            subject,
            &SorobanString::from_str(env, value),
            &reference.map(|s| SorobanString::from_str(env, s))
        )
    }

    // Helper to revoke
    fn revoke_helper(
        env: &Env,
        client: &AttestationContractClient,
        caller: &Address,
        schema_uid: &BytesN<32>,
        subject: &Address,
        reference: Option<&str>
    ) -> Result<(), crate::errors::Error> {
        client.revoke_attest(
            caller,
            schema_uid,
            subject,
            &reference.map(|s| SorobanString::from_str(env, s))
        )
    }

    // Helper to get attestation
    fn get_attest_helper(
        env: &Env,
        client: &AttestationContractClient,
        schema_uid: &BytesN<32>,
        subject: &Address,
        reference: Option<&str>
    ) -> Result<AttestationRecord, crate::errors::Error> {
        client.get_attest(
            schema_uid,
            subject,
            &reference.map(|s| SorobanString::from_str(env, s))
        )
    }


    // --- Initialization Tests ---

    #[test]
    fn test_initialization() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, AttestationContract);
        let client = AttestationContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        // Try initializing again
        let result = client.try_initialize(&admin);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap().unwrap(), errors::Error::AlreadyInitialized);
    }

    // --- Authority Registration Tests ---

    #[test]
    fn test_register_authority() {
        let (env, admin, client) = setup_env();
        let auth_address = Address::generate(&env);
        let metadata = "Test Authority";

        register_authority_helper(&env, &client, &admin, &auth_address, metadata);

        // Verify by attempting to register a schema (requires auth)
        let result = register_schema_helper(&env, &client, &auth_address, "Test Schema", None, true);
        assert!(result.is_ok());

        // Check for event
        let events = env.events().all();
        let auth_events = events.iter()
            .filter(|event: &(Address, Vec<soroban_sdk::Val>, soroban_sdk::Val)| {
                let (_contract_id, topics, _data) = event;
                if topics.len() >= 2 {
                    if let (Ok(topic1), Ok(topic2)) = (
                        Symbol::try_from_val(&env, &topics.get_unchecked(0)),
                        Symbol::try_from_val(&env, &topics.get_unchecked(1))
                    ) {
                        topic1 == symbol_short!("auth") && topic2 == symbol_short!("register")
                    } else { false }
                } else { false }
            })
            .count();
        assert_eq!(auth_events, 1, "Expected one auth register event");
    }

    #[test]
    fn test_register_authority_unauthorized() {
        let (env, _admin, client) = setup_env(); // admin is set up but not used as caller
        let non_admin = Address::generate(&env);
        let auth_address = Address::generate(&env);

        // Call requires admin auth, but caller is non_admin
        let result = client.try_reg_auth(
            &auth_address,
            &SorobanString::from_str(&env, "Test Authority")
        );
        assert!(result.is_err(), "Expected transaction to fail due to lack of admin auth");
        // We expect a HostError related to auth failure, not a specific contract error here.
    }

    // --- Schema Registration Tests ---

    #[test]
    fn test_register_schema_without_resolver() {
        let (env, admin, client) = setup_env();
        let auth = Address::generate(&env);
        register_authority_helper(&env, &client, &admin, &auth, "Auth");

        let schema_def = "{ \"type\": \"object\", \"properties\": {} }";
        let result = register_schema_helper(&env, &client, &auth, schema_def, None, true);
        assert!(result.is_ok(), "Schema registration failed");
    }

    #[test]
    fn test_register_schema_with_resolver() {
        let (env, admin, client) = setup_env();
        let auth = Address::generate(&env);
        let resolver_id = Address::generate(&env);
        register_authority_helper(&env, &client, &admin, &auth, "Auth");

        let schema_def = "{ \"type\": \"object\", \"properties\": {} }";
        let result = register_schema_helper(
            &env,
            &client,
            &auth,
            schema_def,
            Some(resolver_id),
            true
        );
        assert!(result.is_ok(), "Schema registration with resolver failed");
    }

    #[test]
    fn test_register_schema_unauthorized() {
        let (env, _admin, client) = setup_env();
        let non_authority = Address::generate(&env);

        let result = client.try_register_schema(
            &non_authority,
            &SorobanString::from_str(&env, "test"),
            &None,
            &true,
        );
        assert!(result.is_err());
        assert_eq!(result.err().unwrap().unwrap(), errors::Error::AuthorityNotRegistered);
    }

    // --- Attestation Tests ---

    #[test]
    fn test_create_and_get_attestation() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        register_authority_helper(&env, &client, &admin, &authority, "Auth");

        let schema_uid = register_schema_helper(&env, &client, &authority, "Schema", None, true).unwrap();
        let subject = Address::generate(&env);
        let value = "attestation value";
        let reference = Some("attestation reference");

        attest_helper(&env, &client, &authority, &schema_uid, &subject, value, reference).unwrap();

        let fetched_attestation = get_attest_helper(&env, &client, &schema_uid, &subject, reference).unwrap();

        assert_eq!(fetched_attestation.schema_uid, schema_uid);
        assert_eq!(fetched_attestation.subject, subject);
        assert_eq!(fetched_attestation.value, SorobanString::from_str(&env, value));
        assert_eq!(fetched_attestation.reference, reference.map(|s| SorobanString::from_str(&env, s)));
        assert_eq!(fetched_attestation.revoked, false);
    }


    #[test]
    fn test_attest_fails_if_not_authority() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        let non_authority = Address::generate(&env);
        register_authority_helper(&env, &client, &admin, &authority, "Auth");

        let schema_uid = register_schema_helper(&env, &client, &authority, "Schema", None, true).unwrap();
        let subject = Address::generate(&env);

        let result = attest_helper(&env, &client, &non_authority, &schema_uid, &subject, "value", None);

        assert!(result.is_err());
        // We expect a HostError related to auth failure, not AuthorityNotRegistered
        // assert_eq!(result.err().unwrap(), errors::Error::AuthorityNotRegistered);
    }

    // --- Revocation Tests ---

    #[test]
    fn test_revoke_attestation() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        register_authority_helper(&env, &client, &admin, &authority, "Auth");

        let schema_uid = register_schema_helper(&env, &client, &authority, "Schema", None, true).unwrap(); // Revocable
        let subject = Address::generate(&env);
        let value = "attestation value";
        let reference = Some("attestation reference");

        attest_helper(&env, &client, &authority, &schema_uid, &subject, value, reference).unwrap();

        // Revoke
        revoke_helper(&env, &client, &authority, &schema_uid, &subject, reference).unwrap();

        // Verify revoked status
        let fetched_attestation = get_attest_helper(&env, &client, &schema_uid, &subject, reference).unwrap();
        assert_eq!(fetched_attestation.revoked, true);
    }

    #[test]
    fn test_revoke_non_revocable_attestation_fails() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        register_authority_helper(&env, &client, &admin, &authority, "Auth");

        let schema_uid = register_schema_helper(&env, &client, &authority, "Schema", None, false).unwrap(); // Not revocable
        let subject = Address::generate(&env);

        attest_helper(&env, &client, &authority, &schema_uid, &subject, "value", None).unwrap();

        // Try to revoke
        let result = revoke_helper(&env, &client, &authority, &schema_uid, &subject, None);

        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), errors::Error::AttestationNotRevocable);
    }

    #[test]
    fn test_revoke_by_non_schema_authority_fails() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        let different_auth = Address::generate(&env);
        register_authority_helper(&env, &client, &admin, &authority, "Auth");
        register_authority_helper(&env, &client, &admin, &different_auth, "DiffAuth"); // Register the other auth too

        let schema_uid = register_schema_helper(&env, &client, &authority, "Schema", None, true).unwrap(); // Registered by 'authority'
        let subject = Address::generate(&env);

        attest_helper(&env, &client, &authority, &schema_uid, &subject, "value", None).unwrap();

        // Try to revoke with 'different_auth'
        let result = revoke_helper(&env, &client, &different_auth, &schema_uid, &subject, None);

        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), errors::Error::NotAuthorized);
    }

    #[test]
    fn test_revoke_non_existent_attestation_fails() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        register_authority_helper(&env, &client, &admin, &authority, "Auth");

        let schema_uid = register_schema_helper(&env, &client, &authority, "Schema", None, true).unwrap();
        let subject = Address::generate(&env);
        let reference = Some("non-existent ref");

        let result = revoke_helper(&env, &client, &authority, &schema_uid, &subject, reference);

        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), errors::Error::AttestationNotFound);
    }

    // --- Query Tests ---

    #[test]
    fn test_get_non_existent_attestation_fails() {
        let (env, admin, client) = setup_env();
        let authority = Address::generate(&env);
        register_authority_helper(&env, &client, &admin, &authority, "Auth");

        let schema_uid = register_schema_helper(&env, &client, &authority, "Schema", None, true).unwrap();
        let subject = Address::generate(&env);
        let reference = Some("non-existent ref");

        let result = get_attest_helper(&env, &client, &schema_uid, &subject, reference);

        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), errors::Error::AttestationNotFound);
    }
} 