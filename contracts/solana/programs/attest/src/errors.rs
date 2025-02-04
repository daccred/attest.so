use anchor_lang::prelude::*;

#[error_code]
pub enum AttestError {
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
    #[msg("Wrong Asset.")]
    WrongAsset,
    #[msg("Should be unused.")]
    ShouldBeUnused,
    #[msg("Invalid data.")]
    InvalidData,
    #[msg("Unauthorized operation: Only admin can perform this action.")]
    Unauthorized,
    #[msg("Schema already exists.")]
    SchemaAlreadyExists,
    // #[msg("Unauthorized authority.")]
    // Unauthorized,
}
