module sas::attestation_registry {
    use sui::{
        table::{Self, Table},
        versioned::{Self, Versioned},
        vec_set::{Self, VecSet},
    };
    use sas::constants;
    use sas::admin::{Admin};
    use sas::schema::{SchemaRecord};

    // === Errors ===
    const EAttestationNotFound: u64 = 0;
    const EVersionNotEnabled: u64 = 1;
    const EAttestationAlreadyRevoked: u64 = 2;
    const ENotBelongToSchema: u64 = 3;
    const ENotRevokable: u64 = 4;

    // === OTW ===
    public struct ATTESTATION_REGISTRY has drop {}

    // === Structs ===
    public struct Status has copy, store {
        schema_address: address,
        is_revoked: bool,
        timestamp: u64,
    }

    public struct AttestationRegistry has key, store {
        id: UID,
        inner: Versioned,
    }

    public struct RegistryInner has store {
        allowed_versions: VecSet<u64>,
        /// attestation -> status
        attestations_status: Table<address, Status>,
    }

    // === Init Function ===
    fun init(_otw: ATTESTATION_REGISTRY, ctx: &mut TxContext) {
        let registry_inner = RegistryInner {
            allowed_versions: vec_set::singleton(constants::current_version()),
            attestations_status: table::new<address, Status>(ctx),
        };
        let attestation_registry = AttestationRegistry {
            id: object::new(ctx),
            inner: versioned::create(
                constants::current_version(),
                registry_inner,
                ctx,
            ),
        };

        transfer::share_object(attestation_registry);
    }

    // === Public-Mutative Functions ===
    public fun registry(self: &mut AttestationRegistry, attestation: address, schema_address: address) {
        let inner = self.load_inner_mut();
        assert!(!inner.attestations_status.contains(attestation), EAttestationNotFound);
        table::add(&mut inner.attestations_status, attestation, Status {
            is_revoked: false,
            timestamp: 0,
            schema_address,
        });
    }

    public fun revoke(
        admin: &Admin,
        self: &mut AttestationRegistry,
        schema_record: &mut SchemaRecord,
        attestation: address,
        ctx: &mut TxContext
    ) {
        admin.assert_schema(schema_record.addy());
        assert!(self.is_exist(attestation), EAttestationNotFound);

        let inner = self.load_inner_mut();
        assert!(inner.attestations_status.contains(attestation), EAttestationNotFound);
        
        let status = table::borrow_mut(&mut inner.attestations_status, attestation);
        assert!(!status.is_revoked, EAttestationAlreadyRevoked);
        assert!(status.schema_address == schema_record.addy(), ENotBelongToSchema);
        assert!(schema_record.revokable(), ENotRevokable);

        status.is_revoked = true;
        status.timestamp = ctx.epoch_timestamp_ms();
    }

    // === Public-Package Functions ===
    public(package) fun load_inner_mut(self: &mut AttestationRegistry): &mut RegistryInner {
        let inner: &mut RegistryInner = versioned::load_value_mut(&mut self.inner);
        let package_version = constants::current_version();
        assert!(
            inner.allowed_versions.contains(&package_version),
            EVersionNotEnabled,
        );
        inner
    }

    public(package) fun load_inner(self: &AttestationRegistry): &RegistryInner {
        let inner: &RegistryInner = versioned::load_value(&self.inner);
        let package_version = constants::current_version();
        assert!(
            inner.allowed_versions.contains(&package_version),
            EVersionNotEnabled,
        );
        inner
    }

    // === Public-View Functions ===
    public fun is_exist(self: &AttestationRegistry, attestation: address): bool {
        let self = self.load_inner();
        table::contains(&self.attestations_status, attestation)
    }
    
    public fun attestations(self: &AttestationRegistry): &Table<address, Status> {
        let self = self.load_inner();
        &self.attestations_status
    }

    public fun status(self: &AttestationRegistry, attestation: address): &Status {
        let self = self.load_inner();
        assert!(self.attestations_status.contains(attestation), EAttestationNotFound);
        table::borrow(&self.attestations_status, attestation)
    }

    public fun is_revoked(self: &AttestationRegistry, attestation: address): bool {
        let self = self.load_inner();
        assert!(self.attestations_status.contains(attestation), EAttestationNotFound);
        let status = table::borrow(&self.attestations_status, attestation);
        status.is_revoked
    }
 
    // === Test Functions ===
    #[test_only]
    public fun test_init(ctx: &mut TxContext) {
        init(ATTESTATION_REGISTRY {}, ctx);
    }

}