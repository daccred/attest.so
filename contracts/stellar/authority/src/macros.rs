// ══════════════════════════════════════════════════════════════════════════════
// ► Access Control Macros
// ══════════════════════════════════════════════════════════════════════════════
//
// Inspired by OpenZeppelin's access control macros for Stellar/Soroban contracts
// Reference: https://docs.openzeppelin.com/stellar-contracts/0.4.0/access/ownable
//
// These macros provide a clean way to implement access control without
// repeating authorization logic in every admin function.

/// Macro to require owner authorization at the beginning of a function
///
/// This macro generates code that:
/// 1. Requires authentication from the caller
/// 2. Checks if the caller is the contract owner
/// 3. Returns appropriate errors if validation fails
///
/// # Usage
/// ```rust
/// pub fn admin_function(env: Env, caller: Address) -> Result<(), Error> {
///     only_owner!(env, caller);
///     // Function logic here
///     Ok(())
/// }
/// ```
///
/// # Generated Code
/// The macro expands to:
/// ```rust
/// crate::access_control::only_owner(&env, &caller)?;
/// ```
#[macro_export]
macro_rules! only_owner {
    ($env:expr, $caller:expr) => {
        $crate::access_control::only_owner(&$env, &$caller)?;
    };
}

/// Macro to require contract initialization
///
/// This macro generates code that checks if the contract has been initialized
/// and returns an error if not.
///
/// # Usage
/// ```rust
/// pub fn some_function(env: Env) -> Result<(), Error> {
///     require_init!(env);
///     // Function logic here
///     Ok(())
/// }
/// ```
///
/// # Generated Code
/// The macro expands to:
/// ```rust
/// crate::instructions::admin::require_init(&env)?;
/// ```
#[macro_export]
macro_rules! require_init {
    ($env:expr) => {
        $crate::instructions::admin::require_init(&$env)?;
    };
}

/// Macro to require both initialization and owner authorization
///
/// This is a convenience macro that combines initialization check and owner check
///
/// # Usage
/// ```rust
/// pub fn admin_function(env: Env, caller: Address) -> Result<(), Error> {
///     require_owner!(env, caller);
///     // Function logic here
///     Ok(())
/// }
/// ```
///
/// # Generated Code
/// The macro expands to:
/// ```rust
/// crate::instructions::admin::require_init(&env)?;
/// crate::access_control::only_owner(&env, &caller)?;
/// ```
#[macro_export]
macro_rules! require_owner {
    ($env:expr, $caller:expr) => {
        $crate::instructions::admin::require_init(&$env)?;
        $crate::access_control::only_owner(&$env, &$caller)?;
    };
}

/// Macro to emit ownership events with proper formatting
///
/// # Usage for ownership transfer
/// ```rust
/// emit_ownership_event!(env, transferred, old_owner, new_owner);
/// ```
///
/// # Usage for ownership renunciation
/// ```rust
/// emit_ownership_event!(env, renounced, old_owner);
/// ```
#[macro_export]
macro_rules! emit_ownership_event {
    ($env:expr, transferred, $old_owner:expr, $new_owner:expr) => {
        $crate::events::ownership_transferred(&$env, &$old_owner, &$new_owner);
    };
    ($env:expr, renounced, $old_owner:expr) => {
        $crate::events::ownership_renounced(&$env, &$old_owner);
    };
}

/// Macro for admin function validation pattern
///
/// This macro combines all common validations for admin functions:
/// 1. Contract initialization check
/// 2. Owner authorization
/// 3. Optional custom validation
///
/// # Usage
/// ```rust
/// pub fn admin_function(env: Env, caller: Address, param: String) -> Result<(), Error> {
///     admin_guard!(env, caller);
///     // Function logic here
///     Ok(())
/// }
/// ```
///
/// # With custom validation
/// ```rust
/// pub fn admin_function(env: Env, caller: Address, param: String) -> Result<(), Error> {
///     admin_guard!(env, caller, {
///         if param.is_empty() {
///             return Err(Error::InvalidInput);
///         }
///     });
///     // Function logic here
///     Ok(())
/// }
/// ```
#[macro_export]
macro_rules! admin_guard {
    ($env:expr, $caller:expr) => {
        require_owner!($env, $caller);
    };
    ($env:expr, $caller:expr, $validation:block) => {
        require_owner!($env, $caller);
        $validation
    };
}

// Re-export macros for easier use
pub use require_owner;
