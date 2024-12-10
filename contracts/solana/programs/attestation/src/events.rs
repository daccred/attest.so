use anchor_lang::prelude::*;

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
    pub time: u64,
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
    pub time: u64,
}
