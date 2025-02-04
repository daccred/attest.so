use anchor_lang::prelude::*;

#[account]
pub struct Attestation {
    /// Schema UID (PDA) associated with this attestation.
    pub schema: Pubkey, // 32 bytes
    /// The recipient of the attestation.
    pub recipient: Pubkey, // 32 bytes
    /// The attester who created the attestation.
    pub attester: Pubkey, // 32 bytes
    /// Custom data associated with the attestation.
    pub data: String, // 4 bytes length prefix + data
    /// Timestamp of when the attestation was created.
    pub time: u64, // 8 bytes
    /// Reference to another attestation UID, if any.
    pub ref_uid: Option<Pubkey>, // 1 byte option tag + 32 bytes
    /// Optional expiration time of the attestation.
    pub expiration_time: Option<u64>, // 1 byte option tag + 8 bytes
    /// Timestamp of when the attestation was revoked, if revoked.
    pub revocation_time: Option<u64>, // 1 byte option tag + 8 bytes
    /// Indicates whether the attestation is revocable.
    pub revocable: bool, // 1 byte
    /// Unique identifier (PDA) of this attestation.
    pub uid: Pubkey, // 32 bytes
}

impl Attestation {
    pub const MAX_DATA_SIZE: usize = 1000; // Adjust as needed
    pub const LEN: usize = 8  // Discriminator
        + 32  // schema UID Pubkey:PDA
        + 32  // recipient Pubkey
        + 32  // attester Pubkey
        + 4 + Self::MAX_DATA_SIZE  // data String (length prefix + data)
        + 8   // time i64
        + 1 + 32  // ref_uid Option<Pubkey>
        + 1 + 8   // expiration_time Option<i64>
        + 1 + 8   // revocation_time Option<i64>
        + 1   // revocable bool
        + 32; // uid Pubkey:PDA
}

#[account]
pub struct AttestationData {
    pub schema_uid: [u8; 32],
    pub recipient: Pubkey,
    pub data: String,
    pub ref_uid: Option<Pubkey>,
    pub expiration_time: Option<u64>,
    pub revocable: bool,
    pub nonce: u64, // For uniqueness and replay protection
}

#[account]
pub struct AttesterInfo {
    pub message: Vec<u8>,
    pub pubkey: [u8; 32],
    pub signature: [u8; 64],
}

#[account]
pub struct AuthorityRecord {
    pub authority: Pubkey,     // The public key of the authority (e.g., user).
    pub is_verified: bool,     // Flag to check if the authority is verified by an admin.
    pub first_deployment: i64, // Timestamp of their first schema deployment.
}

impl AuthorityRecord {
    pub const LEN: usize = 8 + 32 + 1 + 8; // Account discriminator + field sizes
}

#[account]
pub struct SchemaData {
    /// Generate PDA as reference key.
    pub uid: Pubkey,

    /// The actual schema data (e.g., JSON, XML, etc.).
    pub schema: String,

    /// Resolver address (another contract) for schema verification.
    pub resolver: Option<Pubkey>,

    /// Indicates whether the schema is revocable.
    pub revocable: bool,

    /// The deployer/authority who created the schema.
    pub deployer: Pubkey,

    pub levy: Option<Levy>,
}

impl SchemaData {
    // 8 bytes for account discriminator,
    // 32 bytes for uid,
    // 1 byte for revocable,
    // 200 bytes for schema string,
    // 32 bytes for deployer pubkey.
    pub const LEN: usize = 8 + 32 + 1 + 200 + 32;
}

#[account]
#[derive(InitSpace)]
pub struct Levy {
    /// 8 bytes
    pub amount: u64,

    /// 32 bytes (Asset address)
    pub asset: Option<Pubkey>,

    /// 32 bytes (Recipient of the levy)
    pub recipient: Pubkey,
}
