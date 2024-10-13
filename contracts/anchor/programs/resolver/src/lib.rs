use anchor_lang::prelude::*;

declare_id!("3Po1Lint9qZ9bN4qVEdXTkTPUhDXMAYBxBPfDvn3YqCq");

#[program]
pub mod resolver {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
