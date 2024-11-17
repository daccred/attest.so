use anchor_lang::prelude::*;

mod errors;
mod events;
mod instructions;
mod state;
mod utils;

pub use instructions::*;
pub use state::SchemaData;

#[cfg(not(feature = "no-entrypoint"))]
solana_security_txt::security_txt! {
    name: "attest-protocol-registry",
    project_url: "https://attest.so",
    contacts: "email:security@attestprotocol.org",
    policy: "https://github.com/daccred/attest.so/blob/main/SECURITY.md",
    source_code: "https://github.com/daccred/attest.so"
}

declare_id!("25vw5ngPz7UN2P1TUTiiJepi2xwquRdnrERtPoUsEymW");

#[program]
pub mod schema_registry {

    use super::*;

    pub fn register(
        ctx: Context<RegisterSchema>,
        schema_name: String,
        schema: String,
        resolver: Option<Pubkey>,
        revocable: bool,
    ) -> Result<()> {
        register_schema_handler(ctx, schema_name, schema, resolver, revocable)
    }
}
