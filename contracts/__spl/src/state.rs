// src/state.rs
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

pub const SCHEMA_SEED: &[u8] = b"schema";
pub const ATTESTATION_SEED: &[u8] = b"attestation";

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct SchemaRecord {
    pub uid: [u8; 32],
    pub schema_definition: Vec<u8>,
    pub resolver: Option<Pubkey>,
    pub revocable: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Attestation {
    pub uid: [u8; 32],
    pub schema: [u8; 32],
    pub ref_uid: [u8; 32],
    pub time: u64,
    pub expiration_time: u64,
    pub revocation_time: u64,
    pub recipient: Pubkey,
    pub attester: Pubkey,
    pub revocable: bool,
    pub data: Vec<u8>,
}
