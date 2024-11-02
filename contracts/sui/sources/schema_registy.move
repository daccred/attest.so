module sas::schema_registry { 
    // === Imports ===
    use sui::{
        table::{Self, Table},
        versioned::{Self, Versioned},
        vec_set::{Self, VecSet},
    };
    use sas::constants;

    // === Errors ===
    const EVersionNotEnabled: u64 = 0;
    const ESchmaAlreadyExist: u64 = 1;

    // === OTW ===
    public struct SCHEMA_REGISTRY has drop {}

    // === Structs ===
    public struct SchemaRegistry has key, store {
        id: UID,
        inner: Versioned,
    }
    
    public struct RegistryInner has store {
        allowed_versions: VecSet<u64>,
        /// schema_record -> creator
        schema_records: Table<address, address>,
    }

    // === Init Function ===
    fun init(_otw: SCHEMA_REGISTRY, ctx: &mut TxContext) {
        let registry_inner = RegistryInner {
            allowed_versions: vec_set::singleton(constants::current_version()),
            schema_records: table::new<address, address>(ctx),
        };
        let schema_registry = SchemaRegistry {
            id: object::new(ctx),
            inner: versioned::create(
                constants::current_version(),
                registry_inner,
                ctx,
            ),
        };

        transfer::share_object(schema_registry);
    }

    // === Public-Mutative Functions ===
    public fun registry(
        self: &mut SchemaRegistry,
        schema_record: address,
        ctx: &mut TxContext
    ) {
        let inner = self.load_inner_mut();
        assert!(!inner.schema_records.contains(schema_record), ESchmaAlreadyExist);
        table::add(&mut inner.schema_records, schema_record, ctx.sender());
    }

    // === Public-Package Functions ===
    public(package) fun load_inner_mut(self: &mut SchemaRegistry): &mut RegistryInner {
        let inner: &mut RegistryInner = versioned::load_value_mut(&mut self.inner);
        let package_version = constants::current_version();
        assert!(
            inner.allowed_versions.contains(&package_version),
            EVersionNotEnabled,
        );
        inner
    }

    public(package) fun load_inner(self: &SchemaRegistry): &RegistryInner {
        let inner: &RegistryInner = versioned::load_value(&self.inner);
        let package_version = constants::current_version();
        assert!(
            inner.allowed_versions.contains(&package_version),
            EVersionNotEnabled,
        );
        inner
    }

    // === Public-View Functions ===
    public fun is_exist(self: &SchemaRegistry, schema_record: address): bool {
        let inner = self.load_inner();
        inner.schema_records.contains(schema_record)
    }
    
    public fun schemas(self: &SchemaRegistry): &Table<address, address> {
        let inner = self.load_inner();
        &inner.schema_records
    }

    public fun creator(self: &SchemaRegistry, schema_record: address): &address {
        let inner = self.load_inner();
        table::borrow<address, address>(&inner.schema_records, schema_record)
    }

    public fun size(self: &SchemaRegistry): u64 {
        let inner = self.load_inner();
        table::length(&inner.schema_records)
    }

    // === Test Functions ===
    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(SCHEMA_REGISTRY {}, ctx);
    }

}