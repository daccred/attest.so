use anchor_lang::prelude::*;
use schema_registry::program::SchemaRegistry;
use schema_registry::sdk::SchemaData;
// use schema_registry::ID as schema_registry_program_id;

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
    /// Schema UID associated with the attestation.
    pub schema: Pubkey,
    /// The recipient of the attestation.
    pub recipient: Pubkey,
    /// The attester who created the attestation.
    pub attester: Pubkey,
    /// Unique identifier (PDA) of the attestation.
    pub uid: Pubkey,
    /// Timestamp of when the attestation was created.
    pub time: i64,
}

#[event]
pub struct Revoked {
    /// Schema UID associated with the attestation.
    pub schema: Pubkey,
    /// The recipient of the attestation.
    pub recipient: Pubkey,
    /// The attester who revoked the attestation.
    pub attester: Pubkey,
    /// Unique identifier (PDA) of the attestation.
    pub uid: Pubkey,
    /// Timestamp of when the attestation was revoked.
    pub time: i64,
}

#[account]
pub struct Attestation {
    /// Schema UID (PDA) associated with this attestation.
    pub schema: Pubkey, // 32 bytes
    /// The recipient of the attestation.
    pub recipient: Pubkey, // 32 bytes
    /// The attester who created the attestation.
    pub attester: Pubkey, // 32 bytes
    /// Custom data associated with the attestation.
    pub data: String, // 4 bytes length prefix + data
    /// Timestamp of when the attestation was created.
    pub time: i64, // 8 bytes
    /// Reference to another attestation UID, if any.
    pub ref_uid: Option<Pubkey>, // 1 byte option tag + 32 bytes
    /// Optional expiration time of the attestation.
    pub expiration_time: Option<i64>, // 1 byte option tag + 8 bytes
    /// Timestamp of when the attestation was revoked, if revoked.
    pub revocation_time: Option<i64>, // 1 byte option tag + 8 bytes
    /// Indicates whether the attestation is revocable.
    pub revocable: bool, // 1 byte
    /// Unique identifier (PDA) of this attestation.
    pub uid: Pubkey, // 32 bytes
}

impl Attestation {
    pub const MAX_DATA_SIZE: usize = 1000; // Adjust as needed
    pub const LEN: usize = 8  // Discriminator
        + 32  // schema UID Pubkey:PDA
        + 32  // recipient Pubkey
        + 32  // attester Pubkey
        + 4 + Self::MAX_DATA_SIZE  // data String (length prefix + data)
        + 8   // time i64
        + 1 + 32  // ref_uid Option<Pubkey>
        + 1 + 8   // expiration_time Option<i64>
        + 1 + 8   // revocation_time Option<i64>
        + 1   // revocable bool
        + 32; // uid Pubkey:PDA
}

#[derive(Accounts)]
/// Context for the `attest` instruction, which creates a new attestation.
///
/// Accounts:
/// - `attester`: The signer who is creating the attestation.
/// - `recipient`: The public key of the recipient of the attestation.
/// - `schema_data`: The schema data account associated with the attestation.
/// - `attestation`: The new attestation account to be created.
/// - `system_program`: The system program for account creation.
pub struct Attest<'info> {
    #[account(mut)]
    /// The attester who is creating the attestation.
    pub attester: Signer<'info>,
    /// CHECK: The recipient's public key; no data needed.
    pub recipient: UncheckedAccount<'info>,

    // #[account(
    //     constraint = schema_data.to_account_info().owner == &schema_registry_program_id @ AttestationError::InvalidSchema,
    // )]
    #[account(
        has_one = deployer,
        constraint = schema_data.to_account_info().owner == &schema_registry_program.key() @ AttestationError::InvalidSchema,
    )]
    /// The schema data account; must match the schema UID.
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
pub fn attest(
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
#[derive(Accounts)]
/// Context for the `revoke` instruction, which revokes an existing attestation.
///
/// Accounts:
/// - `attester`: The signer who is revoking the attestation.
/// - `attestation`: The attestation account to be revoked.
/// - `schema`: The schema data account associated with the attestation.
#[instruction(schema_uid: Pubkey, recipient: Pubkey)]
pub struct Revoke<'info> {
    #[account(mut)]
    /// The attester who is revoking the attestation.
    pub attester: Signer<'info>,
    #[account(
        mut,
        seeds = [b"attestation", schema_uid.as_ref(), recipient.as_ref(), attester.key.as_ref()],
        bump,
        has_one = attester,
        constraint = attestation.schema == schema_uid @ AttestationError::InvalidSchema,
    )]
    /// The attestation account to be revoked.
    pub attestation: Account<'info, Attestation>,
}

/// Revokes an existing attestation and emits a `Revoked` event.
///
/// This function marks an attestation as revoked by setting its `revocation_time`.
/// It ensures that the attestation is revocable and has not already been revoked.
///
/// # Arguments
///
/// * `ctx` - The context containing the accounts required for revoking the attestation.
/// * `schema_uid` - The UID of the schema associated with the attestation (used in PDA derivation).
/// * `recipient` - The public key of the recipient (used in PDA derivation).
///
/// # Errors
///
/// * `AttestationError::Irrevocable` - If the attestation is marked as irrevocable.
/// * `AttestationError::AlreadyRevoked` - If the attestation has already been revoked.
/// * `AttestationError::InvalidSchema` - If the attestation's schema does not match the provided schema UID.
///
/// # Implementation Details
///
/// - **PDA Derivation**: Uses the `schema_uid`, `recipient`, and `attester` to derive the attestation PDA.
/// - **Revocability Check**: Ensures that the attestation is revocable.
/// - **Revocation Status Check**: Ensures that the attestation has not already been revoked.
/// - **Revocation Time Update**: Sets the `revocation_time` to the current timestamp.
/// - **Event Emission**: Emits a `Revoked` event for off-chain indexing.
///
/// # Why We Are Doing This
///
/// Revoking attestations allows attesters to invalidate claims they have previously made.
/// Emitting events facilitates off-chain indexing and enables clients to stay updated
/// with attestation statuses without polling the blockchain.
pub fn revoke(ctx: Context<Revoke>, _schema_uid: Pubkey, _recipient: Pubkey) -> Result<()> {
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

    // Emit an event to notify off-chain clients.
    emit!(Revoked {
        schema: attestation.schema,
        recipient: attestation.recipient,
        attester: attestation.attester,
        uid: attestation.uid,
        time: attestation.revocation_time.unwrap(),
    });

    Ok(())
}
