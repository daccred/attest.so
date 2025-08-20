#![no_std]

pub mod interface;
pub mod default;
pub mod token_reward;
pub mod fee_collection;

// Re-export interface types
pub use interface::{
    Attestation,
    ResolverError,
    ResolverInterface,
    ResolverMetadata,
    ResolverType,
};

// Re-export resolver implementations only when exporting contracts or in tests
#[cfg(any(test, feature = "export-contracts"))]
pub use default::DefaultResolver;
#[cfg(any(test, feature = "export-contracts"))]
pub use token_reward::TokenRewardResolver;
#[cfg(any(test, feature = "export-contracts"))]
pub use fee_collection::FeeCollectionResolver;