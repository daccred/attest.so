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
    /// Indexed by schema UID, subject address, and nonce
    /// to allow for multiple unique attestations per schema/subject pair.
    Attestation(BytesN<32>, Address, u64),
    /// Key for storing the current nonce for an attester
    /// 
    /// Used to prevent replay attacks in delegated attestations
    AttesterNonce(Address),
    /// Key for storing a BLS public key
    /// 
    /// Indexed by the key itself for uniqueness
    BlsPublicKey(BytesN<96>),
    /// Key for mapping attester to their public keys
    /// 
    /// Maps attester address to list of their registered keys
    AttesterKeys(Address),
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
/// ║                      DelegatedAttestationRequest                          ║
/// ╚══════════════════════════════════════════════════════════════════════════╝
/// 
/// Represents a request for delegated attestation following the EAS pattern.
/// 
/// This allows an attester to sign an attestation off-chain, which can then be
/// submitted on-chain by any party (who will pay the transaction fees).
#[contracttype]
#[derive(Clone)]
pub struct DelegatedAttestationRequest {
    /// The unique identifier of the schema this attestation follows
    pub schema_uid: BytesN<32>,
    /// The address of the entity that is the subject of this attestation
    pub subject: Address,
    /// The address of the original attester (who signed off-chain)
    pub attester: Address,
    /// The value or content of the attestation
    pub value: String,
    /// The nonce for this attestation (must be the next expected nonce for the attester)
    pub nonce: u64,
    /// Expiration timestamp for this signed request
    /// 
    /// After this time, the signature is no longer valid and cannot be submitted.
    pub deadline: u64,
    /// Optional expiration time for the attestation itself
    pub expiration_time: Option<u64>,
    /// The BLS12-381 public key used to create the signature
    pub public_key: BytesN<96>,
    /// BLS12-381 G1 signature of the request data (96 bytes)
    pub signature: BytesN<96>,
}

/// ╔══════════════════════════════════════════════════════════════════════════╗
/// ║                      DelegatedRevocationRequest                           ║
/// ╚══════════════════════════════════════════════════════════════════════════╝
/// 
/// Represents a request for delegated revocation following the EAS pattern.
/// 
/// This allows an attester to sign a revocation off-chain, which can then be
/// submitted on-chain by any party.
#[contracttype]
#[derive(Clone)]
pub struct DelegatedRevocationRequest {
    /// The unique identifier of the schema
    pub schema_uid: BytesN<32>,
    /// The address of the entity that is the subject of the attestation to revoke
    pub subject: Address,
    /// The nonce of the attestation to revoke
    pub nonce: u64,
    /// The address of the original attester (who signed off-chain)
    pub revoker: Address,
    /// Expiration timestamp for this signed request
    pub deadline: u64,
    /// The BLS12-381 public key used to create the signature
    pub public_key: BytesN<96>,
    /// BLS12-381 G1 signature of the request data (96 bytes)
    pub signature: BytesN<96>,
}

/// ╔══════════════════════════════════════════════════════════════════════════╗
/// ║                            Attestation                                    ║
/// ╚══════════════════════════════════════════════════════════════════════════╝
/// 
/// Represents an attestation with support for both direct and delegated attestations.
/// 
/// Used for tracking attestations and supporting multiple attestations per schema/subject
/// pair through nonces, following the EAS pattern.
#[derive(Clone)]
#[contracttype]
pub struct Attestation {
    /// The unique identifier of the schema this attestation follows
    pub schema_uid: BytesN<32>,
    /// The address of the entity that is the subject of this attestation
    pub subject: Address,
    /// The address of the entity that created this attestation
    /// 
    /// In direct attestations, this is the caller.
    /// In delegated attestations, this is the original signer.
    pub attester: Address,
    /// The value or content of the attestation
    pub value: String,
    /// Unique nonce for this attestation
    /// 
    /// Allows for multiple attestations of the same schema for the same subject,
    /// and prevents replay attacks in delegated attestations.
    pub nonce: u64,
    /// Timestamp when the attestation was created
    pub timestamp: u64,
    /// Optional expiration timestamp
    /// 
    /// If set, the attestation is considered invalid after this time.
    pub expiration_time: Option<u64>,
    /// Whether this attestation has been revoked
    pub revoked: bool,
    /// Optional timestamp when the attestation was revoked
    pub revocation_time: Option<u64>,
}

/// ╔══════════════════════════════════════════════════════════════════════════╗
/// ║                          BLS Public Key Info                              ║
/// ╚══════════════════════════════════════════════════════════════════════════╝
/// 
/// Metadata about a registered BLS12-381 public key.
/// 
/// The key itself is used as the storage index for uniqueness.
#[contracttype]
#[derive(Clone)]
pub struct BlsPublicKeyInfo {
    /// The address of the attester who owns this key
    pub owner: Address,
    /// Timestamp when this key was registered
    pub registered_at: u64,
    /// Whether this key is currently active for signing
    pub is_active: bool,
}