// src/instruction.rs
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum AttestationInstruction {
    /// Registers a new schema.
    /// Accounts:
    ///   [writable] Schema account
    ///   [signer] Payer account
    RegisterSchema {
        schema_definition: Vec<u8>,
        resolver: Option<Pubkey>,
        revocable: bool,
    },

    /// Creates a new attestation.
    /// Accounts:
    ///   [writable] Attestation account
    ///   [signer] Attester account
    ///   [] Schema account
    ///   [] Recipient account
    CreateAttestation {
        schema_uid: [u8; 32],
        ref_uid: [u8; 32],
        expiration_time: u64,
        revocable: bool,
        data: Vec<u8>,
    },

    /// Revokes an existing attestation.
    /// Accounts:
    ///   [writable] Attestation account
    ///   [signer] Attester account
    RevokeAttestation {
        attestation_uid: [u8; 32],
    },
}
