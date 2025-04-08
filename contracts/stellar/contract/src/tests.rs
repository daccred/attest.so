use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    Address, Env, String as SorobanString, BytesN,
};
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

        let test_env = TestEnv {
            env,
            contract_id,
            admin,
            university,
            company,
            student_alice,
            student_bob,
            employee_charlie,
            employee_dave,
        };

        // Initialize the contract with admin authorization
        test_env.env.mock_all_auths();
        test_env.env.as_contract(&test_env.contract_id, || {
            AttestationContract::initialize(test_env.env.clone(), test_env.admin.clone())
        }).unwrap();

        test_env
    }

    pub fn register_authority_helper(&self, admin: &Address, auth_to_reg: &Address, metadata: &str) -> Result<(), errors::Error> {
        self.env.mock_auths(&[MockAuth {
            address: admin.clone(),
            invoke: &MockAuthInvoke {
                contract: &self.contract_id,
                fn_name: "reg_auth",
                args: (&admin, &auth_to_reg, &SorobanString::from_str(&self.env, metadata)).into_val(&self.env),
                sub_invokes: &[],
            },
        }]);
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
        self.env.mock_auths(&[MockAuth {
            address: authority.clone(),
            invoke: &MockAuthInvoke {
                contract: &self.contract_id,
                fn_name: "register",
                args: (&authority, &SorobanString::from_str(&self.env, schema_definition), &resolver, &revocable).into_val(&self.env),
                sub_invokes: &[],
            },
        }]);
        self.env.as_contract(&self.contract_id, || {
            AttestationContract::register(
                self.env.clone(),
                authority.clone(),
                SorobanString::from_str(&self.env, schema_definition),
                resolver.cloned(),
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
        self.env.mock_auths(&[MockAuth {
            address: caller.clone(),
            invoke: &MockAuthInvoke {
                contract: &self.contract_id,
                fn_name: "attest",
                args: (&caller, &schema_uid, &subject, &SorobanString::from_str(&self.env, value), &reference.map(|s| SorobanString::from_str(&self.env, s))).into_val(&self.env),
                sub_invokes: &[],
            },
        }]);
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
        self.env.mock_auths(&[MockAuth {
            address: caller.clone(),
            invoke: &MockAuthInvoke {
                contract: &self.contract_id,
                fn_name: "revoke_attestation",
                args: (&caller, &schema_uid, &subject, &reference.map(|s| SorobanString::from_str(&self.env, s))).into_val(&self.env),
                sub_invokes: &[],
            },
        }]);
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

    // Test re-initialization fails
    test_env.env.mock_all_auths();
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

    // Register authority
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
        false
    ).unwrap();

    // Verify schema with resolver was registered
    let schema = test_env.get_schema_helper(&schema_uid_with_resolver);
    assert!(schema.is_some());
    let schema = schema.as_ref().unwrap();
    assert_eq!(schema.authority, *university);
    assert_eq!(schema.definition, SorobanString::from_str(&test_env.env, schema_definition));
    assert!(!schema.revocable);
    assert_eq!(schema.resolver.as_ref().unwrap(), &resolver);

    // Test unauthorized schema registration
    let unauthorized = Address::generate(&test_env.env);
    let result = test_env.register_schema_helper(
        &unauthorized,
        schema_definition,
        None,
        true
    );
    assert!(matches!(result.err().unwrap(), errors::Error::NotAuthorized));
}

#[test]
fn test_attestation() {
    let test_env = TestEnv::setup();
    let admin = &test_env.admin;
    let university = &test_env.university;
    let student_alice = &test_env.student_alice;

    // Register authority and schema
    test_env.register_authority_helper(admin, university, "University Authority").unwrap();

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
        "graduation_date": "2024-05-15"
    }"#;

    test_env.attest_helper(
        university,
        &schema_uid,
        student_alice,
        attestation_value,
        None
    ).unwrap();

    // Verify attestation was recorded
    let attestation = test_env.get_attestation_helper(
        &schema_uid,
        student_alice,
        None
    ).unwrap();

    assert_eq!(attestation.schema_uid, schema_uid);
    assert_eq!(attestation.subject, *student_alice);
    assert_eq!(attestation.value, SorobanString::from_str(&test_env.env, attestation_value));
    assert!(!attestation.revoked);

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

    // Register authority and schema
    test_env.register_authority_helper(admin, university, "University Authority").unwrap();

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
        "graduation_date": "2024-05-15"
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

    // Verify attestation was revoked
    let attestation = test_env.get_attestation_helper(
        &schema_uid,
        student_alice,
        None
    ).unwrap();

    assert!(attestation.revoked);

    // Test unauthorized revocation
    let unauthorized = Address::generate(&test_env.env);
    let result = test_env.revoke_attestation_helper(
        &unauthorized,
        &schema_uid,
        student_alice,
        None
    );
    assert!(matches!(result.err().unwrap(), errors::Error::NotAuthorized));
}

#[test]
fn test_complex_scenario() {
    let test_env = TestEnv::setup();
    let admin = &test_env.admin;
    let university = &test_env.university;
    let company = &test_env.company;
    let student_alice = &test_env.student_alice;
    let student_bob = &test_env.student_bob;

    // Register authorities
    test_env.register_authority_helper(admin, university, "University Authority").unwrap();
    test_env.register_authority_helper(admin, company, "Company Authority").unwrap();

    // Register schemas
    let degree_schema_definition = r#"{
        "name": "Degree",
        "version": "1.0",
        "description": "University degree attestation",
        "fields": [
            {"name": "degree", "type": "string"},
            {"name": "field", "type": "string"},
            {"name": "graduation_date", "type": "string"}
        ]
    }"#;

    let employment_schema_definition = r#"{
        "name": "Employment",
        "version": "1.0",
        "description": "Employment attestation",
        "fields": [
            {"name": "position", "type": "string"},
            {"name": "start_date", "type": "string"},
            {"name": "salary", "type": "number"}
        ]
    }"#;

    let degree_schema_uid = test_env.register_schema_helper(
        university,
        degree_schema_definition,
        None,
        true
    ).unwrap();

    let employment_schema_uid = test_env.register_schema_helper(
        company,
        employment_schema_definition,
        None,
        true
    ).unwrap();

    // Create attestations
    let alice_degree = r#"{
        "degree": "Bachelor of Science",
        "field": "Computer Science",
        "graduation_date": "2024-05-15"
    }"#;

    let bob_degree = r#"{
        "degree": "Master of Science",
        "field": "Data Science",
        "graduation_date": "2024-05-15"
    }"#;

    let alice_employment = r#"{
        "position": "Software Engineer",
        "start_date": "2024-06-01",
        "salary": 100000
    }"#;

    test_env.attest_helper(
        university,
        &degree_schema_uid,
        student_alice,
        alice_degree,
        None
    ).unwrap();

    test_env.attest_helper(
        university,
        &degree_schema_uid,
        student_bob,
        bob_degree,
        None
    ).unwrap();

    test_env.attest_helper(
        company,
        &employment_schema_uid,
        student_alice,
        alice_employment,
        None
    ).unwrap();

    // Verify attestations
    let alice_degree_attestation = test_env.get_attestation_helper(
        &degree_schema_uid,
        student_alice,
        None
    ).unwrap();
    assert_eq!(alice_degree_attestation.value, SorobanString::from_str(&test_env.env, alice_degree));

    let bob_degree_attestation = test_env.get_attestation_helper(
        &degree_schema_uid,
        student_bob,
        None
    ).unwrap();
    assert_eq!(bob_degree_attestation.value, SorobanString::from_str(&test_env.env, bob_degree));

    let alice_employment_attestation = test_env.get_attestation_helper(
        &employment_schema_uid,
        student_alice,
        None
    ).unwrap();
    assert_eq!(alice_employment_attestation.value, SorobanString::from_str(&test_env.env, alice_employment));

    // Test revocation
    test_env.revoke_attestation_helper(
        university,
        &degree_schema_uid,
        student_alice,
        None
    ).unwrap();

    let revoked_attestation = test_env.get_attestation_helper(
        &degree_schema_uid,
        student_alice,
        None
    ).unwrap();
    assert!(revoked_attestation.revoked);
}
