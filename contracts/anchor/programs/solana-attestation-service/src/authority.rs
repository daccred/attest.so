use anchor_lang::prelude::*;

// Define the `Authority` struct with its fields.
#[account]
pub struct Authority {
    pub account_address: Pubkey, // The public key of the authority (e.g., user).
    pub is_verified: bool,       // Flag to check if the authority is verified by an admin.
    pub first_deployment: i64,   // Timestamp of the first schema deployment.
}

// Define errors for authority operations.
#[error_code]
pub enum AuthorityError {
    #[msg("Unauthorized operation: Only admin can perform this action.")]
    Unauthorized,
}

// Instruction context to register a new authority.
#[derive(Accounts)]
pub struct RegisterAuthority<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 1 + 8)]
    pub authority_record: Account<'info, Authority>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Instruction context to verify the authority by an admin.
#[derive(Accounts)]
pub struct VerifyAuthority<'info> {
    #[account(mut, has_one = account_address)]
    pub authority_record: Account<'info, Authority>,
    #[account(signer)]
    pub admin: Signer<'info>, // The admin account
}

// Implement authority instructions.
#[program]
pub mod authority {
    use super::*;

    // Register a new authority.
    pub fn register_authority(ctx: Context<RegisterAuthority>) -> Result<()> {
        let authority_record = &mut ctx.accounts.authority_record;
        authority_record.account_address = *ctx.accounts.authority.key;
        authority_record.is_verified = false;
        authority_record.first_deployment = Clock::get()?.unix_timestamp;

        Ok(())
    }

    // Verify the authority (admin only).
    pub fn verify_authority(ctx: Context<VerifyAuthority>, is_verified: bool) -> Result<()> {
        let authority_record = &mut ctx.accounts.authority_record;

        if ctx.accounts.admin.key() != Pubkey::find_program_address(&[b"admin"], ctx.program_id).0 {
            return Err(AuthorityError::Unauthorized.into());
        }

        authority_record.is_verified = is_verified;
        Ok(())
    }
}
