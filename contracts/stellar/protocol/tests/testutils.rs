// =======================================================================================
//
//                              BLS CRYPTOGRAPHY TEST HELPERS
//
// =======================================================================================
//! Test utilities for BLS12-381 cryptographic testing
//! reference: https://iancoleman.io/blsttc_ui/
//!
//! This module provides valid BLS12-381 curve points for testing signature verification
//! and other cryptographic operations. All constants are valid points on the curve.
use bls12_381::{G1Affine, G2Affine};
use protocol::instructions::delegation::create_attestation_message;
use protocol::state::DelegatedAttestationRequest;
use soroban_sdk::{Address, BytesN, Env, String as SorobanString};

/// =======================================================================================
///
///                              BLS CRYPTOGRAPHY CONSTANTS
///
/// =======================================================================================
pub const TEST_BLS_G2_PUBLIC_KEY: [u8; 192] = [
    6, 93, 9, 178, 174, 49, 129, 153, 182, 231, 94, 43, 166, 156, 240, 6, 245, 40, 128, 24, 16, 200, 165, 140, 213,
    138, 173, 184, 241, 181, 68, 79, 158, 235, 10, 199, 46, 1, 95, 170, 198, 80, 78, 154, 117, 34, 79, 34, 16, 150, 0,
    78, 71, 46, 44, 45, 50, 165, 223, 217, 71, 237, 143, 212, 88, 132, 30, 164, 254, 207, 117, 121, 40, 221, 243, 25,
    134, 151, 14, 113, 19, 237, 33, 147, 87, 231, 97, 232, 22, 143, 218, 33, 181, 245, 148, 178, 7, 157, 149, 57, 38,
    248, 116, 56, 250, 92, 108, 192, 238, 249, 61, 124, 118, 147, 186, 229, 174, 17, 68, 79, 170, 239, 234, 244, 72,
    255, 99, 171, 38, 111, 159, 131, 174, 144, 237, 194, 86, 4, 244, 176, 154, 77, 44, 188, 18, 17, 184, 111, 29, 54,
    215, 190, 219, 210, 202, 120, 188, 93, 86, 160, 66, 52, 177, 69, 209, 121, 52, 33, 200, 176, 183, 9, 180, 199, 245,
    30, 88, 170, 205, 232, 13, 241, 193, 193, 0, 137, 176, 174, 100, 179, 122, 8,
];

pub const TEST_BLS_PRIVATE_KEY: [u8; 32] = [
    34, 38, 144, 121, 33, 229, 89, 185, 68, 32, 10, 221, 176, 119, 70, 160, 41, 238, 104, 43, 146, 16, 63, 200, 77,
    240, 207, 42, 165, 238, 248, 220,
];

/// Sample message and signature for testing
/// A BLS12-381 signature for the message "This is a test message for signing"
/// The signature is a G1 point, and the public key is a G2 point.
/// This signature does not constiture a valid attestation message.
pub const _TEST_BLS_SIGNATURE_MESSAGE: &str = "This is a test message for signing";
pub const _TEST_BLS_SIGNATURE_HEX: &str = "08282b71e3978ded8780b26b86ea3d4f4215c561ea08c7fe091bd7599e8ecb56885f6b8f07a808cea7699842d730d9440daffe875294e8ccc1947a0e0cdeb1a8af2021919b95c8669b912e6fd6ebf78201f20c6e0cc458478c514147a155809b";
pub const _TEST_BLS_SIGNATURE_BYTES_COMPRESSED: [u8; 48] = [
    168, 40, 43, 113, 227, 151, 141, 237, 135, 128, 178, 107, 134, 234, 61, 79, 66, 21, 197, 97, 234, 8, 199, 254, 9,
    27, 215, 89, 158, 142, 203, 86, 136, 95, 107, 143, 7, 168, 8, 206, 167, 105, 152, 66, 215, 48, 217, 68,
];
pub const _TEST_BLS_SIGNATURE_BYTES: [u8; 96] = [
    8, 40, 43, 113, 227, 151, 141, 237, 135, 128, 178, 107, 134, 234, 61, 79, 66, 21, 197, 97, 234, 8, 199, 254, 9, 27,
    215, 89, 158, 142, 203, 86, 136, 95, 107, 143, 7, 168, 8, 206, 167, 105, 152, 66, 215, 48, 217, 68, 13, 175, 254,
    135, 82, 148, 232, 204, 193, 148, 122, 14, 12, 222, 177, 168, 175, 32, 33, 145, 155, 149, 200, 102, 155, 145, 46,
    111, 214, 235, 247, 130, 1, 242, 12, 110, 12, 196, 88, 71, 140, 81, 65, 71, 161, 85, 128, 155,
];

/// =======================================================================================
///
///                              BLS CRYPTOGRAPHY UTILITY FUNCTIONS
///
/// =======================================================================================

/// Helper function to get the G1 generator point
pub fn _group_one_generator() -> G1Affine {
    G1Affine::generator()
}
/// Helper function to get the G2 generator point  
pub fn _group_two_generator() -> G2Affine {
    G2Affine::generator()
}

pub fn create_delegated_attestation_request(
    env: &Env,
    attester: &Address,
    nonce: u64,
    schema_uid: &BytesN<32>,
    subject: &Address,
) -> DelegatedAttestationRequest {
    let private_key = blst::min_sig::SecretKey::from_bytes(&TEST_BLS_PRIVATE_KEY)
        .map_err(|e| panic!("Failed to create private key: {:?}", e))
        .unwrap();

    let mut request = DelegatedAttestationRequest {
        schema_uid: schema_uid.clone(),
        subject: subject.clone(),
        value: SorobanString::from_str(env, "{\"key\":\"value\"}"),
        nonce,
        attester: attester.clone(),
        expiration_time: None,
        deadline: env.ledger().timestamp() + 1000,
        signature: BytesN::from_array(env, &[0; 96]), // Placeholder
    };

    let message_hash = create_attestation_message(env, &request);

    let signature_scalar = private_key.sign(
        &message_hash.to_array(),
        b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_",
        &[],
    );
    let signature_bytes = signature_scalar.serialize();

    request.signature = BytesN::from_array(env, &signature_bytes);
    request
}
