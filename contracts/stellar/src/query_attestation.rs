use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

#[derive(Debug, Clone)]
pub struct Attestation {
    pub uid: Vec<u8>,
    pub schema_uid: Vec<u8>,
    pub recipient: Address,
    pub attester: Address,
    pub data: String,
    pub time: u64,
    pub expiration_time: Option<u64>,
    pub revocation_time: Option<u64>,
    pub revocable: bool,
}

#[derive(Debug, Clone)]
pub struct Schema {
    pub uid: Vec<u8>,
    pub name: String,
    pub definition: String,
    pub resolver: Option<Address>,
    pub revocable: bool,
    pub authority: Address,
    pub levy: Option<Levy>,
}

#[derive(Debug, Clone)]
pub struct Authority {
    pub address: Address,
    pub metadata: String,
}

#[derive(Debug, Clone)]
pub struct Levy {
    pub amount: u64,
    pub asset: Address,
    pub recipient: Address,
}

#[contract]
pub struct AttestationContract;

#[contractimpl]
impl AttestationContract {
    fn query_attestation(&self, env: Env, uid: Vec<u8>) -> Result<Option<Attestation>, String> {
        let attestation = fetch_attestation(env, &uid)
            .ok_or("Attestation not found")?;
        Ok(Some(attestation))
    }
}

fn fetch_attestation(env: Env, uid: &[u8]) -> Option<Attestation> {
    env.storage().get(uid)
}
