// attestation.rs

use anchor_lang::prelude::*;
use crate::registry::SchemaData;

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
    #[msg("Data too large.")]
    DataTooLarge,
}


#[event]
pub struct Attested {
    schema: Pubkey,
    recipient: Pubkey,
    attester: Pubkey,
    uid: Pubkey,
    time: i64,
}

#[event]
pub struct Revoked {
    schema: Pubkey,
    recipient: Pubkey,
    attester: Pubkey,
    uid: Pubkey,
    time: i64,
}


#[account]
pub struct Attestation {
    pub schema: Pubkey,         // 32 bytes
    pub recipient: Pubkey,      // 32 bytes
    pub attester: Pubkey,       // 32 bytes
    pub data: String,           // 4 bytes length prefix + data
    pub time: i64,              // 8 bytes
    pub ref_uid: Option<Pubkey>,        // 32 bytes (optional)
    pub expiration_time: Option<i64>,  // 1 byte option tag + 8 bytes
    pub revocation_time: Option<i64>,  // 1 byte option tag + 8 bytes
    pub revocable: bool,        // 1 byte
    pub uid: Pubkey,            // 32 bytes
}

impl Attestation {
    pub const MAX_DATA_SIZE: usize = 1000; // Adjust as needed
    pub const LEN: usize = 8  // Discriminator
        + 32  // schema UID Pubkey:PDA
        + 32  // recipient Pubkey
        + 32  // attester Pubkey
        + 4 + Self::MAX_DATA_SIZE  // data String (length prefix + data)
        + 8   // time i64
        + 32  // ref_uid Pubkey (optional) reference attestation
        + 1 + 8  // expiration_time Option<i64>
        + 1 + 8  // revocation_time Option<i64>
        + 1   // revocable bool
        + 32; // uid Pubkey:PDA
}

#[derive(Accounts)]
pub struct Attest<'info> {
    #[account(mut)]
    pub attester: Signer<'info>,
    /// CHECK: We only need the recipient's public key
    pub recipient: UncheckedAccount<'info>,
    pub schema: Account<'info, SchemaData>,
    #[account(
        init,
        payer = attester,
        space = Attestation::LEN,
        seeds = [b"attestation", schema.uid.as_ref(), recipient.key.as_ref(), attester.key.as_ref()],
        bump
    )]
    pub attestation: Account<'info, Attestation>,
    pub system_program: Program<'info, System>,
}

pub fn attest(
    ctx: Context<Attest>,
    data: String,
    ref_uid: Option<Pubkey>,
    expiration_time: Option<i64>,
    revocable: bool,
) -> Result<()> {
    let schema_data = &ctx.accounts.schema;
    let attestation = &mut ctx.accounts.attestation;
    let current_time = Clock::get()?.unix_timestamp;

    // Ensure data size is within limits
    if data.len() > Attestation::MAX_DATA_SIZE {
        return Err(AttestationError::DataTooLarge.into());
    }

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
    attestation.ref_uid = ref_uid;

    attestation.data = data;
    attestation.time = current_time;
    attestation.expiration_time = expiration_time;
    attestation.revocable = revocable;
    attestation.revocation_time = None;
    attestation.uid = attestation.key();

    emit!(Attested {
        schema: schema_data.uid,
        recipient: attestation.recipient,
        attester: attestation.attester,
        uid: attestation.uid,
        time: attestation.time,
    });

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

    emit!(Revoked {
        schema: attestation.schema,
        recipient: attestation.recipient,
        attester: attestation.attester,
        uid: attestation.uid,
        time: attestation.time,
    });

    // Set revocation time
    attestation.revocation_time = Some(Clock::get()?.unix_timestamp);

    Ok(())
}

