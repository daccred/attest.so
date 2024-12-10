use crate::errors::AttestationError;
use crate::events::Revoked;
use crate::state::Attestation;
use anchor_lang::prelude::*;

/// Context for the `revoke` instruction, which revokes an existing attestation.
///
/// Accounts:
/// - `attester`: The signer who is revoking the attestation.
/// - `attestation`: The attestation account to be revoked.
/// - `schema`: The schema data account associated with the attestation.
#[derive(Accounts)]
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
pub fn revoke_attestation_handler(
    ctx: Context<Revoke>,
    _schema_uid: Pubkey,
    _recipient: Pubkey,
) -> Result<()> {
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
    attestation.revocation_time = Some(Clock::get()?.unix_timestamp as u64);

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
