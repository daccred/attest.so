use soroban_sdk::{contracttype, Address, Bytes, BytesN, String as SorobanString};

/// Represents the keys used for data storage in the contract.
/// Each variant corresponds to a different type of data that can be stored.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Key for storing the contract admin address
    Admin,
    /// Key for storing authority information, indexed by the authority's address
    Authority(Address),
    /// Key for storing schema information, indexed by the schema's unique identifier
    Schema(BytesN<32>),
    /// Key for storing attestation data, indexed by schema UID, recipient address, and optional reference
    Attestation(BytesN<32>, Address, Option<SorobanString>),
}

/// Represents an attestation stored in the contract.
/// Contains all the data related to a specific attestation.
#[contracttype]
#[derive(Clone)]
pub struct StoredAttestation {
    /// The unique identifier of the schema this attestation follows
    pub schema_uid: BytesN<32>,
    /// The address of the entity receiving the attestation
    pub recipient: Address,
    /// The address of the entity creating the attestation
    pub attester: Address,
    /// Timestamp when the attestation was created
    pub time: u64,
    /// Optional timestamp when the attestation expires
    pub expiration_time: Option<u64>,
    /// Optional timestamp when the attestation was revoked
    pub revocation_time: Option<u64>,
    /// Whether this attestation can be revoked by the attester
    pub revocable: bool,
    /// Optional reference to another attestation this one relates to
    pub ref_uid: Option<Bytes>,
    /// The actual attestation data, typically serialized according to the schema
    pub data: Bytes,
    /// Optional numeric value associated with the attestation
    pub value: Option<i128>,
}

/// Represents an authority that can create schemas and attestations.
/// Authorities are registered entities with specific permissions in the system.
#[derive(Debug, Clone)]
#[contracttype]
pub struct Authority {
    /// The Stellar address of the authority
    pub address: Address,
    /// Metadata describing the authority, typically in JSON format
    pub metadata: SorobanString,
}

/// Represents a schema definition that attestations can follow.
/// Schemas define the structure and rules for attestations.
#[contracttype]
#[derive(Clone)]
pub struct Schema {
    /// The address of the authority that created this schema
    pub authority: Address,
    /// The schema definition, typically in JSON format
    pub definition: SorobanString,
    /// Optional address of a resolver contract for this schema
    pub resolver: Option<Address>,
    /// Whether attestations using this schema can be revoked
    pub revocable: bool,
}

/// Represents a record of an attestation with simplified fields.
/// Used for tracking attestations in a more compact form.
#[derive(Clone)]
#[contracttype]
pub struct AttestationRecord {
    /// The unique identifier of the schema this attestation follows
    pub schema_uid: BytesN<32>,
    /// The address of the entity that is the subject of this attestation
    pub subject: Address,
    /// The value or content of the attestation
    pub value: SorobanString,
    /// Optional reference string to distinguish between multiple attestations
    pub reference: Option<SorobanString>,
    /// Whether this attestation has been revoked
    pub revoked: bool,
} 