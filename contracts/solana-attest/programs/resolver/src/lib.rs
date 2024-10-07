use anchor_lang::prelude::*;

declare_id!("Gqa1ajpLqHgvesQWA4UBasoZAzbJvLqpFWUgrmsohTYB");

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
