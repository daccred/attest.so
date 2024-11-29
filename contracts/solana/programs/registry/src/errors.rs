use anchor_lang::prelude::*;

#[error_code]
pub enum RegistryError {
    #[msg("Schema already exists.")]
    SchemaAlreadyExists,
    #[msg("Unauthorized authority.")]
    Unauthorized,
}
