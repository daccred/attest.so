use anchor_lang::prelude::*;
use crate::registry::SchemaData;
use crate::authority::AuthorityRecord;
use anchor_lang::solana_program::hash::hash;

#[error_code]
pub enum AttestationError {
    #[msg("Invalid Schema")]
    InvalidSchema,
    #[msg("Attestation not found.")]
    NotFound,
    #[msg("Attestation already revoked.")]
    AlreadyRevoked,
    #[msg("Schema is not revocable.")]
    Irrevocable,
    #[msg("Invalid expiration time.")]
    InvalidExpirationTime,
    #[msg("Insufficient Value.")]
    InsufficientValue,
}

#[account]
pub struct Attestation {
    pub schema: Pubkey,         // Schema the attestation belongs to
    pub recipient: Pubkey,      // The recipient of the attestation
    pub attester: Pubkey,       // The attester (the person issuing the attestation)
    pub data: String,           // Custom data related to the attestation
    pub time: i64,              // Time when attestation was created
    pub expiration_time: Option<i64>,  // Expiration time, if any
    pub revocation_time: Option<i64>,  // Time when it was revoked
    pub revocable: bool,        // Whether the attestation can be revoked
    pub uid: Pubkey,            // Unique ID of this attestation
}

impl Attestation {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 4 + 32 + 1 + 8 + 8 + 8;
}

// A helper struct for multi-attestations
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MultiAttestationData {
    pub schema: Pubkey,
    pub recipient: Pubkey,
    pub data: String,
    pub revocable: bool,
    pub expiration_time: Option<i64>,
}

#[derive(Accounts)]
pub struct Attest<'info> {
    #[account(mut)]
    pub attester: Signer<'info>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    pub schema: Account<'info, SchemaData>,
    #[account(
        init,
        payer = attester,
        space = 8 + Attestation::LEN,
        seeds = [b"attestation", schema.uid.as_ref(), recipient.key().as_ref(), attester.key().as_ref()],
        bump
    )]
    pub attestation: Account<'info, Attestation>,
    pub system_program: Program<'info, System>,
}

pub fn attest(ctx: Context<Attest>, data: String, expiration_time: Option<i64>, revocable: bool) -> Result<()> {
    let schema_data = &ctx.accounts.schema;
    let attestation = &mut ctx.accounts.attestation;
    let current_time = Clock::get()?.unix_timestamp;
    
    // Ensure expiration time is in the future
    if let Some(exp_time) = expiration_time {
        if exp_time <= current_time {
            return Err(AttestationError::InvalidExpirationTime.into());
        }
    }

    // Populate attestation fields
    attestation.schema = schema_data.uid;
    attestation.recipient = *ctx.accounts.recipient.key;
    attestation.attester = *ctx.accounts.attester.key;
    attestation.data = data;
    attestation.time = current_time;
    attestation.expiration_time = expiration_time;
    attestation.revocable = revocable;
    attestation.revocation_time = None;

    Ok(())
}

#[derive(Accounts)]
pub struct Revoke<'info> {
    #[account(mut)]
    pub attester: Signer<'info>,
    #[account(mut, has_one = attester, has_one = schema)]
    pub attestation: Account<'info, Attestation>,
    pub schema: Account<'info, SchemaData>,
}

pub fn revoke(ctx: Context<Revoke>) -> Result<()> {
    let attestation = &mut ctx.accounts.attestation;

    // Ensure the attestation is revocable
    if !attestation.revocable {
        return Err(AttestationError::Irrevocable.into());
    }

    // Ensure it hasn't already been revoked
    if attestation.revocation_time.is_some() {
        return Err(AttestationError::AlreadyRevoked.into());
    }

    // Set revocation time
    attestation.revocation_time = Some(Clock::get()?.unix_timestamp);

    Ok(())
}

// Multi-attestation (bulk) functionality
#[derive(Accounts)]
pub struct MultiAttest<'info> {
    #[account(mut)]
    pub attester: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn multi_attest(ctx: Context<MultiAttest>, attestations: Vec<MultiAttestationData>) -> Result<()> {
    for data in attestations.iter() {
        let schema_data = ctx.accounts.schema_data;

        let bump_seed = &[b"attestation", schema_data.uid.as_ref(), data.recipient.as_ref(), ctx.accounts.attester.key.as_ref()];
        let (attestation_pda, _) = Pubkey::find_program_address(bump_seed, ctx.program_id);

        let attestation = Account::<Attestation>::try_create(
            attestation_pda, ctx.accounts.attester.clone(), Attestation::LEN, 
            &ctx.accounts.system_program.key(), ctx.accounts.system_program.key()
        )?;

        attestation.schema = schema_data.uid;
        attestation.recipient = data.recipient;
        attestation.attester = *ctx.accounts.attester.key;
        attestation.data = data.data.clone();
        attestation.time = Clock::get()?.unix_timestamp;
        attestation.expiration_time = data.expiration_time;
        attestation.revocable = data.revocable;
        attestation.revocation_time = None;
    }
    Ok(())
}

#[derive(Accounts)]
pub struct GetAttestation<'info> {
    pub attestation: Account<'info, Attestation>,
}

pub fn get_attestation(ctx: Context<GetAttestation>) -> Result<Attestation> {
    let attestation = &ctx.accounts.attestation;
    Ok(attestation.clone())
}
