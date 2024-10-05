// src/processor.rs

use crate::{
    error::AttestationError,
    instruction::AttestationInstruction,
    state::{Attestation, SchemaRecord},
};
use borsh::{BorshDeserialize, BorshSerialize};
use sha2::{Digest, Sha256};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint::ProgramResult,
    msg,
    program::{invoke},
    pubkey::Pubkey,
    system_instruction,
    sysvar::Sysvar,
};

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction =
        AttestationInstruction::try_from_slice(instruction_data)
            .map_err(|_| AttestationError::InvalidInstruction)?;

    match instruction {
        AttestationInstruction::RegisterSchema {
            schema_definition,
            resolver,
            revocable,
        } => {
            msg!("Instruction: RegisterSchema");
            process_register_schema(
                program_id,
                accounts,
                schema_definition,
                resolver,
                revocable,
            )
        }
        AttestationInstruction::CreateAttestation {
            schema_uid,
            ref_uid,
            expiration_time,
            revocable,
            data,
        } => {
            msg!("Instruction: CreateAttestation");
            process_create_attestation(
                program_id,
                accounts,
                schema_uid,
                ref_uid,
                expiration_time,
                revocable,
                data,
            )
        }
        AttestationInstruction::RevokeAttestation { attestation_uid } => {
            msg!("Instruction: RevokeAttestation");
            process_revoke_attestation(program_id, accounts, attestation_uid)
        }
    }
}

fn process_register_schema(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    schema_definition: Vec<u8>,
    resolver: Option<Pubkey>,
    revocable: bool,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let schema_account = next_account_info(account_info_iter)?; // Writable, Not Signer
    let payer_account = next_account_info(account_info_iter)?; // Signer

    // Ensure payer_account is a signer
    if !payer_account.is_signer {
        return Err(AttestationError::Unauthorized.into());
    }

    // Generate schema UID
    let schema_uid = generate_uid(&schema_definition);

    // Create SchemaRecord
    let schema_record = SchemaRecord {
        uid: schema_uid,
        schema_definition,
        resolver,
        revocable,
    };

    // Serialize SchemaRecord
    let schema_data = schema_record.try_to_vec()?;

    // Assign to the schema_account
    if schema_account.data.borrow().len() < schema_data.len() {
        return Err(AttestationError::InvalidAccountData.into());
    }

    let mut schema_account_data = schema_account.try_borrow_mut_data()?;
    schema_account_data[..schema_data.len()].copy_from_slice(&schema_data);

    Ok(())
}

fn process_create_attestation(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    schema_uid: [u8; 32],
    ref_uid: [u8; 32],
    expiration_time: u64,
    revocable: bool,
    data: Vec<u8>,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let attestation_account = next_account_info(account_info_iter)?; // Writable
    let attester_account = next_account_info(account_info_iter)?; // Signer
    let schema_account = next_account_info(account_info_iter)?; // Readonly
    let recipient_account = next_account_info(account_info_iter)?; // Readonly
    let system_program = next_account_info(account_info_iter)?;

    // Ensure attester_account is a signer
    if !attester_account.is_signer {
        return Err(AttestationError::Unauthorized.into());
    }

    // Verify schema exists
    if schema_account.data_is_empty() {
        return Err(AttestationError::SchemaNotFound.into());
    }

    // Generate attestation UID
    let attestation_uid = generate_uid(&data);

    // Create Attestation
    let clock = Clock::get()?;
    let attestation = Attestation {
        uid: attestation_uid,
        schema: schema_uid,
        ref_uid,
        time: clock.unix_timestamp as u64,
        expiration_time,
        revocation_time: 0,
        recipient: *recipient_account.key,
        attester: *attester_account.key,
        revocable,
        data,
    };

    // Serialize Attestation
    let attestation_data = attestation.try_to_vec()?;

    // Allocate space and assign to the attestation account
    let rent = solana_program::sysvar::rent::Rent::get()?;
    let lamports = rent.minimum_balance(attestation_data.len());

    let create_account_ix = system_instruction::create_account(
        attester_account.key,
        attestation_account.key,
        lamports,
        attestation_data.len() as u64,
        program_id,
    );
    invoke(
        &create_account_ix,
        &[
            attester_account.clone(),
            attestation_account.clone(),
            system_program.clone(),
        ],
    )?;

    // Save Attestation to attestation_account
    let mut attestation_account_data = attestation_account.try_borrow_mut_data()?;
    attestation_account_data[..attestation_data.len()].copy_from_slice(&attestation_data);

    Ok(())
}

fn process_revoke_attestation(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    attestation_uid: [u8; 32],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let attestation_account = next_account_info(account_info_iter)?; // Writable
    let attester_account = next_account_info(account_info_iter)?; // Signer

    // Ensure attester_account is a signer
    if !attester_account.is_signer {
        return Err(AttestationError::Unauthorized.into());
    }

    // Deserialize Attestation
    let mut attestation = Attestation::try_from_slice(&attestation_account.data.borrow())?;

    // Check attestation UID
    if attestation.uid != attestation_uid {
        return Err(AttestationError::AttestationNotFound.into());
    }

    // Check if already revoked
    if attestation.revocation_time != 0 {
        return Err(AttestationError::AttestationAlreadyRevoked.into());
    }

    // Check if signer is attester
    if attestation.attester != *attester_account.key {
        return Err(AttestationError::Unauthorized.into());
    }

    // Set revocation time
    let clock = Clock::get()?;
    attestation.revocation_time = clock.unix_timestamp as u64;

    // Serialize and save back
    let updated_data = attestation.try_to_vec()?;
    let mut attestation_account_data = attestation_account.try_borrow_mut_data()?;
    if attestation_account_data.len() < updated_data.len() {
        return Err(AttestationError::InvalidAccountData.into());
    }
    attestation_account_data[..updated_data.len()].copy_from_slice(&updated_data);

    Ok(())
}

fn generate_uid(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut uid = [0u8; 32];
    uid.copy_from_slice(&result);
    uid
}
