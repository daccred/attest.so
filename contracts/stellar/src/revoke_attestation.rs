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
    fn revoke_attestation(&self, env: Env, uid: Vec<u8>) -> Result<(), String> {
        let caller = self.principal();

        // Fetch the attestation from storage
        let mut attestation = get_attestation(env, &uid).ok_or("Attestation not found")?;

        // Ensure the caller is the original attester
        if attestation.attester != caller {
            return Err("Only the original attester can revoke the attestation".to_string());
        }

        // Update the attestation's revocation_time
        attestation.revocation_time = Some(env.block_timestamp());

        // Store the updated attestation
        store_attestation(env, &uid, &attestation)?;

        // Emit a revocation event
        emit_attestation_revoked(env, uid);

        Ok(())
    }
}

// Storage functions
fn get_attestation(env: Env, uid: &[u8]) -> Option<Attestation> {
    env.storage().get(uid)
}

fn store_attestation(env: Env, uid: &[u8], attestation: &Attestation) -> Result<(), String> {
    env.storage()
        .set(uid, attestation)
        .map_err(|_| "Failed to store attestation".to_string())
}

// Event Emission
fn emit_attestation_revoked(env: Env, uid: Vec<u8>) {
    env.events()
        .publish("AttestationRevoked", (uid,))
        .expect("Failed to emit attestation revoked event");
}
