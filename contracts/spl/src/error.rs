// src/error.rs
use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum AttestationError {
    #[error("Invalid Instruction")]
    InvalidInstruction,
    #[error("Schema Not Found")]
    SchemaNotFound,
    #[error("Attestation Not Found")]
    AttestationNotFound,
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Attestation Already Revoked")]
    AttestationAlreadyRevoked,
    #[error("Invalid Data Length")]
    InvalidDataLength,
    #[error("Invalid Account Data")]
    InvalidAccountData,
}

impl From<AttestationError> for ProgramError {
    fn from(e: AttestationError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
