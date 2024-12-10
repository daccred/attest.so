use anchor_lang::prelude::*;

mod consts;
mod errors;
mod events;
mod instructions;
mod state;
mod utils;

pub use instructions::*;

// #[cfg(not(test))]
declare_id!("4Ckr89AGNKazxN1GihavzVNedoZnkoYtaoeXDWzRTNDD");

#[cfg(not(feature = "no-entrypoint"))]
solana_security_txt::security_txt! {
    name: "attest-protocol",
    project_url: "attest.so",
    contacts: "email:security@attestprotocol.org",
    policy: "https://github.com/daccred/attest.so/blob/main/SECURITY.md",
    source_code: "https://github.com/daccred/attest.so"
}

#[program]
pub mod solana_attestation_service {

    use super::*;

    // Register a new attestation
    pub fn attest(
        ctx: Context<Attest>,
        data: String,
        ref_uid: Option<Pubkey>,
        expiration_time: Option<i64>,
        revocable: bool,
    ) -> Result<()> {
        attest_handler(ctx, data, ref_uid, expiration_time, revocable)
    }

    pub fn revoke_attestation(
        ctx: Context<Revoke>,
        schema_uid: Pubkey,
        recipient: Pubkey,
    ) -> Result<()> {
        revoke_attestation_handler(ctx, schema_uid, recipient)
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
