use anchor_lang::prelude::*;

declare_id!("4LT4wumb1FPdzpreAuuqkDsWfGsCJSnWK4WPTwZrcFFR");

pub mod authority;
// pub mod registry;

use authority::*;
// use registry::*;


#[program]
pub mod attestso {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Program initialized with ID: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn new_authority(ctx: Context<RegisterAuthority>) -> Result<()> {
        register_authority(ctx)
    }

    pub fn update_authority(ctx: Context<VerifyAuthority>, is_verified: bool) -> Result<()> {
        verify_authority(ctx, is_verified)
    }

    // pub fn reg_schema(
    //     ctx: Context<RegisterSchema>,
    //     schema: String,
    //     resolver: Option<Pubkey>,
    //     revocable: bool,
    // ) -> Result<()> {
    //     register_schema(ctx, schema, resolver, revocable)
    // }
}

#[derive(Accounts)]
pub struct Initialize {}