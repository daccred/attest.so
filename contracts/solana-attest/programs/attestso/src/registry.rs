use anchor_lang::prelude::*;

#[event]
pub struct NewSchemaSignal {
    pub uid: Pubkey,             // The generated UID for the schema (PDA).
    pub schema_data: SchemaData, // Full schema data including schema, resolver, revocable, and deployer.
}

#[account]
pub struct SchemaData {
    pub uid: Pubkey,              // Generate PDA as reference key.
    pub schema: String,           // The actual schema data (e.g., JSON, XML, etc.).
    pub resolver: Option<Pubkey>, // Resolver address (another contract) for schema verification.
    pub revocable: bool,          // Indicates whether the schema is revocable.
    pub deployer: Pubkey,         // The deployer who created the schema.
}

#[error_code]
pub enum RegistryError {
    #[msg("Schema already exists.")]
    SchemaAlreadyExists,
}

#[derive(Accounts)]
#[instruction(schema_name: String)] // Pass schema_name as an instruction argument.
pub struct RegisterSchema<'info> {
    #[account(mut)]
    pub deployer: Signer<'info>, // Deployer who creates the schema.

    #[account(init_if_needed, seeds = [b"schema", deployer.key().as_ref(), schema_name.as_bytes()], bump, payer = deployer, space = SchemaData::LEN)]
    pub schema_data: Account<'info, SchemaData>, // Schema data stored at the derived PDA.
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetSchema<'info> {
    pub schema_data: Account<'info, SchemaData>, // Schema data retrieved via UID.
}

impl SchemaData {
    pub const LEN: usize = 8 + 32 + 1 + 200 + 32;
}

// Register a new schema and emit an event with the UID (PDA) and full schema data.
pub fn register_schema(
    ctx: Context<RegisterSchema>,
    schema_name: String,
    schema: String,
    resolver: Option<Pubkey>, // Optional resolver address for external verification.
    revocable: bool,
) -> Result<Pubkey> {
    let schema_data = &mut ctx.accounts.schema_data;

    if schema_data.deployer != Pubkey::default() {
        return Err(RegistryError::SchemaAlreadyExists.into());
    }

 
    let (uid, _bump) = derive_schema_pda(ctx.accounts.deployer.key, schema_name, ctx.program_id);

    // Manual operation for schema resolution.
    // See if the schema already exists by attempting to fetch the PDA.
    // if schema_data
    //     .to_account_info()
    //     .try_borrow_data()
    //     .is_ok()
    // {
    //     return Err(RegistryError::SchemaAlreadyExists.into());
    // }

    //    if let Ok(_account) = ctx.accounts.schema_data.to_account_info().try_borrow_data() {
    //     return Err(RegistryError::SchemaAlreadyExists.into());
    // }

    schema_data.uid = uid;
    schema_data.schema = schema;
    schema_data.resolver = resolver;
    schema_data.revocable = revocable;
    schema_data.deployer = *ctx.accounts.deployer.key;
    emit!(NewSchemaSignal {
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

/// Fetch a schema using the UID and return SchemaData.
pub fn get_schema(ctx: Context<GetSchema>) -> Result<SchemaData> {
    let schema_data = &ctx.accounts.schema_data;

    // Return the full schema data.
    Ok(SchemaData {
        uid: schema_data.uid,
        schema: schema_data.schema.clone(),
        resolver: schema_data.resolver,
        revocable: schema_data.revocable,
        deployer: schema_data.deployer,
    })
}

// Helper function to derive the schema's PDA.
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
