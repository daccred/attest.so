use soroban_sdk::{contracttype, Address, Bytes, BytesN, String as SorobanString};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Authority(Address),
    Schema(BytesN<32>),
    Attestation(BytesN<32>, Address, Option<SorobanString>),
}

#[contracttype]
#[derive(Clone)]
pub struct StoredAttestation {
    pub schema_uid: BytesN<32>,
    pub recipient: Address,
    pub attester: Address,
    pub time: u64,
    pub expiration_time: Option<u64>,
    pub revocation_time: Option<u64>,
    pub revocable: bool,
    pub ref_uid: Option<Bytes>,
    pub data: Bytes,
    pub value: Option<i128>,
}

#[derive(Debug, Clone)]
#[contracttype]
pub struct Authority {
    pub address: Address,
    pub metadata: SorobanString,
}

#[contracttype]
#[derive(Clone)]
pub struct Schema {
    pub authority: Address,
    pub definition: SorobanString,
    pub resolver: Option<Address>,
    pub revocable: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct AttestationRecord {
    pub schema_uid: BytesN<32>,
    pub subject: Address,
    pub value: SorobanString,
    pub reference: Option<SorobanString>,
    pub revoked: bool,
} 