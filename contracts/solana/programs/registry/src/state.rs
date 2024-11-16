use anchor_lang::prelude::*;

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
}

impl SchemaData {
    // 8 bytes for account discriminator,
    // 32 bytes for uid,
    // 1 byte for revocable,
    // 200 bytes for schema string,
    // 32 bytes for deployer pubkey.
    pub const LEN: usize = 8 + 32 + 1 + 200 + 32;
}
