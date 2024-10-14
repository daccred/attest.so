use anchor_lang::prelude::*;

#[event]
pub struct RegisteredSchema {
    /// The generated UID for the schema (PDA).
    pub uid: Pubkey,
    /// Full schema data including schema, resolver, revocable, and deployer.
    pub schema_data: SchemaData,
}

#[account]
pub struct SchemaData {
    /// Generate PDA as reference key.
    pub uid: Pubkey,
    /// The actual schema data (e.g., JSON, XML, etc.).
    pub schema: String,
    /// Resolver address (another contract) for schema verification.
    pub resolver: Option<Pubkey>,
    /// Indicates whether the schema is revocable.
    pub revocable: bool,
    /// The deployer/authority who created the schema.
    pub deployer: Pubkey,
}

#[error_code]
pub enum RegistryError {
    #[msg("Schema already exists.")]
    SchemaAlreadyExists,
}

#[derive(Accounts)]
/// Pass schema_name as an instruction argument.
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

impl SchemaData {
    pub const LEN: usize = 8 + 32 + 1 + 200 + 32;
    // 8 bytes for account discriminator,
    // 32 bytes for uid,
    // 1 byte for revocable,
    // 200 bytes for schema string (adjust as needed),
    // 32 bytes for deployer pubkey.
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
/// * `Result<Pubkey>` - Returns the UID (PDA) of the registered schema on success.
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
pub fn register_schema(
    ctx: Context<RegisterSchema>,
    schema_name: String,
    schema: String,
    resolver: Option<Pubkey>, // Optional resolver address for external verification.
    revocable: bool,
) -> Result<Pubkey> {
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

    Ok(uid)
}

/// Derives the Program Derived Address (PDA) for a schema.
///
/// This function calculates the PDA for a schema based on the deployer's public key,
/// the schema name, and the program ID. This PDA is used as the unique identifier
/// (UID) for the schema and serves as the address where the schema data is stored.
///
/// # Arguments
///
/// * `deployer` - A reference to the public key of the deployer who creates the schema.
/// * `schema_name` - The name of the schema, used as a seed in the PDA derivation.
/// * `program_id` - A reference to the program ID of the schema registry program.
///
/// # Returns
///
/// A tuple containing:
/// * `Pubkey` - The derived PDA for the schema.
/// * `u8` - The bump seed associated with the PDA.
///
/// # Why We Are Doing This
///
/// Deriving a PDA ensures a unique and deterministic address for each schema based on the deployer
/// and schema name. This prevents collisions and allows anyone to derive the address of a schema
/// without querying the blockchain.
pub fn derive_schema_pda(
    deployer: &Pubkey,
    schema_name: String,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"schema", deployer.as_ref(), schema_name.as_bytes()],
        program_id,
    )
}
