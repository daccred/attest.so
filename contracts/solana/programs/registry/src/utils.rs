use anchor_lang::prelude::*;

/// Derives the Program Derived Address (PDA) for a schema.
///
/// This function calculates the PDA for a schema based on the deployer's public key,
/// the schema name, and the program ID. This PDA is used as the unique identifier
/// (UID) for the schema and serves as the address where the schema data is stored.
///
/// # Arguments
///
/// * `deployer` - A reference to the public key of the deployer who creates the schema.
/// * `schema_name` - The name of the schema, used as a seed in the PDA derivation.
/// * `program_id` - A reference to the program ID of the schema registry program.
///
/// # Returns
///
/// A tuple containing:
/// * `Pubkey` - The derived PDA for the schema.
/// * `u8` - The bump seed associated with the PDA.
///
/// # Why We Are Doing This
///
/// Deriving a PDA ensures a unique and deterministic address for each schema based on the deployer
/// and schema name. This prevents collisions and allows anyone to derive the address of a schema
/// without querying the blockchain.
pub fn derive_schema_pda(
    deployer: &Pubkey,
    schema_name: String,
    program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"schema", deployer.as_ref(), schema_name.as_bytes()],
        program_id,
    )
}
