use soroban_sdk::{contracttype, Address, Bytes, BytesN};
// Env is unused

/************************************************
* Attestation Struct (as specified for Resolver)
************************************************/
#[derive(Debug, Clone)]
#[contracttype]
pub struct ResolverAttestationRecord {
    pub uid: BytesN<32>,
    pub schema_uid: BytesN<32>,
    pub recipient: Address,
    pub attester: Address,
    pub time: u64,
    pub expiration_time: Option<u64>,
    pub revocation_time: Option<u64>,
    pub revocable: bool,
    // Using Bytes for ref_uid to avoid Option<BytesN<32>> serialization issues
    pub ref_uid: Option<Bytes>,
    pub data: Bytes,
    pub value: Option<i128>,
} 