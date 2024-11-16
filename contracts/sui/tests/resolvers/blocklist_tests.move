#[test_only]
module sas::blocklist_tests {
    use sui::{
        test_scenario::{Self},
        clock::{Self}
    };
    use std::string::{Self, String};
    use sas::sas::{Self, Attestation};
    use sas::schema::{Self, SchemaRecord, ResolverBuilder};
    use sas::blocklist::{Self};
    use sas::schema_registry::{Self, SchemaRegistry};
    use sas::attestation_registry::{Self, AttestationRegistry};
    use sas::admin::{Admin};

    #[test]
    fun test_blocklist() {
        let alice: address = @0x1;
        let bob: address = @0x2;
        let cathrine: address = @0x3;

        let label: String = string::utf8(b"Profile");
        let schema: vector<u8> = b"name: string, age: u64";
        let data: vector<u8> = b"alice, 100";
        let name: vector<u8> = b"Profile";
        let description: vector<u8> = b"Profile of a user";
        let url: vector<u8> = b"https://example.com";

        let mut resolver_builder: ResolverBuilder;
        let mut scenario = test_scenario::begin(alice);
        {
            schema_registry::test_init(test_scenario::ctx(&mut scenario));
            attestation_registry::test_init(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, alice);
        {
            let mut schema_registry = test_scenario::take_shared<SchemaRegistry>(&scenario);
            let (builder, admin_cap) = schema::new_with_resolver(&mut schema_registry, schema, label, false, test_scenario::ctx(&mut scenario));
            resolver_builder = builder;

            transfer::public_transfer(admin_cap, alice);
            test_scenario::return_shared<SchemaRegistry>(schema_registry);
        };

        test_scenario::next_tx(&mut scenario, alice);
        {
            let mut attestation_registry = test_scenario::take_shared<AttestationRegistry>(&scenario);
            let mut schema_record = test_scenario::take_shared<SchemaRecord>(&scenario);
            let admin_cap = test_scenario::take_from_sender<Admin>(&scenario);

            blocklist::add(&schema_record, &mut resolver_builder, test_scenario::ctx(&mut scenario));
            schema_record.add_resolver(resolver_builder);
            
            blocklist::add_user(&admin_cap, &mut schema_record, cathrine);
            assert!(blocklist::is_blocklisted(&schema_record, cathrine));
            assert!(!blocklist::is_blocklisted(&schema_record, bob));

            let mut request = schema_record.start_attest();
            blocklist::approve(&schema_record, &mut request, test_scenario::ctx(&mut scenario));

            let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

            sas::attest_with_resolver(
                &mut schema_record,
                &mut attestation_registry,
                @0x0,
                bob,
                0,
                data,
                name,
                description,
                url,
                &clock,
                request,
                test_scenario::ctx(&mut scenario)
            );

            test_scenario::return_shared<AttestationRegistry>(attestation_registry);
            test_scenario::return_shared<SchemaRecord>(schema_record);
            transfer::public_transfer(admin_cap, alice);
            clock::share_for_testing(clock);
        };

        test_scenario::next_tx(&mut scenario, bob);
        {
            let schema_record = test_scenario::take_shared<SchemaRecord>(&scenario);
            let attestation = test_scenario::take_from_sender<Attestation>(&scenario);
            assert!(sas::schema(&attestation) == schema_record.addy());

            test_scenario::return_shared<SchemaRecord>(schema_record);
            test_scenario::return_to_sender<Attestation>(&scenario, attestation);
        };

        test_scenario::end(scenario);
    }
}