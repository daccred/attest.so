use soroban_sdk::contracterror;

// ══════════════════════════════════════════════════════════════════════════════
// ► Contract Errors
// ══════════════════════════════════════════════════════════════════════════════
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,         // General auth failure
    RecipientNotAuthority = 4, // Levy recipient must be registered
    AttesterNotAuthority = 5,
    SchemaNotRegistered = 6,
    InvalidSchemaRules = 7,
    InsufficientPayment = 8, // For registration fee
    NothingToWithdraw = 9,
    TokenTransferFailed = 10, // Deprecated/internal - transfer panics
    WithdrawalFailed = 11,    // Deprecated/internal - transfer panics
}
