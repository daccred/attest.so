use soroban_sdk::contracterror;
// use soroban_sdk::{Address, Env}; // Unused

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    TransferFailed = 1,
    AuthorityNotRegistered = 2,
    SchemaNotFound = 3,
    AttestationExists = 4,
    AttestationNotFound = 5,
    NotAuthorized = 6,
    StorageFailed = 7,
    InvalidUid = 9,
    ResolverError = 10,
    SchemaHasNoResolver = 11,
    AdminNotSet = 12,
    AlreadyInitialized = 13,
    NotInitialized = 14,
    AttestationNotRevocable = 15,
    InvalidSchemaDefinition = 16,
    InvalidAttestationValue = 17,
    InvalidReference = 18,
} 