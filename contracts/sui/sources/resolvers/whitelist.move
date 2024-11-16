/// Module: whitelist
module sas::whitelist {
    // === Imports ===
    use std::string;
    use sui::table::{Self, Table};
    use sas::admin::{Admin};
    use sas::schema::{Self, SchemaRecord, ResolverBuilder, Request};

    // === Errors ===
    const EInvalideSchemaAddress: u64 = 0;
    const ENotWhitelisted: u64 = 1;
    
    // === Structs ===
    public struct WhitelistResolver has drop {}

    public struct Whitelist has store {
      inner: Table<address, bool>
    }

    // === Method Aliases ===
    use fun string::utf8 as vector.utf8;

    // === Public-Mutative Functions ===
    public fun add(schema_record: &SchemaRecord, resolver_builder: &mut ResolverBuilder, ctx: &mut TxContext) {
        assert!(schema_record.addy() == resolver_builder.schema_address_from_builder(), EInvalideSchemaAddress);

        resolver_builder.add_rule(schema::start_attest_name().utf8(), WhitelistResolver {});
        resolver_builder.add_rule_config(WhitelistResolver {}, Whitelist { inner: table::new(ctx) });
    }

    public fun approve(schema_record: &SchemaRecord, request: &mut Request, ctx: &mut TxContext) {
        assert!(request.schema_address_from_request() == schema_record.addy(), EInvalideSchemaAddress);

        let whitelist = schema_record.config<WhitelistResolver, Whitelist>();

        assert!(whitelist.inner.contains(ctx.sender()), ENotWhitelisted);

        request.approve(WhitelistResolver {});
    }

    // === Public-View Functions ===
    public fun is_whitelisted(schema_record: &SchemaRecord, user: address): bool {
        schema_record.config<WhitelistResolver, Whitelist>().inner.contains(user)
    }

    // === Admin Functions ===
    public fun add_user(admin: &Admin, schema_record: &mut SchemaRecord, user: address) {
        admin.assert_schema(schema_record.addy());

        let whitelist = schema_record.config_mut<WhitelistResolver, Whitelist>();

        whitelist.inner.add(user, true);
    }

    public fun remove_user(admin: &Admin, schema_record: &mut SchemaRecord, user: address) {
        admin.assert_schema(schema_record.addy());

        let whitelist = schema_record.config_mut<WhitelistResolver, Whitelist>();

        whitelist.inner.remove(user);
    }
}