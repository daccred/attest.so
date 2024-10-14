// src/lib.rs

pub mod error;
pub mod instruction;
pub mod processor;
pub mod state;

use solana_program::{
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
};
use crate::processor::process_instruction;

// Declare the program's entrypoint
entrypoint!(process_instruction);
