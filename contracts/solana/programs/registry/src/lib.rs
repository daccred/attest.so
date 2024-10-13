use anchor_lang::prelude::*;

declare_id!("BX5fRierpB6rHNREARgupoB14pjdaeGYvkQkFreseKYh");

#[program]
pub mod schema_registry {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
