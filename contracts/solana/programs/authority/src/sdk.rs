use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;

#[account]
pub struct AuthorityRecord {
    pub authority: Pubkey,     // The public key of the authority (e.g., user).
    pub is_verified: bool,     // Flag to check if the authority is verified by an admin.
    pub first_deployment: i64, // Timestamp of their first schema deployment.
}

impl AuthorityRecord {
    pub const LEN: usize = 8 + 32 + 1 + 8; // Account discriminator + field sizes
}

#[event]
pub struct VerifiedAuthoritySignal {
    authority: Pubkey,
    is_verified: bool,
}

#[event]
pub struct NewAuthoritySignal {
    authority: Pubkey,
    is_verified: bool,
    first_deployment: i64,
}

#[error_code]
pub enum AuthorityError {
    #[msg("Unauthorized operation: Only admin can perform this action.")]
    Unauthorized,
}

#[derive(Accounts)]
#[instruction()]
pub struct RegisterAuthority<'info> {
    #[account(
        init,
        payer = authority,
        seeds = [b"authority", authority.key().as_ref()],
        bump,
        space = AuthorityRecord::LEN,
    )]
    pub authority_record: Account<'info, AuthorityRecord>,
    #[account(mut, signer)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyAuthority<'info> {
    #[account(mut)]
    pub authority_record: Account<'info, AuthorityRecord>,
    #[account(signer)]
    pub admin: Signer<'info>, // The admin account
}

/// Finds or registers a new authority.
pub fn register_authority(ctx: Context<RegisterAuthority>) -> Result<()> {
    let authority_record = &mut ctx.accounts.authority_record;

    if authority_record.authority == Pubkey::default() {
        authority_record.authority = *ctx.accounts.authority.key;
        authority_record.is_verified = false;
        authority_record.first_deployment = Clock::get()?.unix_timestamp;
    }

    // Return the AuthorityRecord struct itself
    emit!(NewAuthoritySignal {
        authority: authority_record.authority,
        is_verified: authority_record.is_verified,
        first_deployment: authority_record.first_deployment,
    });

    Ok(())
}

/// Verifies the authority (admin only).
pub fn verify_authority(ctx: Context<VerifyAuthority>, is_verified: bool) -> Result<()> {
    // let expected_admin_pubkey = Pubkey::from_str(ADMIN_PUBLIC_KEY).unwrap();

    // require_keys_eq!(expected_admin_pubkey, ctx.accounts.admin.key());

    // if ctx.accounts.admin.key() != expected_admin_pubkey {
    //     return Err(AuthorityError::Unauthorized.into());
    // }

    let authority_record = &mut ctx.accounts.authority_record;
    authority_record.is_verified = is_verified;

    emit!(VerifiedAuthoritySignal {
        authority: authority_record.authority,
        is_verified: authority_record.is_verified,
    });

    Ok(())
}
