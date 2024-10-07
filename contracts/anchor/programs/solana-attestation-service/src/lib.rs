use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

declare_id!("G7CkEJNwiEZrBnwtJxGmmV6pw7tGcgYbCWJuSXYkERaQ");

pub mod authority;
pub mod registry;

use authority::*;
use registry::*;


#[program]
pub mod solana_attestation_service {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Program initialized with ID: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn register_authority(ctx: Context<RegisterAuthority>) -> Result<()> {
        authority::register_authority(ctx)
    }

    pub fn verify_authority(ctx: Context<VerifyAuthority>, is_verified: bool) -> Result<()> {
        authority::verify_authority(ctx, is_verified)
    }

    pub fn register_schema(
        ctx: Context<RegisterSchema>,
        schema: String,
        resolver: Option<Pubkey>,
        revocable: bool,
    ) -> Result<()> {
        registry::register_schema(ctx, schema, resolver, revocable)
    }
}
