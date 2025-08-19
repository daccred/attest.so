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

// Re-export resolver implementations
pub use default::DefaultResolver;
pub use token_reward::TokenRewardResolver;
pub use fee_collection::FeeCollectionResolver;