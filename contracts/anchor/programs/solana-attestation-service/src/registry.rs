// Import the authority module.
pub mod authority;

use anchor_lang::prelude::*;
use authority::{Authority, RegisterAuthority, VerifyAuthority};

// Define the `SchemaRecord` struct with its fields.
#[account]
pub struct SchemaRecord {
    pub uid: Pubkey,           // Unique identifier for the schema.
    pub schema: String,        // The schema string (JSON, XML, etc.).
    pub resolver: Pubkey,      // Optional resolver address.
    pub revocable: bool,       // Flag indicating if the schema is revocable.
    pub authority: Pubkey,     // Authority who created the schema.
}

// Define errors for schema registry operations.
#[error_code]
pub enum RegistryError {
    #[msg("Schema already exists.")]
    SchemaAlreadyExists,

    #[msg("Unverified authority.")]
    UnverifiedAuthority,
}

// Instruction context to register a new schema.
#[derive(Accounts)]
pub struct RegisterSchema<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 32 + 1 + 32 + 200)]
    pub schema_record: Account<'info, SchemaRecord>,
    #[account(mut, has_one = authority)]
    pub authority_record: Account<'info, Authority>, // Reference to Authority.
    #[account(signer)]
    pub authority: Signer<'info>, // The authority registering the schema.
    pub system_program: Program<'info, System>,
}

// Instruction context to fetch a schema.
#[derive(Accounts)]
pub struct GetSchema<'info> {
    pub schema_record: Account<'info, SchemaRecord>,
}

// Implement registry instructions.
#[program]
pub mod registry {
    use super::*;

    // Register a new schema.
    pub fn register_schema(
        ctx: Context<RegisterSchema>,
        schema: String,
        resolver: Option<Pubkey>,
        revocable: bool,
    ) -> Result<()> {
        let authority_record = &ctx.accounts.authority_record;

        // Ensure the authority is verified.
        if !authority_record.is_verified {
            return Err(RegistryError::UnverifiedAuthority.into());
        }

        let schema_record = &mut ctx.accounts.schema_record;
        schema_record.schema = schema;
        schema_record.resolver = resolver.unwrap_or(Pubkey::default());
        schema_record.revocable = revocable;
        schema_record.authority = *ctx.accounts.authority.key;

        Ok(())
    }

    // Fetch a schema by its public key.
    pub fn get_schema(ctx: Context<GetSchema>) -> Result<()> {
        let schema_record = &ctx.accounts.schema_record;
        msg!("Schema: {}", schema_record.schema);
        Ok(())
    }
}
