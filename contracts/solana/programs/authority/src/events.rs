use anchor_lang::prelude::*;

#[event]
pub struct VerifiedAuthoritySignal {
    pub authority: Pubkey,
    pub is_verified: bool,
}

#[event]
pub struct NewAuthoritySignal {
    pub authority: Pubkey,
    pub is_verified: bool,
    pub first_deployment: i64,
}
