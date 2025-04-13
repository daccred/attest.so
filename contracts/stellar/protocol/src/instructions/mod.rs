pub mod schema;
pub mod attest;
pub mod revoke;

pub use schema::{register_schema};
pub use attest::{attest, get_attest};
pub use revoke::revoke_attest;