use anchor_lang::prelude::*;

declare_id!("G7CkEJNwiEZrBnwtJxGmmV6pw7tGcgYbCWJuSXYkERaQ");

#[program]
pub mod solana_attestation_service {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
