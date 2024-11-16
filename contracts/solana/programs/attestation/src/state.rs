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
    pub time: i64, // 8 bytes
    /// Reference to another attestation UID, if any.
    pub ref_uid: Option<Pubkey>, // 1 byte option tag + 32 bytes
    /// Optional expiration time of the attestation.
    pub expiration_time: Option<i64>, // 1 byte option tag + 8 bytes
    /// Timestamp of when the attestation was revoked, if revoked.
    pub revocation_time: Option<i64>, // 1 byte option tag + 8 bytes
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
