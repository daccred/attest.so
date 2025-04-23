use soroban_sdk::{contracttype, Address, Bytes, BytesN, String};

/// ╔══════════════════════════════════════════════════════════════════════════╗
/// ║                                 DataKey                                   ║
/// ╚══════════════════════════════════════════════════════════════════════════╝
/// 
/// Represents the keys used for data storage in the contract.
/// 
/// Each variant corresponds to a different type of data that can be stored
/// in the contract's persistent storage.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Key for storing the contract admin address
    Admin,
    /// Key for storing authority information, indexed by the authority's address
    Authority(Address),
    /// Key for storing schema information, indexed by the schema's unique identifier
    Schema(BytesN<32>),
    /// Key for storing attestation data
    /// 
    /// Indexed by schema UID, recipient address, and optional reference string
    /// to allow for efficient lookups.
    Attestation(BytesN<32>, Address, Option<String>),
}

/// ╔══════════════════════════════════════════════════════════════════════════╗
/// ║                           StoredAttestation                               ║
/// ╚══════════════════════════════════════════════════════════════════════════╝
/// 
/// Represents an attestation stored in the contract.
/// 
/// Contains all the metadata and content related to a specific attestation,
/// including timestamps, participants, and the actual attestation data.
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
    /// 
    /// If set, the attestation is considered invalid after this time.
    pub expiration_time: Option<u64>,
    /// Optional timestamp when the attestation was revoked
    /// 
    /// If set, indicates this attestation has been explicitly invalidated.
    pub revocation_time: Option<u64>,
    /// Whether this attestation can be revoked by the attester
    pub revocable: bool,
    /// Optional reference to another attestation this one relates to
    pub ref_uid: Option<Bytes>,
    /// The actual attestation data
    /// 
    /// Typically serialized according to the schema definition.
    pub data: Bytes,
    /// Optional numeric value associated with the attestation
    pub value: Option<i128>,
}

/// ╔══════════════════════════════════════════════════════════════════════════╗
/// ║                               Authority                                   ║
/// ╚══════════════════════════════════════════════════════════════════════════╝
/// 
/// Represents an authority that can create schemas and attestations.
/// 
/// Authorities are registered entities with specific permissions in the system
/// that can create schemas and issue attestations.
#[derive(Debug, Clone)]
#[contracttype]
pub struct Authority {
    /// The Stellar address of the authority
    pub address: Address,
    /// Metadata describing the authority
    /// 
    /// Typically in JSON format, containing information about the authority.
    pub metadata: String,
}

/// ╔══════════════════════════════════════════════════════════════════════════╗
/// ║                                 Schema                                    ║
/// ╚══════════════════════════════════════════════════════════════════════════╝
/// 
/// Represents a schema definition that attestations can follow.
/// 
/// Schemas define the structure, validation rules, and behavior for attestations
/// that reference them.
#[contracttype]
#[derive(Clone)]
pub struct Schema {
    /// The address of the authority that created this schema
    pub authority: Address,
    /// The schema definition
    /// 
    /// Typically in JSON format, describing the structure and rules for attestations.
    pub definition: String,
    /// Optional address of a resolver contract for this schema
    /// 
    /// If present, this contract will be called to handle attestation operations.
    pub resolver: Option<Address>,
    /// Whether attestations using this schema can be revoked
    pub revocable: bool,
}

/// ╔══════════════════════════════════════════════════════════════════════════╗
/// ║                          AttestationRecord                                ║
/// ╚══════════════════════════════════════════════════════════════════════════╝
/// 
/// Represents a record of an attestation with simplified fields.
/// 
/// Used for tracking attestations in a more compact form and for returning
/// attestation information to callers.
#[derive(Clone)]
#[contracttype]
pub struct AttestationRecord {
    /// The unique identifier of the schema this attestation follows
    pub schema_uid: BytesN<32>,
    /// The address of the entity that is the subject of this attestation
    pub subject: Address,
    /// The value or content of the attestation
    pub value: String,
    /// Optional reference string to distinguish between multiple attestations
    /// 
    /// Allows for multiple attestations of the same schema for the same subject.
    pub reference: Option<String>,
    /// Whether this attestation has been revoked
    pub revoked: bool,
} 