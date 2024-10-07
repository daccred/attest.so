use anchor_lang::prelude::*;

declare_id!("FZd5AYmqdBvBZhkLZuMonc7B7WhqvR8UoF2L4hHvqNTs");

#[program]
pub mod typescript {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
