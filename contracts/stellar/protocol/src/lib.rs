#![no_std]

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Vec};

pub mod errors;
pub mod events;
pub mod instructions;
pub mod interfaces;
pub mod state;
pub mod utils;

use state::{
    Attestation, BlsPublicKey, DataKey, DelegatedAttestationRequest, DelegatedRevocationRequest,
};

use instructions::{
    attest, attest_by_delegation, get_attestation, get_bls_public_key, list_attestations,
    register_bls_public_key, register_schema, revoke_attestation, revoke_by_delegation,
};

#[contract]
pub struct AttestationContract;

#[contractimpl]
impl AttestationContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), errors::Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(errors::Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    pub fn register(
        env: Env,
        caller: Address,
        schema_definition: String,
        resolver: Option<Address>,
        revocable: bool,
    ) -> Result<BytesN<32>, errors::Error> {
        register_schema(&env, caller, schema_definition, resolver, revocable)
    }

    /// Creates an attestation using the nonce-based system
    pub fn attest(
        env: Env,
        attester: Address,
        schema_uid: BytesN<32>,
        subject: Address,
        value: String,
        expiration_time: Option<u64>,
    ) -> Result<u64, errors::Error> {
        attest(&env, attester, schema_uid, subject, value, expiration_time)
    }

    /// Revokes an attestation by its nonce
    pub fn revoke_attestation(
        env: Env,
        revoker: Address,
        schema_uid: BytesN<32>,
        subject: Address,
        nonce: u64,
    ) -> Result<(), errors::Error> {
        revoke_attestation(&env, revoker, schema_uid, subject, nonce)
    }

    /// Gets an attestation by its nonce
    pub fn get_attestation(
        env: Env,
        schema_uid: BytesN<32>,
        subject: Address,
        nonce: u64,
    ) -> Result<Attestation, errors::Error> {
        get_attestation(&env, schema_uid, subject, nonce)
    }

    /// Lists attestations for a schema and subject
    pub fn list_attestations_for(
        env: Env,
        schema_uid: BytesN<32>,
        subject: Address,
        limit: u32,
    ) -> Vec<Attestation> {
        list_attestations(&env, schema_uid, subject, limit)
    }

    // ══════════════════════════════════════════════════════════════════════════════
    // ► Delegated Attestation Functions  
    // ══════════════════════════════════════════════════════════════════════════════

    /// Creates an attestation using a delegated signature
    /// Anyone can submit this transaction, paying the fees
    pub fn attest_by_delegation(
        env: Env,
        submitter: Address,
        request: DelegatedAttestationRequest,
    ) -> Result<(), errors::Error> {
        attest_by_delegation(&env, submitter, request)
    }

    /// Revokes an attestation using a delegated signature
    pub fn revoke_by_delegation(
        env: Env,
        submitter: Address,
        request: DelegatedRevocationRequest,
    ) -> Result<(), errors::Error> {
        revoke_by_delegation(&env, submitter, request)
    }

    /// Gets the next nonce for an attester
    pub fn get_attester_nonce(env: Env, attester: Address) -> u64 {
        utils::get_next_nonce(&env, &attester)
    }

    /// Registers a BLS public key for an attester
    pub fn register_bls_key(
        env: Env,
        attester: Address,
        public_key: BytesN<96>,
    ) -> Result<(), errors::Error> {
        register_bls_public_key(&env, attester, public_key)
    }

    /// Gets the BLS public key for an attester
    pub fn get_bls_key(env: Env, attester: Address) -> Option<BlsPublicKey> {
        get_bls_public_key(&env, &attester)
    }
}
