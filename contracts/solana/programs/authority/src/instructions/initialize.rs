use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize {}

pub fn initialize_handler(ctx: Context<Initialize>) -> Result<()> {
    msg!("Program initialized with ID: {:?}", ctx.program_id);
    Ok(())
}
