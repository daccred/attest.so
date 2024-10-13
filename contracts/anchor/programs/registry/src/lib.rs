use anchor_lang::prelude::*;

declare_id!("7yyVeiJbSJT6mot6FLqNufBc8ycEqp9S2R3FAJhgJwtj");

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
