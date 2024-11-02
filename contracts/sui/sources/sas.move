
/// Module: sas
module sas::sas {
    // === Imports ===
    use sui::{
        tx_context::{sender},
        url::{Self, Url},
        event::{emit},
        clock::{Self, Clock},
    };
    use std::string;
    use sas::schema::{Self, SchemaRecord, Request};
    use sas::attestation_registry::{AttestationRegistry};

    // === Errors ===
    const EExpired: u64 = 0;
    const ERefIdNotFound: u64 = 1;
    const EHasResolver: u64 = 2;

    // === Events ===
    public struct Attest has copy, drop {
        /// 0: Attest, 1: AttestWithResolver
        event_type: u8,
        id: address,
        schema: address,
        ref_id: address,
        attester: address,
        tx_hash: vector<u8>,
        revokable: bool,
        time: u64,
        expireation_time: u64,
        data: vector<u8>,
        name: string::String,
        description: string::String,
        url: Url,
    }

    // === Structs ===
    public struct Attestation has key {
        id: UID,
        schema: address,
        ref_id: address,
        attester: address,
        tx_hash: vector<u8>,
        time: u64,
        revokable: bool,
        expireation_time: u64,
        data: vector<u8>,
        name: string::String,
        description: string::String,
        url: Url,
    }


    // === Public-View Functions ===
    public fun schema(self: &Attestation): address {
        self.schema
    }

    public fun ref_id(self: &Attestation): address {
        self.ref_id
    }

    public fun attester(self: &Attestation): address {
        self.attester
    }

    public fun tx_hash(self: &Attestation): vector<u8> {
        self.tx_hash
    }

    public fun time(self: &Attestation): u64 {
        self.time
    }

    public fun revokable(self: &Attestation): bool {
        self.revokable
    }

    public fun expireation_time(self: &Attestation): u64 {
        self.expireation_time
    }

    public fun data(self: &Attestation): vector<u8> {
        self.data
    }

    public fun name(self: &Attestation): string::String {
        self.name
    }

    public fun description(self: &Attestation): string::String {
        self.description
    }

    public fun url(self: &Attestation): Url {
        self.url
    }

    // === Public Functions ===
    public fun attest(
        schema_record: &mut SchemaRecord,
        attestation_registry: &mut AttestationRegistry,
        ref_id: address,
        recipient: address,
        expireation_time: u64,
        data: vector<u8>,
        name: vector<u8>,
        description: vector<u8>,
        url: vector<u8>,
        time: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(!schema_record.has_resolver(), EHasResolver);
        if (ref_id != @0x0) {
            assert!(attestation_registry.is_exist(ref_id), ERefIdNotFound);
        };
        
        let attester = ctx.sender();

        if (expireation_time != 0) {
            assert!(time.timestamp_ms() < expireation_time, EExpired);
        };

        schema_record.update_attestation_cnt();

        let attestation = Attestation {
            id: object::new(ctx),
            schema: object::id_address(schema_record),
            time: clock::timestamp_ms(time),
            expireation_time: expireation_time,
            revokable: schema_record.revokable(),
            ref_id: ref_id,
            attester: attester,
            tx_hash: *ctx.digest(),
            data: data,
            name: string::utf8(name),
            description: string::utf8(description),
            url: url::new_unsafe_from_bytes(url)
        };

        attestation_registry.registry(object::id_address(&attestation), schema_record.addy());

        emit(
            Attest {
                event_type: 0,
                id: object::id_address(&attestation),
                schema: attestation.schema,
                ref_id: attestation.ref_id,
                attester: attestation.attester,
                tx_hash: *ctx.digest(),
                revokable: attestation.revokable,
                time: attestation.time,
                expireation_time: attestation.expireation_time,
                data: attestation.data,
                name: attestation.name,
                description: attestation.description,
                url: attestation.url
            }
        );

        transfer::transfer(attestation, recipient);
    }

    public fun attest_with_resolver(
        schema_record: &mut SchemaRecord,
        attestation_registry: &mut AttestationRegistry,
        ref_id: address,
        recipient: address,
        expireation_time: u64,
        data: vector<u8>,
        name: vector<u8>,
        description: vector<u8>,
        url: vector<u8>,
        time: &Clock,
        request: Request,
        ctx: &mut TxContext
    ) {
        if (ref_id != @0x0) {
            assert!(attestation_registry.is_exist(ref_id), ERefIdNotFound);
        };

        schema_record.update_attestation_cnt();

        let attester = ctx.sender();

        if (expireation_time != 0) {
            assert!(time.timestamp_ms() < expireation_time, EExpired);
        };

        schema::finish_attest( schema_record, request);

        let attestation = Attestation {
            id: object::new(ctx),
            schema: object::id_address(schema_record),
            time: clock::timestamp_ms(time),
            expireation_time: expireation_time,
            ref_id: ref_id,
            attester: attester,
            tx_hash: *ctx.digest(),
            revokable: schema_record.revokable(),
            data: data,
            name: string::utf8(name),
            description: string::utf8(description),
            url: url::new_unsafe_from_bytes(url)
        };

        emit(
            Attest {
                event_type: 1,
                id: object::id_address(&attestation),
                schema: attestation.schema,
                ref_id: attestation.ref_id,
                attester: attestation.attester,
                tx_hash: *ctx.digest(),
                revokable: attestation.revokable,
                time: attestation.time,
                expireation_time: attestation.expireation_time,
                data: attestation.data,
                name: attestation.name,
                description: attestation.description,
                url: attestation.url
            }
        );

        transfer::transfer(attestation, recipient);
    }

}
