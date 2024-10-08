use anchor_lang::prelude::*;

declare_id!("7STmbWkcgXdCidFB93c8snNN6Rm3YzmUnDDQtzGyHdoL");

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
