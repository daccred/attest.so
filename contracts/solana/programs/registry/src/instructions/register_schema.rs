use crate::errors::RegistryError;
use crate::events::RegisteredSchema;
use crate::state::SchemaData;
use crate::utils::derive_schema_pda;
use anchor_lang::prelude::*;

/// Pass schema_name as an instruction argument.
#[derive(Accounts)]
#[instruction(schema_name: String)]
pub struct RegisterSchema<'info> {
    #[account(mut)]
    /// Deployer who creates the schema.
    pub deployer: Signer<'info>,

    /// Schema data stored at the derived PDA.
    #[account(init_if_needed, seeds = [b"schema", deployer.key().as_ref(), schema_name.as_bytes()], bump, payer = deployer, space = SchemaData::LEN)]
    // #[account(
    //     init,
    //     payer = deployer,
    //     space = SchemaData::LEN,
    //     seeds = [b"schema", deployer.key().as_ref(), schema_name.as_bytes()],
    //     bump,
    //     owner = schema_registry_program_id  // Explicitly set the owner here to ensure it is managed by the registry program
    // )]
    pub schema_data: Account<'info, SchemaData>,
    pub system_program: Program<'info, System>,
}

/// Registers a new schema and emits an event with the UID (PDA) and full schema data.
///
/// This function creates a new schema by initializing the `SchemaData` account at the derived PDA.
/// It checks if a schema already exists at that PDA, and if not, it populates the schema data
/// and emits a `RegisteredSchema` event for off-chain indexing.
///
/// # Arguments
///
/// * `ctx` - The context containing the accounts required for registering the schema.
/// * `schema_name` - The name of the schema, used in PDA derivation.
/// * `schema` - The actual schema data (e.g., JSON schema as a string).
/// * `resolver` - An optional resolver address (another contract) for schema verification.
/// * `revocable` - A boolean indicating whether the schema is revocable.
///
/// # Returns
///
/// * `Result<()>` - Returns an empty Ok result on success.
///
/// # Errors
///
/// * `RegistryError::SchemaAlreadyExists` - If a schema already exists at the derived PDA.
///
/// # Implementation Details
///
/// - **PDA Derivation**: Uses the deployer's public key and schema name to derive a unique PDA.
/// - **Schema Existence Check**: Checks if the `deployer` field of the `SchemaData` account is not
///   the default `Pubkey`, indicating that the schema already exists.
/// - **Account Initialization**: Populates the `SchemaData` account with the provided schema information.
/// - **Event Emission**: Emits a `RegisteredSchema` event to notify off-chain clients of the new schema.
///
/// # Why We Are Doing This
///
/// Registering schemas allows users to define and store custom data structures that can be referenced
/// in attestations. Emitting events facilitates off-chain indexing and enables clients to stay updated
/// with new schemas without polling the blockchain.
pub fn register_schema_handler(
    ctx: Context<RegisterSchema>,
    schema_name: String,
    schema: String,
    resolver: Option<Pubkey>, // Optional resolver address for external verification.
    revocable: bool,
) -> Result<()> {
    let schema_data = &mut ctx.accounts.schema_data;

    // Check if the schema already exists by verifying if 'deployer' is set.
    if schema_data.deployer != Pubkey::default() {
        return Err(RegistryError::SchemaAlreadyExists.into());
    }

    // Derive the UID (PDA) for the schema.
    let (uid, _bump) = derive_schema_pda(ctx.accounts.deployer.key, schema_name, ctx.program_id);

    // Populate the schema data account.
    schema_data.uid = uid;
    schema_data.schema = schema;
    schema_data.resolver = resolver;
    schema_data.revocable = revocable;
    schema_data.deployer = *ctx.accounts.deployer.key;

    // Emit an event to notify off-chain clients.
    emit!(RegisteredSchema {
        uid,
        schema_data: SchemaData {
            uid: schema_data.uid,
            schema: schema_data.schema.clone(),
            resolver: schema_data.resolver,
            revocable: schema_data.revocable,
            deployer: schema_data.deployer,
        }
    });

    msg!("Registered schema with UID: {:?}", uid);

    Ok(())
}
