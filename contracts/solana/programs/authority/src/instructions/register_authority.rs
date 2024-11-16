use crate::events::NewAuthoritySignal;
use crate::state::AuthorityRecord;
use anchor_lang::prelude::*;

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

/// Finds or registers a new authority.
pub fn register_authority_handler(ctx: Context<RegisterAuthority>) -> Result<()> {
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
