use anchor_lang::prelude::*;

declare_id!("3zqb9TDPZXQW3EWWokmrZtW7ic13caVmKZsQq3PK66Gm");

pub mod attestation;
pub mod authority;
pub mod registry;

use attestation::*;
use authority::*;
use registry::*;

#[cfg(not(feature = "no-entrypoint"))]
solana_security_txt::security_txt! {
    name: "attest-protocol",
    project_url: "attest.so",
    contacts: "email:security@attestprotocol.org",
    policy: "https://github.com/daccred/attest.so/blob/main/SECURITY.md",
    source_code: "https://github.com/daccred/attest.so"
}

#[program]
pub mod attestso {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Program initialized with ID: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn find_or_set_authority(ctx: Context<RegisterAuthority>) -> Result<()> {
        register_authority(ctx)
    }

    pub fn update_authority(ctx: Context<VerifyAuthority>, is_verified: bool) -> Result<()> {
        verify_authority(ctx, is_verified)
    }

    pub fn register(
        ctx: Context<RegisterSchema>,
        schema_name: String,
        schema: String,
        resolver: Option<Pubkey>, // Optional resolver address for external verification.
        revocable: bool,
    ) -> Result<()> {
        let uid = register_schema(ctx, schema_name, schema, resolver, revocable);
        msg!("Registered schema with UID: {:?}", uid);

        Ok(())
    }

    // Register a new attestation
    pub fn create_attestation(
        ctx: Context<Attest>,
        data: String,
        ref_uid: Option<Pubkey>,
        expiration_time: Option<i64>,
        revocable: bool,
    ) -> Result<()> {
        attest(ctx, data, ref_uid, expiration_time, revocable)
    }

    pub fn revoke_attestation(
        ctx: Context<Revoke>,
        schema_uid: Pubkey,
        recipient: Pubkey,
    ) -> Result<()> {
        revoke(ctx, schema_uid, recipient)
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

#[derive(Accounts)]
pub struct Initialize {}
