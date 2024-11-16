use anchor_lang::prelude::*;

mod errors;
mod events;
mod instructions;
mod state;

pub use instructions::*;

#[cfg(not(feature = "no-entrypoint"))]
solana_security_txt::security_txt! {
    name: "attest-protocol",
    project_url: "attest.so",
    contacts: "email:security@attestprotocol.org",
    policy: "https://github.com/daccred/attest.so/blob/main/SECURITY.md",
    source_code: "https://github.com/daccred/attest.so"
}

declare_id!("9nxf8wETZeSH3YXmfy6ZWrVmQMYbY7e4FhTSGR4WpVw3");

#[program]
pub mod authority_resolver {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize_handler(ctx)
    }

    pub fn register_authority(ctx: Context<RegisterAuthority>) -> Result<()> {
        register_authority_handler(ctx)
    }

    pub fn verify_authority(ctx: Context<VerifyAuthority>, is_verified: bool) -> Result<()> {
        verify_authority_handler(ctx, is_verified)
    }

    // #[access_control(verify_admin(&ctx.accounts))]
    // pub fn perform_admin_action(ctx: Context<AdminAction>) -> Result<()> {
    //     // Admin-only action logic
    //      verify_authority(ctx, true)
    //     msg!("Admin action performed!");
    //     Ok(())
    // }

    // fn verify_admin(accounts: &AdminAction) -> Result<()> {
    //     require!(accounts.admin.key() == accounts.admin_account.admin, ErrorCode::Unauthorized);
    //     Ok(())
    // }
}
