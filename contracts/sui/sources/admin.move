/// Module: admin
module sas::admin {
    // === Errors ===
    const EInvalideSchemaAddress: u64 = 0;

    public struct Admin has key, store {
        id: UID,
        schema: address,
    }

    // === Public-View Functions ===
    public fun addy(self: &Admin): address {
        self.id.to_address()
    }

    public fun schema(self: &Admin): address {
        self.schema
    }

    public fun assert_schema(self: &Admin, schema: address) {
        assert!(self.schema == schema, EInvalideSchemaAddress);
    }

    // === Admin Functions ===
    public fun destroy(admin: Admin) {
        let Admin { id, schema: _ } = admin;

        id.delete();
    }

    // === Public-Mutative Functions ===
    public fun new(schema: address, ctx: &mut TxContext): Admin {
        Admin {
            id: object::new(ctx),
            schema,
        }
    }

}