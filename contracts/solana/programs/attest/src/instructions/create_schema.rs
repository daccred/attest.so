use crate::errors::AttestError;
use crate::events::SchemaCreated;
use crate::state::{AuthorityRecord, Levy, SchemaData};
use anchor_lang::prelude::*;
// use authority_resolver::AuthorityRecord;

#[derive(Accounts)]
#[instruction(_schema_name: String)]
pub struct CreateSchema<'info> {
    #[account(mut)]
    /// Deployer who creates the schema.
    pub deployer: Signer<'info>,

    #[account(
        mut,
        constraint = deployer.key() == authority_record.authority.key() @ AttestError::Unauthorized,
    )]
    pub authority_record: Account<'info, AuthorityRecord>,

    /// Schema data stored at the derived PDA.
    #[account(
        init_if_needed,
        seeds = [b"schema", deployer.key().as_ref(), _schema_name.as_bytes()],
        bump,
        payer = deployer,
        space = SchemaData::LEN
    )]
    pub schema_data: Account<'info, SchemaData>,

    pub system_program: Program<'info, System>,
}

pub fn create_schema_handler(
    ctx: Context<CreateSchema>,
    _schema_name: String,
    schema: String,
    resolver: Option<Pubkey>, // Optional resolver address for external verification.
    revocable: bool,
    levy: Option<Levy>,
) -> Result<()> {
    let schema_data = &mut ctx.accounts.schema_data;

    // Check if the schema already exists by verifying if 'deployer' is set.
    if schema_data.deployer != Pubkey::default() {
        return Err(AttestError::SchemaAlreadyExists.into());
    }

    // use schema data account as uid
    let uid = schema_data.key();

    // Populate the schema data account.
    schema_data.uid = uid;
    schema_data.schema = schema;
    schema_data.resolver = resolver;
    schema_data.revocable = revocable;
    schema_data.levy = levy;
    schema_data.deployer = *ctx.accounts.deployer.key;

    // Emit an event to notify off-chain clients.
    emit!(SchemaCreated {
        uid,
        schema_data: SchemaData {
            uid: schema_data.uid,
            schema: schema_data.schema.clone(),
            resolver: schema_data.resolver,
            revocable: schema_data.revocable,
            deployer: schema_data.deployer,
            levy: schema_data.levy.clone()
        }
    });

    msg!("Schema created with UID: {:?}", uid);

    Ok(())
}
