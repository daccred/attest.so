use anchor_lang::prelude::*;

declare_id!("46haGKwana11HU7PF9vKJcMhcraSe48KRiTEJqLrSpBP");

pub mod sdk;

use sdk::*;

#[cfg(not(feature = "no-entrypoint"))]
solana_security_txt::security_txt! {
    name: "attest-protocol-registry",
    project_url: "https://attest.so",
    contacts: "email:security@attestprotocol.org",
    policy: "https://github.com/daccred/attest.so/blob/main/SECURITY.md",
    source_code: "https://github.com/daccred/attest.so"
}


#[program]
pub mod schema_registry {
    use super::*;


//     #[derive(Accounts)]
// pub struct ContextualInit {}

//     pub fn initialize(ctx: Context<ContextualInit>) -> Result<()> {
//         msg!("Program initialized with ID: {:?}", ctx.program_id);
//         Ok(())
//     }


    /// Registers a new schema in the registry.
    ///
    /// # Arguments
    ///
    /// * `ctx` - The context containing the accounts required for schema registration.
    /// * `schema_name` - The name of the schema, used in PDA derivation.
    /// * `schema` - The actual schema data (e.g., JSON schema as a string).
    /// * `resolver` - An optional resolver address for external verification.
    /// * `revocable` - A boolean indicating whether the schema is revocable.
    ///
    /// # Returns
    ///
    /// * `Result<()>` - Returns an empty Ok result on success.
    ///
    /// # Errors
    ///
    /// * May return errors from the `register_schema` function.
    ///
    /// # Implementation Details
    ///
    /// - Calls the `register_schema` function from the `sdk` module to perform the registration.
    /// - Logs the UID of the registered schema.
    ///
    /// # Why We Are Doing This
    ///
    /// Registering schemas allows users to define and store custom data structures
    /// that can be referenced in attestations. This function serves as the entry point
    /// for schema registration, delegating the actual logic to the `sdk` module.
    pub fn register(
        ctx: Context<RegisterSchema>,
        schema_name: String,
        schema: String,
        resolver: Option<Pubkey>, // Optional resolver address for external verification.
        revocable: bool,
    ) -> Result<()> {
        // Call the `register_schema` function from the `sdk` module.
        let uid = register_schema(ctx, schema_name, schema, resolver, revocable)?;
        msg!("Registered schema with UID: {:?}", uid);

        Ok(())
    }
}