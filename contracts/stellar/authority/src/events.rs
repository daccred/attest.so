use soroban_sdk::{symbol_short, Env, Symbol};

// ══════════════════════════════════════════════════════════════════════════════
// ► Contract Events (Public constants)
// ══════════════════════════════════════════════════════════════════════════════
pub const ADMIN_REG_AUTH: Symbol = symbol_short!("adm_rg_at");
pub const AUTHORITY_REGISTERED: Symbol = symbol_short!("auth_reg");
pub const SCHEMA_REGISTERED: Symbol = symbol_short!("schm_reg");
pub const LEVY_COLLECTED: Symbol = symbol_short!("levy_coll");
pub const LEVY_WITHDRAWN: Symbol = symbol_short!("levy_wdrw");
pub const OWNERSHIP_TRANSFERRED: Symbol = symbol_short!("own_trans");
pub const OWNERSHIP_RENOUNCED: Symbol = symbol_short!("own_rncd");

// Helper functions to publish events with appropriate topics and data
pub fn admin_register_authority(
    e: &Env,
    authority: &soroban_sdk::Address,
    metadata: &soroban_sdk::String,
) {
    e.events().publish(
        (ADMIN_REG_AUTH, symbol_short!("register")),
        (authority.clone(), metadata.clone()),
    );
}

pub fn authority_registered(
    e: &Env,
    caller: &soroban_sdk::Address,
    authority: &soroban_sdk::Address,
    metadata: &soroban_sdk::String,
) {
    e.events().publish(
        (AUTHORITY_REGISTERED, symbol_short!("register")),
        (caller.clone(), authority.clone(), metadata.clone()),
    );
}

pub fn schema_registered(
    e: &Env,
    schema_uid: &soroban_sdk::BytesN<32>,
    rules: &crate::state::SchemaRules,
) {
    e.events().publish(
        (SCHEMA_REGISTERED, symbol_short!("register")),
        (schema_uid.clone(), rules.clone()),
    );
}

pub fn levy_collected(
    e: &Env,
    attester: &soroban_sdk::Address,
    recipient: &soroban_sdk::Address,
    schema_uid: &soroban_sdk::BytesN<32>,
    amount: i128,
) {
    e.events().publish(
        (LEVY_COLLECTED, symbol_short!("collect")),
        (
            attester.clone(),
            recipient.clone(),
            schema_uid.clone(),
            amount,
        ),
    );
}

pub fn levy_withdrawn(e: &Env, recipient: &soroban_sdk::Address, amount: i128) {
    e.events().publish(
        (LEVY_WITHDRAWN, symbol_short!("withdraw")),
        (recipient.clone(), amount),
    );
}

pub fn ownership_transferred(
    e: &Env,
    previous_owner: &soroban_sdk::Address,
    new_owner: &soroban_sdk::Address,
) {
    e.events().publish(
        (OWNERSHIP_TRANSFERRED, symbol_short!("transfer")),
        (previous_owner.clone(), new_owner.clone()),
    );
}

pub fn ownership_renounced(e: &Env, previous_owner: &soroban_sdk::Address) {
    e.events().publish(
        (OWNERSHIP_RENOUNCED, symbol_short!("renounce")),
        previous_owner.clone(),
    );
}
