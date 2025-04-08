pub mod schema;
pub mod attest;
pub mod revoke;
pub mod register_authority;

pub use schema::{register_schema, get_schema, generate_uid};
pub use attest::{attest, get_attest};
pub use revoke::revoke_attest;
pub use register_authority::register_authority; 