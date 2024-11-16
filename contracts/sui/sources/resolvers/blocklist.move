/// Module: blocklist
module sas::blocklist {
    // === Imports ===
    use sui::table::{Self, Table};
    use std::string;
    use sas::admin::{Admin};
    use sas::schema::{Self, SchemaRecord, ResolverBuilder, Request};

    // === Errors ===
    const EInvalideSchemaAddress: u64 = 0;
    const EBlocked: u64 = 1;

    // === Structs ===
    public struct BlocklistResolver has drop {}

    public struct Blocklist has store {
      inner: Table<address, bool>
    }

    // === Method Aliases ===
    use fun string::utf8 as vector.utf8;
    
    // === Public-Mutative Functions ===
    public fun add(schema_record: &SchemaRecord, resolver_builder: &mut ResolverBuilder, ctx: &mut TxContext) {
        assert!(schema_record.addy() == resolver_builder.schema_address_from_builder(), EInvalideSchemaAddress);

        resolver_builder.add_rule(schema::start_attest_name().utf8(), BlocklistResolver {});
        resolver_builder.add_rule_config(BlocklistResolver {}, Blocklist { inner: table::new(ctx) });
    }

    public fun approve(schema_record: &SchemaRecord, request: &mut Request, ctx: &mut TxContext) {
        assert!(request.schema_address_from_request() == schema_record.addy(), EInvalideSchemaAddress);

        let blocklist = schema_record.config<BlocklistResolver, Blocklist>();

        assert!(!blocklist.inner.contains(ctx.sender()), EBlocked);

        request.approve(BlocklistResolver {});
    }

    // === Public-View Functions ===
    public fun is_blocklisted(schema_record: &SchemaRecord, user: address): bool {
        schema_record.config<BlocklistResolver, Blocklist>().inner.contains(user)
    }

    // === Admin Functions ===
    public fun add_user(admin: &Admin, schema_record: &mut SchemaRecord, user: address) {
        admin.assert_schema(schema_record.addy());

        let blocklist = schema_record.config_mut<BlocklistResolver, Blocklist>();

        blocklist.inner.add(user, true);
    }

    public fun remove_user(admin: &Admin, schema_record: &mut SchemaRecord, user: address) {
        admin.assert_schema(schema_record.addy());

        let blocklist = schema_record.config_mut<BlocklistResolver, Blocklist>();

        blocklist.inner.remove(user);
    }

}