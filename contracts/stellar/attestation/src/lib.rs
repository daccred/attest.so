#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

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
    fn attest(
        &self,
        env: Env,
        data: String,
        recipient_address: Address,
        ref_uid: Option<Vec<u8>>,
        expiration_time: Option<u64>,
        revocable: bool,
    ) -> Result<(), String> {
        let caller = self.principal();

        // Check if caller is a registered authority
        let authority = get_authority(env, caller).ok_or("Caller is not a registered authority")?;

        // Check if schema UID is provided
        let schema_uid = ref_uid.ok_or("Schema UID not provided")?;

        // Retrieve the schema from storage
        let schema = get_schema(env, &schema_uid).ok_or("Schema not found")?;

        // Process levy if applicable
        if let Some(levy) = &schema.levy {
            // Ensure that the transfer is successful
            env.transfer(&caller, &levy.recipient, &levy.asset, levy.amount)
                .map_err(|_| "Transfer failed")?;
        }

        // Generate UID for the attestation
        let uid = env.hash(&data); // Hashing the data for a unique identifier
        let uid_bytes = uid.to_vec();

        // Ensure attestation does not already exist
        if get_attestation(env, &uid_bytes).is_some() {
            return Err("Attestation with this UID already exists".to_string());
        }

        // Create and store the attestation
        let attestation = Attestation {
            uid: uid_bytes.clone(),
            schema_uid,
            recipient: recipient_address,
            attester: caller,
            data,
            time: env.block_timestamp(),
            expiration_time,
            revocation_time: None,
            revocable,
        };

        store_attestation(env, &uid_bytes, &attestation)?;

        Ok(())
    }

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

    fn query_attestation(&self, env: Env, uid: Vec<u8>) -> Result<Option<Attestation>, String> {
        let attestation = get_attestation(env, &uid).ok_or("Attestation not found")?;
        Ok(Some(attestation))
    }
}

// Storage access functions
fn get_authority(env: Env, address: Address) -> Option<Authority> {
    env.storage().get(&address)
}

fn get_schema(env: Env, uid: &[u8]) -> Option<Schema> {
    env.storage().get(uid)
}

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
