module sas::schema {
    // === Imports ===
    use std::{
        string::{String}, 
        type_name::{Self, TypeName}
    };
    use sui::{
        bag::{Self, Bag},
        vec_map::{Self, VecMap},
        vec_set::{Self, VecSet},
        event::{emit},
    };
    use sas::schema_registry::{SchemaRegistry};
    use sas::admin::{Self, Admin};

    // ==== Errors ====
    const EWrongSchemaAddress: u64 = 0;
    const ENoResolver: u64 = 1;
    const EMustBeFinishRequest: u64 = 2;
    const ERuleNotApproved: u64 = 3;


    // ==== Events ====
    public struct SchemaCreated has copy, drop {
        /// 0: SchemaCreated, 1: SchemaCreatedWithResolver
        event_type: u8,
        incrementing_id: u64,
        label: String,
        schema_address: address,
        creator: address,
        created_at: u64,
        tx_hash: vector<u8>,
        schema: vector<u8>,
        revokable: bool
    }

    // ==== Constants ====
    const START_ATTEST: vector<u8> = b"START_ATTEST";

    // ==== Structs ====
    public struct SchemaRecord has key, store {
        id: UID,
        incrementing_id: u64,
        attestation_cnt: u64,
        label: String,
        creator: address,
        created_at: u64,
        tx_hash: vector<u8>,
        schema: vector<u8>,
        revokable: bool,
        resolver: Option<Resolver>
    }

    public struct Resolver has store {
        rules: VecMap<String, VecSet<TypeName>>,
        config: Bag
    }

    public struct ResolverBuilder {
        schema_address: address,
        rules: VecMap<String, VecSet<TypeName>>,
        config: Bag
    }

    public struct Request {
        name: String,
        schema_address: address,
        approvals: VecSet<TypeName>
    }
  
    // === Public-Mutative Functions ===
    public fun start_attest(self: &SchemaRecord): Request {
        assert!(self.has_resolver(), ENoResolver);  
        new_request(self, START_ATTEST.to_string())
    }

    public fun finish_attest(self: &SchemaRecord, request: Request) {
        assert!(self.has_resolver(), ENoResolver);
        assert!(request.name() == START_ATTEST.to_string(), EMustBeFinishRequest);

        self.confirm(request);
    }

    // === Public-View Functions ===
    public fun start_attest_name(): vector<u8> {
        START_ATTEST
    }

    public fun schema(self: &SchemaRecord): vector<u8> {
        self.schema
    }

    public fun label(self: &SchemaRecord): String {
        self.label
    }

    public fun created_at(self: &SchemaRecord): u64 {
        self.created_at
    }

    public fun tx_hash(self: &SchemaRecord): vector<u8> {
        self.tx_hash
    }

    public fun incrementing_id(self: &SchemaRecord): u64 {
        self.incrementing_id
    }

    public fun creator(self: &SchemaRecord): address {
        self.creator
    }

    public fun revokable(self: &SchemaRecord): bool {
        self.revokable
    }

    public fun addy(self: &SchemaRecord): address {
        self.id.to_address()
    }

    public fun config<Rule: drop, Config: store>(
        self: &SchemaRecord
    ): &Config {
        self.resolver.borrow().config.borrow(type_name::get<Rule>())
    }

    public fun has_resolver(self: &SchemaRecord): bool {
        option::is_some(&self.resolver)
    }

    public fun schema_address_from_request(request: &Request): address {
        request.schema_address
    }

    public fun name(request: &Request): String {
        request.name
    }

    public fun approvals(request: &Request): VecSet<TypeName> {
        request.approvals
    }

    public fun schema_address_from_builder(builder: &ResolverBuilder): address {
        builder.schema_address
    }
  
    public fun rules(builder: &ResolverBuilder): &VecMap<String, VecSet<TypeName>> {
        &builder.rules
    }

    public fun config_from_builder(builder: &ResolverBuilder): &Bag {
        &builder.config
    }

    // === Public Functions ===
    public fun new(
        schema_registry: &mut SchemaRegistry, 
        schema: vector<u8>, 
        label: String,
        revokable: bool,
        ctx: &mut TxContext
        ): Admin {
        let schema_record = SchemaRecord {
            id: object::new(ctx),
            incrementing_id: schema_registry.size() + 1,
            attestation_cnt: 0,
            label: label,
            creator: ctx.sender(),
            created_at: ctx.epoch_timestamp_ms(),
            tx_hash: *ctx.digest(),
            schema: schema,
            revokable: revokable,
            resolver: option::none()
        };

        schema_registry.registry(schema_record.addy(), ctx);
        emit(
            SchemaCreated {
                event_type: 0,
                incrementing_id: schema_record.incrementing_id,
                label: schema_record.label,
                schema_address: schema_record.addy(),
                creator: schema_record.creator,
                created_at: schema_record.created_at,
                tx_hash: schema_record.tx_hash,
                schema: schema_record.schema,
                revokable: schema_record.revokable
            }
        );

        let admin_cap = admin::new(schema_record.addy(), ctx);
        transfer::share_object(schema_record);

        admin_cap
    }

    public fun new_with_resolver(
        schema_registry: &mut SchemaRegistry,
        schema: vector<u8>,
        label: String,
        revokable: bool,
        ctx: &mut TxContext,
    ): (ResolverBuilder, Admin) {
        let schema_record = SchemaRecord {
            id: object::new(ctx),
            incrementing_id: schema_registry.size() + 1,
            attestation_cnt: 0,
            label: label,
            creator: ctx.sender(),
            created_at: ctx.epoch_timestamp_ms(),
            tx_hash: *ctx.digest(),
            schema: schema,
            revokable: revokable,
            resolver: option::none()
        };

        schema_registry.registry(schema_record.addy(), ctx);
        emit(
            SchemaCreated {
                event_type: 1,
                incrementing_id: schema_record.incrementing_id,
                label: schema_record.label,
                schema_address: schema_record.addy(),
                creator: schema_record.creator,
                created_at: schema_record.created_at,
                tx_hash: schema_record.tx_hash,
                schema: schema_record.schema,
                revokable: schema_record.revokable
            }
        );
        
        let admin_cap = admin::new(schema_record.addy(), ctx);
        let resolver_builder = new_resolver_builder(&admin_cap, &schema_record, ctx);
        
        transfer::share_object(schema_record);
        
        (
            resolver_builder,
            admin_cap
        )
    }

    public fun add_resolver(
        schema_record: &mut SchemaRecord,
        resolver_builder: ResolverBuilder
    ) {
        let ResolverBuilder { rules, config, schema_address } = resolver_builder;
        assert!(object::id_address(schema_record) == schema_address, EWrongSchemaAddress);
        schema_record.resolver.fill(Resolver {
            rules: rules,
            config: config
        });
    }

    public fun new_request(self: &SchemaRecord, name: String): Request {
        Request {
            name: name,
            schema_address: object::id_address(self),
            approvals: vec_set::empty()
        }
    }

    // === Admin Functions ===
    public fun new_resolver_builder(
        admin: &Admin,
        schema_record: &SchemaRecord,
        ctx: &mut TxContext
    ): ResolverBuilder {
        admin.assert_schema(schema_record.addy());
        let mut rules = vec_map::empty();
        rules.insert(START_ATTEST.to_string(), vec_set::empty());

        ResolverBuilder {
            schema_address: schema_record.addy(),
            rules: rules,
            config: bag::new(ctx)
        }
    }

    // === Public-Package Functions ===
    public(package) fun update_attestation_cnt(self: &mut SchemaRecord) {
        self.attestation_cnt = self.attestation_cnt + 1;
    }

    // === Private Functions ===
    fun confirm(self: &SchemaRecord, request: Request) {
        let resolver = self.resolver.borrow();
        let Request { name, schema_address, approvals } = request;

        assert!(object::id_address(self) == schema_address, EWrongSchemaAddress);

        let rules = (*resolver.rules.get(&name)).into_keys();

        let rules_len = rules.length();
        let mut i = 0;

        while (rules_len > i) {
            let rule = &rules[i];
            assert!(approvals.contains(rule), ERuleNotApproved);
            i = i + 1;
        }
    }

    // === Witness Functions ===
    public fun add_rule<Rule: drop>(
        resolver_builder: &mut ResolverBuilder,
        name: String,
        _: Rule
    ) {
        resolver_builder.rules.get_mut(&name).insert(type_name::get<Rule>());
    }

    public fun add_rule_config<Rule: drop, Config: store>(
        resolver_builder: &mut ResolverBuilder,
        _: Rule,
        config: Config
    ) {
        resolver_builder.config.add(type_name::get<Rule>(), config);
    }

    public fun config_mut<Rule: drop, Config: store>(
        self: &mut SchemaRecord
    ): &mut Config {
        self.resolver.borrow_mut().config.borrow_mut(type_name::get<Rule>())
    }

    public fun approve<Rule: drop>(
        request: &mut Request,
        _: Rule
    ) {
        request.approvals.insert(type_name::get<Rule>());
    }
}