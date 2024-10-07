use anchor_lang::prelude::*;
use crate::authority::*;

#[account]
pub struct SchemaRecord {
    pub uid: Pubkey,       // Unique identifier for the schema.
    pub deployer: Pubkey,  // Deployer who created the schema.
}

#[account]
pub struct SchemaData {
    pub schema: String,    // Schema data (e.g., JSON, XML, etc.)
    pub resolver: Pubkey,  // Resolver address for external verification
    pub revocable: bool,   // Indicates whether the schema is revocable
    pub deployer: Pubkey,  // The account that deployed (registered) the schema
}

#[error_code]
pub enum RegistryError {
    #[msg("Schema already exists.")]
    SchemaAlreadyExists,
}

#[derive(Accounts)]
pub struct RegisterSchema<'info> {
    #[account(init, payer = deployer, space = 8 + 32 + 32)]
    pub schema_record: Account<'info, SchemaRecord>,
    #[account(mut, has_one = deployer)]
    pub authority_record: Account<'info, AuthorityRecord>,
    #[account(mut, signer)]
    pub deployer: Signer<'info>, // The deployer registering the schema
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetSchema<'info> {
    pub schema_record: Account<'info, SchemaRecord>,
    #[account(mut)]
    pub deployer: Signer<'info>,
}

impl SchemaData {
    pub const LEN: usize = 8 + 32 + 1 + 200 + 32;
}

pub fn derive_schema_pda(uid: &Pubkey, program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"schema", uid.as_ref()], program_id)
}

pub fn register_schema(
    ctx: Context<RegisterSchema>,
    schema: String,
    resolver: Option<Pubkey>,
    revocable: bool,
) -> Result<()> {
    let deployer = &ctx.accounts.deployer;
    let schema_uid = Pubkey::new_unique();
    let schema_record = &mut ctx.accounts.schema_record;
    schema_record.uid = schema_uid;
    schema_record.deployer = *deployer.key;

    let (schema_pda, _bump) = derive_schema_pda(&schema_uid, ctx.program_id);

    let schema_data = SchemaData {
        schema,
        resolver,
        revocable,
        deployer: *deployer.key,
    };

    anchor_lang::solana_program::program::invoke(
        &anchor_lang::solana_program::system_instruction::create_account(
            &deployer.key,
            &schema_pda,
            Rent::get()?.minimum_balance(SchemaData::LEN),
            SchemaData::LEN as u64,
            ctx.program_id,
        ),
        &[
            ctx.accounts.deployer.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    let mut data = &mut schema_pda.try_borrow_mut_data()?;
    schema_data.serialize(&mut data)?;

    Ok(())
}

pub fn get_schema(ctx: Context<GetSchema>, uid: Pubkey) -> Result<()> {
    let (schema_pda, _bump) = derive_schema_pda(&uid, ctx.program_id);
    let schema_data: Account<SchemaData> = Account::try_from(&schema_pda)?;

    msg!("Schema: {}", schema_data.schema);
    msg!("Resolver: {}", schema_data.resolver);
    msg!("Revocable: {}", schema_data.revocable);
    msg!("Deployer: {}", schema_data.deployer);

    Ok(())
}
