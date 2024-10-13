use anchor_lang::prelude::*;

declare_id!("G5m5wFHHhTFYRRbrb9TwmuKf8sm8waPdpEi2qxZpht46");

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
