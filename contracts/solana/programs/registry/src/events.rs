use crate::state::SchemaData;
use anchor_lang::prelude::*;

#[event]
pub struct SchemaCreated {
    /// The generated UID for the schema (PDA).
    pub uid: Pubkey,
    /// Full schema data including schema, resolver, revocable, and deployer.
    pub schema_data: SchemaData,
}
