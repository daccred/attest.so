use anchor_lang::prelude::*;

#[error_code]
pub enum AuthorityError {
    #[msg("Unauthorized operation: Only admin can perform this action.")]
    Unauthorized,
}
