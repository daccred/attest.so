// ══════════════════════════════════════════════════════════════════════════════
// ► Access Control Module
// ══════════════════════════════════════════════════════════════════════════════
//
// Inspired by OpenZeppelin's Ownable pattern for Stellar/Soroban contracts
// Reference: https://docs.openzeppelin.com/stellar-contracts/0.4.0/access/ownable
//
// This module provides a simple ownership access control mechanism where
// a single account (the "owner") has exclusive access to specific functions.

use crate::errors::Error;
use crate::state::{get_admin, is_initialized, set_admin};
use soroban_sdk::{Address, Env, String};

// ══════════════════════════════════════════════════════════════════════════════
// ► Core Access Control Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Returns the current owner of the contract
///
/// # Returns
/// * `Some(Address)` - The owner address if set
/// * `None` - If no owner is set (contract not initialized)
pub fn owner(env: &Env) -> Option<Address> {
    get_admin(env)
}

/// Sets the owner of the contract
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `new_owner` - The address to set as the new owner
///
/// # Note
/// This is an internal function. Use transfer_ownership for external calls.
pub fn set_owner(env: &Env, new_owner: &Address) {
    set_admin(env, new_owner);
}

/// Checks if the given address is the current owner
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `address` - The address to check
///
/// # Returns
/// * `true` - If the address is the owner
/// * `false` - If the address is not the owner or no owner is set
pub fn is_owner(env: &Env, address: &Address) -> bool {
    match owner(env) {
        Some(current_owner) => current_owner == *address,
        None => false,
    }
}

/// Modifier-like function that requires the caller to be the owner
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `caller` - The address attempting to call the function
///
/// # Returns
/// * `Ok(())` - If the caller is the owner
/// * `Err(Error)` - If the caller is not the owner or contract not initialized
///
/// # Usage
/// ```rust
/// pub fn admin_function(env: Env, caller: Address) -> Result<(), Error> {
///     only_owner(&env, &caller)?;
///     // Function logic here
///     Ok(())
/// }
/// ```
pub fn only_owner(env: &Env, caller: &Address) -> Result<(), Error> {
    // Require caller authorization first
    caller.require_auth();

    // Check if contract is initialized
    if !is_initialized(env) {
        return Err(Error::NotInitialized);
    }

    // Check if caller is the owner
    if !is_owner(env, caller) {
        return Err(Error::NotAuthorized);
    }

    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Ownership Transfer Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Transfers ownership of the contract to a new account
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `current_owner` - The current owner address (must match actual owner)
/// * `new_owner` - The address to transfer ownership to
///
/// # Returns
/// * `Ok(())` - If ownership transfer is successful
/// * `Err(Error)` - If not authorized or contract not initialized
///
/// # Security Notes
/// * Only the current owner can transfer ownership
/// * Immediately transfers ownership (no two-step process for simplicity)
/// * Use with caution - ownership cannot be recovered if transferred to wrong address
pub fn transfer_ownership(env: &Env, current_owner: &Address, new_owner: &Address) -> Result<(), Error> {
    only_owner(env, current_owner)?;

    set_owner(env, new_owner);

    // Emit ownership transfer event
    crate::events::ownership_transferred(env, current_owner, new_owner);

    Ok(())
}

/// Renounces ownership of the contract
///
/// # Arguments
/// * `env` - The Soroban environment
/// * `current_owner` - The current owner address (must match actual owner)
///
/// # Returns
/// * `Ok(())` - If ownership renunciation is successful
/// * `Err(Error)` - If not authorized or contract not initialized
///
/// # Warning
/// This is a one-way operation that cannot be undone! After renouncing ownership:
/// * All owner-only functions become permanently inaccessible
/// * The contract cannot be upgraded or administered
/// * Use only when you want to make the contract fully decentralized
pub fn renounce_ownership(env: &Env, current_owner: &Address) -> Result<(), Error> {
    only_owner(env, current_owner)?;

    // Set owner to a zero-like address (using first valid Stellar address format)
    let zero_address_str = String::from_str(env, "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
    let zero_address = Address::from_string(&zero_address_str);
    set_owner(env, &zero_address);

    // Emit ownership renunciation event
    crate::events::ownership_renounced(env, current_owner);

    Ok(())
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Convenience Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Gets the owner address or returns an error if not set
///
/// # Arguments
/// * `env` - The Soroban environment
///
/// # Returns
/// * `Ok(Address)` - The owner address
/// * `Err(Error::NotInitialized)` - If no owner is set
pub fn get_owner(env: &Env) -> Result<Address, Error> {
    owner(env).ok_or(Error::NotInitialized)
}

// ══════════════════════════════════════════════════════════════════════════════
// ► Testing Utilities (cfg(test) only)
// ══════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
pub mod test_utils {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    /// Creates a test owner address for testing
    pub fn create_test_owner(env: &Env) -> Address {
        Address::generate(env)
    }

    /// Sets up a contract with a test owner
    pub fn setup_test_ownership(env: &Env) -> Address {
        let owner = create_test_owner(env);
        set_owner(env, &owner);
        owner
    }
}
