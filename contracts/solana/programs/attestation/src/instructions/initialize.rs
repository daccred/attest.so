use anchor_lang::prelude::*;

pub fn initialize_handler(ctx: Context<Initialize>) -> Result<()> {
    msg!("Program initialized with ID: {:?}", ctx.program_id);
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize {}
