use anchor_lang::prelude::*;

declare_id!("BX5fRierpB6rHNREARgupoB14pjdaeGYvkQkFreseKYh");

pub mod sdk;

use sdk::*;


#[cfg(not(feature = "no-entrypoint"))]
solana_security_txt::security_txt! {
    name: "attest-protocol-registry",
    project_url: "attest.so",
    contacts: "email:security@attestprotocol.org",
    policy: "https://github.com/daccred/attest.so/blob/main/SECURITY.md",
    source_code: "https://github.com/daccred/attest.so"
}

#[program]
pub mod schema_registry {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Program initialized with ID: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn register(
        ctx: Context<RegisterSchema>,
        schema_name: String,
        schema: String,
        resolver: Option<Pubkey>, // Optional resolver address for external verification.
        revocable: bool,
    ) -> Result<()> {
        let uid = register_schema(ctx, schema_name, schema, resolver, revocable);
        msg!("Registered schema with UID: {:?}", uid);

        Ok(())
    }


}

#[derive(Accounts)]
pub struct Initialize {}
