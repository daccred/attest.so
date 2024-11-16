use anchor_lang::prelude::*;

#[account]
pub struct AuthorityRecord {
    pub authority: Pubkey,     // The public key of the authority (e.g., user).
    pub is_verified: bool,     // Flag to check if the authority is verified by an admin.
    pub first_deployment: i64, // Timestamp of their first schema deployment.
}

impl AuthorityRecord {
    pub const LEN: usize = 8 + 32 + 1 + 8; // Account discriminator + field sizes
}
