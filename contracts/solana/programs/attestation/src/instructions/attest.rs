use crate::errors::AttestationError;
use crate::events::Attested;
use crate::state::Attestation;
use anchor_lang::prelude::*;
use schema_registry::program::SchemaRegistry;
use schema_registry::sdk::SchemaData;

/// Context for the `attest` instruction, which creates a new attestation.
///
/// Accounts:
/// - `attester`: The signer who is creating the attestation.
/// - `recipient`: The public key of the recipient of the attestation.
/// - `schema_data`: The schema data account associated with the attestation.
/// - `attestation`: The new attestation account to be created.
/// - `system_program`: The system program for account creation.
#[derive(Accounts)]
pub struct Attest<'info> {
    #[account(mut)]
    /// The attester who is creating the attestation.
    pub attester: Signer<'info>,

    /// CHECK: The recipient's public key; no data needed.
    pub recipient: UncheckedAccount<'info>,

    // #[account(
    //     constraint = schema_data.to_account_info().owner == &schema_registry_program_id @ AttestationError::InvalidSchema,
    // )]
    /// The schema data account; must match the schema UID.
    #[account(
        has_one = deployer,
        constraint = schema_data.to_account_info().owner == &schema_registry_program.key() @ AttestationError::InvalidSchema,
    )]
    pub schema_data: Account<'info, SchemaData>,

    /// CHECK: The deployer is only used for validation purposes, and no data is read or written to this account.
    pub deployer: UncheckedAccount<'info>,

    #[account(
        init,
        payer = attester,
        space = Attestation::LEN,
        seeds = [b"attestation", schema_data.key().as_ref(), recipient.key.as_ref(), attester.key.as_ref()],
        bump
    )]
    /// The attestation account to be created.
    pub attestation: Account<'info, Attestation>,

    /// The Schema Registry program account for CPI.
    pub schema_registry_program: Program<'info, SchemaRegistry>,

    pub system_program: Program<'info, System>,
}

/// Creates a new attestation and emits an `Attested` event.
///
/// This function initializes a new `Attestation` account associated with a schema,
/// recipient, and attester. It ensures that the schema exists and that the data
/// provided is within acceptable limits.
///
/// # Arguments
///
/// * `ctx` - The context containing the accounts required for creating the attestation.
/// * `data` - Custom data associated with the attestation.
/// * `ref_uid` - An optional reference UID to another attestation.
/// * `expiration_time` - An optional expiration timestamp for the attestation.
/// * `revocable` - A boolean indicating whether the attestation is revocable.
///
/// # Errors
///
/// * `AttestationError::DataTooLarge` - If the provided data exceeds `MAX_DATA_SIZE`.
/// * `AttestationError::InvalidExpirationTime` - If the expiration time is in the past.
/// * `AttestationError::InvalidSchema` - If the schema is invalid or not found.
///
/// # Implementation Details
///
/// - **Schema Validation**: Verifies that the provided schema exists and is valid.
/// - **Data Size Check**: Ensures that the `data` does not exceed `MAX_DATA_SIZE`.
/// - **Expiration Time Check**: Validates that the expiration time is in the future.
/// - **Attestation Initialization**: Populates the attestation account with provided data.
/// - **Event Emission**: Emits an `Attested` event for off-chain indexing.
///
/// # Why We Are Doing This
///
/// Attestations allow attesters to assert claims about recipients based on predefined schemas.
/// Emitting events facilitates off-chain indexing and enables clients to stay updated
/// with new attestations without polling the blockchain.
pub fn create_attestation_handler(
    ctx: Context<Attest>,
    data: String,
    ref_uid: Option<Pubkey>,
    expiration_time: Option<i64>,
    revocable: bool,
) -> Result<()> {
    let schema_data = &ctx.accounts.schema_data;
    let attestation = &mut ctx.accounts.attestation;
    let current_time = Clock::get()?.unix_timestamp;

    // Ensure data size is within limits
    if data.len() > Attestation::MAX_DATA_SIZE {
        return Err(AttestationError::DataTooLarge.into());
    }

    // Ensure expiration time is in the future, if provided
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

    // Emit an event to notify off-chain clients.
    emit!(Attested {
        schema: schema_data.uid,
        recipient: attestation.recipient,
        attester: attestation.attester,
        uid: attestation.uid,
        time: attestation.time,
    });

    Ok(())
}
