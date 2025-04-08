pub mod schema;
pub mod attest;
pub mod revoke;

pub use schema::{register_schema, get_schema_or_fail};
pub use attest::{attest, get_attest};
pub use revoke::revoke_attest;