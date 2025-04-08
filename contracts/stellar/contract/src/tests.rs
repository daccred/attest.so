use soroban_sdk::{testutils::{Address as _}, Address, Env, String as SorobanString, BytesN};
use crate::{AttestationContract, errors, state::{Authority, Schema, AttestationRecord}};

pub struct TestEnv {
    pub env: Env,
    pub contract_id: Address,
    pub admin: Address,
    pub university: Address,
    pub company: Address,
    pub student_alice: Address,
    pub student_bob: Address,
    pub employee_charlie: Address,
    pub employee_dave: Address,
}

impl TestEnv {
    pub fn setup() -> Self {
        let env = Env::default();
        let contract_id = env.register_contract(None, AttestationContract);
        
        let admin = Address::generate(&env);
        let university = Address::generate(&env);
        let company = Address::generate(&env);
        let student_alice = Address::generate(&env);
        let student_bob = Address::generate(&env);
        let employee_charlie = Address::generate(&env);
        let employee_dave = Address::generate(&env);

        TestEnv {
            env,
            contract_id,
            admin,
            university,
            company,
            student_alice,
            student_bob,
            employee_charlie,
            employee_dave,
        }
    }

    pub fn register_authority_helper(&self, admin: &Address, auth_to_reg: &Address, metadata: &str) -> Result<(), errors::Error> {
        self.env.as_contract(&self.contract_id, || {
            AttestationContract::reg_auth(
                self.env.clone(),
                admin.clone(),
                auth_to_reg.clone(),
                SorobanString::from_str(&self.env, metadata)
            )
        })
    }

    pub fn register_schema_helper(
        &self,
        authority: &Address,
        schema_definition: &str,
        resolver: Option<&Address>,
        revocable: bool,
    ) -> Result<BytesN<32>, errors::Error> {
        self.env.as_contract(&self.contract_id, || {
            AttestationContract::register(
                self.env.clone(),
                authority.clone(),
                SorobanString::from_str(&self.env, schema_definition),
                resolver.map(|r| r.clone()),
                revocable,
            )
        })
    }

    pub fn attest_helper(
        &self,
        caller: &Address,
        schema_uid: &BytesN<32>,
        subject: &Address,
        value: &str,
        reference: Option<&str>,
    ) -> Result<(), errors::Error> {
        self.env.as_contract(&self.contract_id, || {
            AttestationContract::attest(
                self.env.clone(),
                caller.clone(),
                schema_uid.clone(),
                subject.clone(),
                SorobanString::from_str(&self.env, value),
                reference.map(|s| SorobanString::from_str(&self.env, s))
            )
        })
    }

    pub fn revoke_attestation_helper(
        &self,
        caller: &Address,
        schema_uid: &BytesN<32>,
        subject: &Address,
        reference: Option<&str>,
    ) -> Result<(), errors::Error> {
        self.env.as_contract(&self.contract_id, || {
            AttestationContract::revoke_attestation(
                self.env.clone(),
                caller.clone(),
                schema_uid.clone(),
                subject.clone(),
                reference.map(|s| SorobanString::from_str(&self.env, s))
            )
        })
    }

    pub fn get_attestation_helper(
        &self,
        schema_uid: &BytesN<32>,
        subject: &Address,
        reference: Option<&str>,
    ) -> Result<AttestationRecord, errors::Error> {
        self.env.as_contract(&self.contract_id, || {
            AttestationContract::get_attestation(
                self.env.clone(),
                schema_uid.clone(),
                subject.clone(),
                reference.map(|s| SorobanString::from_str(&self.env, s))
            )
        })
    }

    pub fn get_authority_helper(&self, address: &Address) -> Option<Authority> {
        self.env.as_contract(&self.contract_id, || {
            crate::utils::get_authority(&self.env, address)
        })
    }

    pub fn get_schema_helper(&self, schema_uid: &BytesN<32>) -> Option<Schema> {
        self.env.as_contract(&self.contract_id, || {
            crate::utils::get_schema(&self.env, schema_uid)
        })
    }

    pub fn get_admin_helper(&self) -> Option<Address> {
        self.env.as_contract(&self.contract_id, || {
            crate::utils::get_admin(&self.env)
        })
    }
}

#[test]
fn test_initialization() {
    let test_env = TestEnv::setup();
    let admin = &test_env.admin;

    // Test successful initialization
    test_env.env.as_contract(&test_env.contract_id, || {
        AttestationContract::initialize(test_env.env.clone(), admin.clone()).unwrap();
    });
    assert_eq!(test_env.get_admin_helper().unwrap(), *admin);

    // Test re-initialization fails
    let reinit_result = test_env.env.as_contract(&test_env.contract_id, || {
        AttestationContract::initialize(test_env.env.clone(), admin.clone())
    });
    assert!(matches!(reinit_result.err().unwrap(), errors::Error::AlreadyInitialized));
}

#[test]
fn test_authority_registration() {
    let test_env = TestEnv::setup();
    let admin = &test_env.admin;
    let university = &test_env.university;

    // Initialize contract
    test_env.env.as_contract(&test_env.contract_id, || {
        AttestationContract::initialize(test_env.env.clone(), admin.clone()).unwrap();
    });

    // Test successful authority registration
    test_env.register_authority_helper(admin, university, "University Authority").unwrap();

    // Verify authority was registered
    let authority = test_env.get_authority_helper(university);
    assert!(authority.is_some());
    let authority = authority.as_ref().unwrap();
    assert_eq!(authority.address, *university);
    assert_eq!(authority.metadata, SorobanString::from_str(&test_env.env, "University Authority"));

    // Test registering same authority again (should overwrite)
    test_env.register_authority_helper(admin, university, "Updated University Authority").unwrap();
    let updated_authority = test_env.get_authority_helper(university);
    assert_eq!(updated_authority.unwrap().metadata, SorobanString::from_str(&test_env.env, "Updated University Authority"));

    // Test unauthorized registration attempt
    let unauthorized = Address::generate(&test_env.env);
    let result = test_env.register_authority_helper(&unauthorized, &Address::generate(&test_env.env), "Unauthorized");
    assert!(matches!(result.err().unwrap(), errors::Error::NotAuthorized));
}

#[test]
fn test_schema_registration() {
    let test_env = TestEnv::setup();
    let admin = &test_env.admin;
    let university = &test_env.university;

    // Initialize and register authority
    test_env.env.as_contract(&test_env.contract_id, || {
        AttestationContract::initialize(test_env.env.clone(), admin.clone()).unwrap();
    });
    test_env.register_authority_helper(admin, university, "University Authority").unwrap();

    // Test successful schema registration
    let schema_definition = r#"{
        "name": "Degree",
        "version": "1.0",
        "description": "University degree attestation",
        "fields": [
            {"name": "degree", "type": "string"},
            {"name": "field", "type": "string"},
            {"name": "graduation_date", "type": "string"}
        ]
    }"#;

    let schema_uid = test_env.register_schema_helper(
        university,
        schema_definition,
        None,
        true
    ).unwrap();

    // Verify schema was registered
    let schema = test_env.get_schema_helper(&schema_uid);
    assert!(schema.is_some());
    let schema = schema.as_ref().unwrap();
    assert_eq!(schema.authority, *university);
    assert_eq!(schema.definition, SorobanString::from_str(&test_env.env, schema_definition));
    assert!(schema.revocable);

    // Test registering schema with resolver
    let resolver = Address::generate(&test_env.env);
    let schema_uid_with_resolver = test_env.register_schema_helper(
        university,
        schema_definition,
        Some(&resolver),
        true
    ).unwrap();

    let schema_with_resolver = test_env.get_schema_helper(&schema_uid_with_resolver);
    assert_eq!(schema_with_resolver.unwrap().resolver, Some(resolver));

    // Test unauthorized schema registration
    let unauthorized = Address::generate(&test_env.env);
    let result = test_env.register_schema_helper(
        &unauthorized,
        schema_definition,
        None,
        true
    );
    assert!(matches!(result.err().unwrap(), errors::Error::AuthorityNotRegistered));
}

#[test]
fn test_attestation() {
    let test_env = TestEnv::setup();
    let admin = &test_env.admin;
    let university = &test_env.university;
    let student_alice = &test_env.student_alice;

    // Initialize and register authority
    test_env.env.as_contract(&test_env.contract_id, || {
        AttestationContract::initialize(test_env.env.clone(), admin.clone()).unwrap();
    });
    test_env.register_authority_helper(admin, university, "University Authority").unwrap();

    // Register schema
    let schema_definition = r#"{
        "name": "Degree",
        "version": "1.0",
        "description": "University degree attestation",
        "fields": [
            {"name": "degree", "type": "string"},
            {"name": "field", "type": "string"},
            {"name": "graduation_date", "type": "string"}
        ]
    }"#;

    let schema_uid = test_env.register_schema_helper(
        university,
        schema_definition,
        None,
        true
    ).unwrap();

    // Test successful attestation
    let attestation_value = r#"{
        "degree": "Bachelor of Science",
        "field": "Computer Science",
        "graduation_date": "2023-05-15"
    }"#;

    test_env.attest_helper(
        university,
        &schema_uid,
        student_alice,
        attestation_value,
        None
    ).unwrap();

    // Verify attestation
    let attestation = test_env.get_attestation_helper(&schema_uid, student_alice, None).unwrap();
    assert_eq!(attestation.schema_uid, schema_uid);
    assert_eq!(attestation.subject, *student_alice);
    assert_eq!(attestation.value, SorobanString::from_str(&test_env.env, attestation_value));
    assert!(!attestation.revoked);

    // Test attestation with reference
    let reference = "REF123";
    test_env.attest_helper(
        university,
        &schema_uid,
        student_alice,
        attestation_value,
        Some(reference)
    ).unwrap();

    let attestation_with_ref = test_env.get_attestation_helper(&schema_uid, student_alice, Some(reference)).unwrap();
    assert_eq!(attestation_with_ref.reference, Some(SorobanString::from_str(&test_env.env, reference)));

    // Test unauthorized attestation
    let unauthorized = Address::generate(&test_env.env);
    let result = test_env.attest_helper(
        &unauthorized,
        &schema_uid,
        student_alice,
        attestation_value,
        None
    );
    assert!(matches!(result.err().unwrap(), errors::Error::NotAuthorized));
}

#[test]
fn test_revocation() {
    let test_env = TestEnv::setup();
    let admin = &test_env.admin;
    let university = &test_env.university;
    let student_alice = &test_env.student_alice;

    // Initialize and register authority
    test_env.env.as_contract(&test_env.contract_id, || {
        AttestationContract::initialize(test_env.env.clone(), admin.clone()).unwrap();
    });
    test_env.register_authority_helper(admin, university, "University Authority").unwrap();

    // Register schema
    let schema_definition = r#"{
        "name": "Degree",
        "version": "1.0",
        "description": "University degree attestation",
        "fields": [
            {"name": "degree", "type": "string"},
            {"name": "field", "type": "string"},
            {"name": "graduation_date", "type": "string"}
        ]
    }"#;

    let schema_uid = test_env.register_schema_helper(
        university,
        schema_definition,
        None,
        true
    ).unwrap();

    // Create attestation
    let attestation_value = r#"{
        "degree": "Bachelor of Science",
        "field": "Computer Science",
        "graduation_date": "2023-05-15"
    }"#;

    test_env.attest_helper(
        university,
        &schema_uid,
        student_alice,
        attestation_value,
        None
    ).unwrap();

    // Test successful revocation
    test_env.revoke_attestation_helper(
        university,
        &schema_uid,
        student_alice,
        None
    ).unwrap();

    // Verify attestation is revoked
    let attestation = test_env.get_attestation_helper(&schema_uid, student_alice, None).unwrap();
    assert!(attestation.revoked);

    // Test revocation with reference
    let reference = "REF123";
    test_env.attest_helper(
        university,
        &schema_uid,
        student_alice,
        attestation_value,
        Some(reference)
    ).unwrap();

    test_env.revoke_attestation_helper(
        university,
        &schema_uid,
        student_alice,
        Some(reference)
    ).unwrap();

    let attestation_with_ref = test_env.get_attestation_helper(&schema_uid, student_alice, Some(reference)).unwrap();
    assert!(attestation_with_ref.revoked);

    // Test unauthorized revocation
    let unauthorized = Address::generate(&test_env.env);
    let result = test_env.revoke_attestation_helper(
        &unauthorized,
        &schema_uid,
        student_alice,
        None
    );
    assert!(matches!(result.err().unwrap(), errors::Error::NotAuthorized));

    // Test revocation of non-revocable schema
    let non_revocable_schema_uid = test_env.register_schema_helper(
        university,
        schema_definition,
        None,
        false
    ).unwrap();

    test_env.attest_helper(
        university,
        &non_revocable_schema_uid,
        student_alice,
        attestation_value,
        None
    ).unwrap();

    let result = test_env.revoke_attestation_helper(
        university,
        &non_revocable_schema_uid,
        student_alice,
        None
    );
    assert!(matches!(result.err().unwrap(), errors::Error::AttestationNotRevocable));
}

#[test]
fn test_complex_scenario() {
    let test_env = TestEnv::setup();
    let admin = &test_env.admin;
    let university = &test_env.university;
    let company = &test_env.company;
    let student_alice = &test_env.student_alice;
    let student_bob = &test_env.student_bob;

    // Initialize contract and register authorities
    test_env.env.as_contract(&test_env.contract_id, || {
        AttestationContract::initialize(test_env.env.clone(), admin.clone()).unwrap();
    });
    test_env.register_authority_helper(admin, university, "University Authority").unwrap();
    test_env.register_authority_helper(admin, company, "Company Authority").unwrap();

    // Register schemas
    let degree_schema = r#"{
        "name": "Degree",
        "version": "1.0",
        "description": "University degree attestation",
        "fields": [
            {"name": "degree", "type": "string"},
            {"name": "field", "type": "string"},
            {"name": "graduation_date", "type": "string"}
        ]
    }"#;

    let employment_schema = r#"{
        "name": "Employment",
        "version": "1.0",
        "description": "Employment verification",
        "fields": [
            {"name": "position", "type": "string"},
            {"name": "department", "type": "string"},
            {"name": "start_date", "type": "string"}
        ]
    }"#;

    let degree_schema_uid = test_env.register_schema_helper(
        university,
        degree_schema,
        None,
        true
    ).unwrap();

    let employment_schema_uid = test_env.register_schema_helper(
        company,
        employment_schema,
        None,
        true
    ).unwrap();

    // Create attestations
    let degree_value = r#"{
        "degree": "Bachelor of Science",
        "field": "Computer Science",
        "graduation_date": "2023-05-15"
    }"#;

    let employment_value = r#"{
        "position": "Software Engineer",
        "department": "Engineering",
        "start_date": "2023-06-01"
    }"#;

    // Attest degrees
    test_env.attest_helper(
        university,
        &degree_schema_uid,
        student_alice,
        degree_value,
        None
    ).unwrap();

    test_env.attest_helper(
        university,
        &degree_schema_uid,
        student_bob,
        degree_value,
        None
    ).unwrap();

    // Attest employment
    test_env.attest_helper(
        company,
        &employment_schema_uid,
        student_alice,
        employment_value,
        None
    ).unwrap();

    // Verify attestations
    let alice_degree = test_env.get_attestation_helper(&degree_schema_uid, student_alice, None).unwrap();
    assert_eq!(alice_degree.subject, *student_alice);
    assert!(!alice_degree.revoked);

    let bob_degree = test_env.get_attestation_helper(&degree_schema_uid, student_bob, None).unwrap();
    assert_eq!(bob_degree.subject, *student_bob);
    assert!(!bob_degree.revoked);

    let alice_employment = test_env.get_attestation_helper(&employment_schema_uid, student_alice, None).unwrap();
    assert_eq!(alice_employment.subject, *student_alice);
    assert!(!alice_employment.revoked);

    // Revoke Bob's degree
    test_env.revoke_attestation_helper(
        university,
        &degree_schema_uid,
        student_bob,
        None
    ).unwrap();

    // Verify Bob's degree is revoked
    let bob_degree_after_revoke = test_env.get_attestation_helper(&degree_schema_uid, student_bob, None).unwrap();
    assert!(bob_degree_after_revoke.revoked);

    // Alice's degree and employment should still be valid
    let alice_degree_after_revoke = test_env.get_attestation_helper(&degree_schema_uid, student_alice, None).unwrap();
    assert!(!alice_degree_after_revoke.revoked);

    let alice_employment_after_revoke = test_env.get_attestation_helper(&employment_schema_uid, student_alice, None).unwrap();
    assert!(!alice_employment_after_revoke.revoked);
}
