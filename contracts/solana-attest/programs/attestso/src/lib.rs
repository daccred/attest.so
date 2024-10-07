use anchor_lang::prelude::*;

declare_id!("4LT4wumb1FPdzpreAuuqkDsWfGsCJSnWK4WPTwZrcFFR");

pub mod authority;
pub mod registry;

// use authority::*;
use registry::*;


/// #[cfg(not(feature = "no-entrypoint"))]
/// solana_security_txt::security_txt! {
///     name: "attest-protocol",
///     project_url: "attest.so",
///     contacts: "email:security@attestprotocol.org",
///     policy: "https://github.com/daccred/attest.so/blob/main/SECURITY.md",
///     source_code: "https://github.com/daccred/attest.so"
/// }

#[program]
pub mod attestso {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Program initialized with ID: {:?}", ctx.program_id);
        Ok(())
    }

    // pub fn get_authority(ctx: Context<RegisterAuthority>) -> Result<Authority> {
    //     register_authority(ctx)
    // }

    // pub fn update_authority(ctx: Context<VerifyAuthority>, is_verified: bool) -> Result<()> {
    //     verify_authority(ctx, is_verified)
    // }

    pub fn register(
        ctx: Context<RegisterSchema>,
        schema: String,
        resolver: Option<Pubkey>,
        revocable: bool,
    ) -> Result<()> {
        register_schema(ctx, schema, resolver, revocable)
    }

    // #[access_control(verify_admin(&ctx.accounts))]
    // pub fn perform_admin_action(ctx: Context<AdminAction>) -> Result<()> {
    //     // Admin-only action logic
    //      verify_authority(ctx, true)
    //     msg!("Admin action performed!");
    //     Ok(())
    // }
}

#[derive(Accounts)]
pub struct Initialize {}


// fn verify_admin(accounts: &AdminAction) -> Result<()> {
//     require!(accounts.admin.key() == accounts.admin_account.admin, ErrorCode::Unauthorized);
//     Ok(())
// }
