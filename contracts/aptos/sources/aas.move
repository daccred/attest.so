module aas::aas {
    use aptos_framework::account::{SignerCapability};
    use aptos_framework::account;
    use aptos_framework::event;
    use aptos_framework::transaction_context;
    use aptos_framework::timestamp;
    use aptos_std::table::{Self, Table};
    use aptos_std::aptos_hash::{keccak256};
    use aptos_token::token::{Self};
    use std::bcs;
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;
    

    const ESTRING_TOO_LONG: u64 = 1;
    const ENOT_SCHEMA_CREATOR: u64 = 2;
    const E_NOT_REVOKABLE: u64 = 3;
    const EATTESTATION_NOT_FOUND: u64 = 4;
    const EATTESTATION_ALREADY_REVOKED: u64 = 5;
    const EATTESTATIONS_NOT_EXIST_AT_ADDRESS: u64 = 6;

    struct Schema has key {
        increment_id: u64,
        name: String,
        description: String,
        uri: String,
        creator: address,
        created_at: u64,
        schema: vector<u8>,
        revokable: bool,
        only_attest_by_creator: bool,
        attestation_cnt: u64,
        txHash: vector<u8>,
        schema_signer_capability: SignerCapability,
    }

    struct Attestations has key {
        attestations: Table<vector<u8>, Attestation>,
    }

    struct Attestation has copy, drop, store {
        id: vector<u8>,
        schema: address,
        ref_id: address,
        time: u64,
        expiration_time: u64,
        revocation_time: u64,
        revokable: bool,
        attester: address,
        recipient: address,
        data: vector<u8>,
        txHash: vector<u8>,
    }

    struct SchemaRegistry has key {
        schemas: vector<address>,
    }

    struct SchemaAttestations has key {
        attestation_ids: vector<vector<u8>>,
    }

    struct AttestationRegistry has key {
        attestation_ids: vector<vector<u8>>,
        id_to_schema: Table<vector<u8>, address>,
    }

    #[event]
    struct SchemaCreated has drop, store {
        schema_addr: address,
        increment_id: u64,
        name: String,
        description: String,
        uri: String,
        creator: address,
        created_at: u64,
        schema: vector<u8>,
        revokable: bool,
        only_attest_by_creator: bool,
        attestation_cnt: u64,
    }

    #[event]
    struct AttestationCreated has drop, store {
        id: vector<u8>,
        schema: address,
        ref_id: address,
        time: u64,
        expiration_time: u64,
        revokable: bool,
        attester: address,
        recipient: address,
        data: vector<u8>,
    }

    #[event]
    struct AttestationRevoked has drop, store {
        schema_addr: address,
        attestation_id: vector<u8>,
        revocation_time: u64,
    }

    #[view]
    public fun get_attestation(schema_addr: address, attestation_id: vector<u8>): Attestation acquires Attestations {
       assert!(exists<Attestations>(schema_addr), error::not_found(EATTESTATIONS_NOT_EXIST_AT_ADDRESS));
       let attestations = &borrow_global<Attestations>(schema_addr).attestations;
       assert!(table::contains(attestations, attestation_id), error::not_found(EATTESTATION_NOT_FOUND));
       *table::borrow(attestations, attestation_id)
    }

    #[view]
    public fun unpack_schema(schema_addr: address): (u64, String, String, String, address, u64, vector<u8>, bool, bool, u64, vector<u8>) acquires Schema {
        let schema = borrow_global<Schema>(schema_addr);
        (
            schema.increment_id,
            schema.name,
            schema.description,
            schema.uri,
            schema.creator,
            schema.created_at,
            schema.schema,
            schema.revokable,
            schema.only_attest_by_creator,
            schema.attestation_cnt,
            schema.txHash,
        )
    }

    #[view]
    public fun get_schema_addresses(start: u64, limit: u64): vector<address> acquires SchemaRegistry {
        let registry = borrow_global<SchemaRegistry>(@aas);
        let total = vector::length(&registry.schemas);
        let end = if (start + limit > total) { total } else { start + limit };
        let result = vector::empty();
        let i = start;
        while (i < end) {
            vector::push_back(&mut result, *vector::borrow(&registry.schemas, i));
            i = i + 1;
        };
        result
    }

    #[view]
    public fun get_schema_attestation_ids(schema_addr: address, start: u64, limit: u64): vector<vector<u8>> acquires SchemaAttestations {
        let schema_attestations = borrow_global<SchemaAttestations>(schema_addr);
        let total = vector::length(&schema_attestations.attestation_ids);
        let end = if (start + limit > total) { total } else { start + limit };
        let result = vector::empty();
        let i = start;
        while (i < end) {
            vector::push_back(&mut result, *vector::borrow(&schema_attestations.attestation_ids, i));
            i = i + 1;
        };
        result
    }

    #[view]
    public fun get_schema_count(): u64 acquires SchemaRegistry {
        let registry = borrow_global<SchemaRegistry>(@aas);
        vector::length(&registry.schemas)
    }

    #[view]
    public fun get_schema_attestation_count(schema_addr: address): u64 acquires SchemaAttestations {
        let schema_attestations = borrow_global<SchemaAttestations>(schema_addr);
        vector::length(&schema_attestations.attestation_ids)
    }

    #[view]
    public fun get_all_attestation_ids(start: u64, limit: u64): vector<vector<u8>> acquires AttestationRegistry {
        let registry = borrow_global<AttestationRegistry>(@aas);
        let total = vector::length(&registry.attestation_ids);
        let end = if (start + limit > total) { total } else { start + limit };
        let result = vector::empty();
        let i = start;
        while (i < end) {
            vector::push_back(&mut result, *vector::borrow(&registry.attestation_ids, i));
            i = i + 1;
        };
        result
    }

    #[view]
    public fun get_attestation_count(): u64 acquires AttestationRegistry {
        let registry = borrow_global<AttestationRegistry>(@aas);
        vector::length(&registry.attestation_ids)
    }

    #[view]
    public fun get_attestation_by_id(attestation_id: vector<u8>): Attestation acquires AttestationRegistry, Attestations {
        let attestation_registry = borrow_global<AttestationRegistry>(@aas);
        assert!(table::contains(&attestation_registry.id_to_schema, attestation_id), error::not_found(EATTESTATION_NOT_FOUND));
        let schema_addr = *table::borrow(&attestation_registry.id_to_schema, attestation_id);
        get_attestation(schema_addr, attestation_id)
    }

    public entry fun create_schema(
        admin: &signer, 
        schema: vector<u8>, 
        name: String, 
        description: String, 
        uri: String, 
        revokable: bool,
        only_attest_by_creator: bool,
    ) acquires SchemaRegistry {
        create_schema_and_get_schema_address(admin, schema, name, description, uri, revokable, only_attest_by_creator);
    }

    public fun create_schema_and_get_schema_address(
        admin: &signer, 
        schema: vector<u8>, 
        name: String, 
        description: String, 
        uri: String, 
        revokable: bool,
        only_attest_by_creator: bool,
    ): address acquires SchemaRegistry {
        let src_addr = signer::address_of(admin);

        let seed = bcs::to_bytes(&name);
        vector::append(&mut seed, bcs::to_bytes(&src_addr));
        vector::append(&mut seed, bcs::to_bytes(&description));
        vector::append(&mut seed, bcs::to_bytes(&uri));
        vector::append(&mut seed, bcs::to_bytes(&revokable));
        vector::append(&mut seed, bcs::to_bytes(&only_attest_by_creator));

        let (res_signer, res_cap) = account::create_resource_account(admin, seed);

        token::opt_in_direct_transfer(&res_signer, true);

        assert!(string::length(&name) < 128, error::invalid_argument(ESTRING_TOO_LONG));
        assert!(string::length(&description) < 512, error::invalid_argument(ESTRING_TOO_LONG));
        assert!(string::length(&uri) < 512, error::invalid_argument(ESTRING_TOO_LONG));

        let schema_addr = signer::address_of(&res_signer);

        // Add schema address to the registry
        let registry = borrow_global_mut<SchemaRegistry>(@aas);
        vector::push_back(&mut registry.schemas, schema_addr);
        
        move_to(
            &res_signer,
            Schema {
                increment_id: vector::length(&registry.schemas),
                name: name,
                description: description,
                uri: uri,
                creator: src_addr,
                created_at: timestamp::now_seconds(),
                schema: schema,
                revokable: revokable,
                only_attest_by_creator: only_attest_by_creator,
                attestation_cnt: 0,
                txHash: transaction_context::get_transaction_hash(),
                schema_signer_capability: res_cap,
            },
        );

        move_to(
            &res_signer,
            Attestations {
                attestations: table::new(),
            },
        );

        event::emit(
            SchemaCreated {
                schema_addr: schema_addr,
                increment_id: vector::length(&registry.schemas),
                name: name,
                description: description,
                uri: uri,
                creator: src_addr,
                created_at: timestamp::now_seconds(),
                schema: schema,
                revokable: revokable,
                only_attest_by_creator: only_attest_by_creator,
                attestation_cnt: 0,
            }
        );

        // Create a new SchemaAttestations resource
        move_to(&res_signer, SchemaAttestations { attestation_ids: vector::empty() });

        schema_addr

    }

    public entry fun create_attestation(
        attester: &signer, 
        recipient: address,
        schema_addr: address, 
        ref_id: address, 
        expiration_time: u64, 
        revokable: bool, 
        data: vector<u8>
    ) acquires Schema, Attestations, SchemaAttestations, AttestationRegistry {
        create_attestation_and_get_id(attester, recipient, schema_addr, ref_id, expiration_time, revokable, data);
    }

    public fun create_attestation_and_get_id(
        attester: &signer, 
        recipient: address,
        schema_addr: address, 
        ref_id: address, 
        expiration_time: u64, 
        revokable: bool, 
        data: vector<u8>
    ): vector<u8> acquires Schema, Attestations, SchemaAttestations, AttestationRegistry {
        // TODO: check ref_id is a valid address
        let schema = borrow_global_mut<Schema>(schema_addr);
        let attester_addr = signer::address_of(attester);

        if (schema.only_attest_by_creator) {
            assert!(attester_addr == schema.creator, error::invalid_argument(ENOT_SCHEMA_CREATOR));
        };

        let now = timestamp::now_seconds();

        let seed = bcs::to_bytes(&attester_addr);
        vector::append(&mut seed, bcs::to_bytes(&schema_addr));
        vector::append(&mut seed, bcs::to_bytes(&recipient));
        vector::append(&mut seed, bcs::to_bytes(&ref_id));
        vector::append(&mut seed, bcs::to_bytes(&expiration_time));
        vector::append(&mut seed, bcs::to_bytes(&revokable));
        vector::append(&mut seed, bcs::to_bytes(&now));
        vector::append(&mut seed, data);

        let id = keccak256(seed);

        let attestation = Attestation {
            id: id,
            schema: schema_addr,
            ref_id: ref_id,
            time: now,
            expiration_time: expiration_time,
            revocation_time: 0,
            revokable: revokable,
            attester: attester_addr,
            recipient: recipient,
            data: data,
            txHash: transaction_context::get_transaction_hash(),
        };

        let attestation_store = borrow_global_mut<Attestations>(schema_addr);
        table::add(&mut attestation_store.attestations, attestation.id, attestation);

        event::emit(
            AttestationCreated {
                id: id,
                schema: schema_addr,
                ref_id: ref_id,
                time: now,
                expiration_time: expiration_time,
                revokable: revokable,
                attester: attester_addr,
                recipient: recipient,
                data: data,
            }
        );

        schema.attestation_cnt = schema.attestation_cnt + 1;

        // Add the new attestation id to the schema's attestations
        let schema_attestations = borrow_global_mut<SchemaAttestations>(schema_addr);
        vector::push_back(&mut schema_attestations.attestation_ids, id);

        // Add the new attestation id to the global registry
        let attestation_registry = borrow_global_mut<AttestationRegistry>(@aas);
        vector::push_back(&mut attestation_registry.attestation_ids, id);
        table::add(&mut attestation_registry.id_to_schema, id, schema_addr);

        id
    }

    public entry fun revoke_attestation(
        admin: &signer,
        schema_addr: address,
        attestation_id: vector<u8>,
    ) acquires Schema, Attestations {
        let admin_addr = signer::address_of(admin);

        let schema = borrow_global_mut<Schema>(schema_addr);
        assert!(admin_addr == schema.creator, error::invalid_argument(ENOT_SCHEMA_CREATOR));
        assert!(schema.revokable, error::invalid_argument(E_NOT_REVOKABLE));

        let attestation_store = borrow_global_mut<Attestations>(schema_addr);
        assert!(table::contains(&attestation_store.attestations, attestation_id), error::invalid_argument(EATTESTATION_NOT_FOUND));
        let attestation = table::borrow_mut(&mut attestation_store.attestations, attestation_id);
        assert!(attestation.revocation_time == 0, error::invalid_argument(EATTESTATION_ALREADY_REVOKED));
        attestation.revocation_time = timestamp::now_seconds();

        event::emit(
            AttestationRevoked {
                schema_addr: schema_addr,
                attestation_id: attestation_id,
                revocation_time: timestamp::now_seconds(),
            }
        );
    }

    #[test(aptos_framework=@0x1, creator = @0xdeaf, aas = @0x7256a89a84f9eeb35807b8a72181c840c0fc1d9f8f9ad26ef0fc32fbfd5ac066)]
    public fun test_e2e(aptos_framework: &signer, creator: &signer, aas: &signer) acquires Schema, Attestations, SchemaRegistry, SchemaAttestations, AttestationRegistry {
        init_module(aas);

        timestamp::set_time_has_started_for_testing(aptos_framework);
        
        // Create a schema
        let creator_addr = signer::address_of(creator);
        let schema_raw: vector<u8> = b"name: String, age: u16";
        let res_acc = create_schema_and_get_schema_address(
            creator,
            schema_raw,
            string::utf8(b"Profile"),
            string::utf8(b"User Profile"),
            string::utf8(b"www.google.com"),
            true,
            false
        );

        // Check schema creation
        let schema_count = get_schema_count();
        assert!(schema_count == 1, 101);
        let schema_addresses = get_schema_addresses(0, 10);
        assert!(vector::length(&schema_addresses) == 1, 102);
        assert!(*vector::borrow(&schema_addresses, 0) == res_acc, 103);

        // Create an attestation
        let id = create_attestation_and_get_id(
            creator,
            creator_addr,
            res_acc,
            creator_addr,
            0,
            false,
            b"name: alice, age: 18"
        );

        // Check attestation creation
        let attestation = get_attestation(res_acc, id);
        assert!(attestation.revocation_time == 0, 201);
        
        let schema_attestation_count = get_schema_attestation_count(res_acc);
        assert!(schema_attestation_count == 1, 202);
        let schema_attestation_ids = get_schema_attestation_ids(res_acc, 0, 10);
        assert!(vector::length(&schema_attestation_ids) == 1, 203);
        assert!(*vector::borrow(&schema_attestation_ids, 0) == id, 204);

        let total_attestation_count = get_attestation_count();
        assert!(total_attestation_count == 1, 205);
        let all_attestation_ids = get_all_attestation_ids(0, 10);
        assert!(vector::length(&all_attestation_ids) == 1, 206);
        assert!(*vector::borrow(&all_attestation_ids, 0) == id, 207);

        // Revoke attestation
        timestamp::update_global_time_for_test_secs(20000000);
        revoke_attestation(creator, res_acc, id);
        attestation = get_attestation(res_acc, id);
        assert!(attestation.revocation_time == 20000000, 301);

        // Check revoked state
        assert!(get_schema_attestation_count(res_acc) == 1, 302);
        assert!(get_attestation_count() == 1, 303);
    }

    fun init_module(account: &signer) {
        move_to(account, SchemaRegistry { schemas: vector::empty() });
        move_to(account, AttestationRegistry { 
            attestation_ids: vector::empty(),
            id_to_schema: table::new(),
        });
    }

}