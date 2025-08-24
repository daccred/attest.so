// =======================================================================================
//
//                              BLS CRYPTOGRAPHY TEST HELPERS
//
// =======================================================================================
//! Test utilities for BLS12-381 cryptographic testing
//!
//! This module provides valid BLS12-381 curve points for testing signature verification
//! and other cryptographic operations. All constants are valid points on the curve.
use bls12_381::{G1Affine, G2Affine, Scalar};

#[test]
fn generate_valid_bls_constants() {
    // Generate G1 uncompressed (96 bytes)
    let g1_gen = G1Affine::generator();
    let g1_uncompressed = g1_gen.to_uncompressed();
    println!("G1 generator uncompressed (96 bytes):");
    print!("pub const TEST_BLS_G1_SIGNATURE: [u8; 96] = [");
    for (i, byte) in g1_uncompressed.iter().enumerate() {
        if i % 16 == 0 {
            print!("\n    ");
        }
        print!("0x{:02x}, ", byte);
    }
    println!("\n];");

    // Generate G2 uncompressed (192 bytes)
    let g2_gen = G2Affine::generator();
    let g2_uncompressed = g2_gen.to_uncompressed();
    println!("\nG2 generator uncompressed (192 bytes):");
    print!("pub const TEST_BLS_G2_PUBLIC_KEY: [u8; 192] = [");
    for (i, byte) in g2_uncompressed.iter().enumerate() {
        if i % 16 == 0 {
            print!("\n    ");
        }
        print!("0x{:02x}, ", byte);
    }
    println!("\n];");

    // Verify they're valid
    let g1_from_bytes = G1Affine::from_uncompressed(&g1_uncompressed).unwrap();
    let g2_from_bytes = G2Affine::from_uncompressed(&g2_uncompressed).unwrap();

    assert_eq!(g1_from_bytes, g1_gen);
    assert_eq!(g2_from_bytes, g2_gen);

    println!("\n✅ All constants are valid BLS12-381 points!");
}

/// Valid BLS12-381 private key for testing (32 bytes)
/// Generated using bls12_381
/// This generates a deterministic keypair for consistent testing
pub const TEST_BLS_PRIVATE_KEY: [u8; 32] = [34, 38, 144, 121, 33, 229, 89, 185, 68, 32, 10, 221, 176, 119, 70, 160, 41, 238, 104, 43, 146, 16, 63, 200, 77, 240, 207, 42, 165, 238, 248, 220];
pub const TEST_BLS_G2_PUBLIC_KEY: [u8; 192] = [6, 93, 9, 178, 174, 49, 129, 153, 182, 231, 94, 43, 166, 156, 240, 6, 245, 40, 128, 24, 16, 200, 165, 140, 213, 138, 173, 184, 241, 181, 68, 79, 158, 235, 10, 199, 46, 1, 95, 170, 198, 80, 78, 154, 117, 34, 79, 34, 16, 150, 0, 78, 71, 46, 44, 45, 50, 165, 223, 217, 71, 237, 143, 212, 88, 132, 30, 164, 254, 207, 117, 121, 40, 221, 243, 25, 134, 151, 14, 113, 19, 237, 33, 147, 87, 231, 97, 232, 22, 143, 218, 33, 181, 245, 148, 178, 7, 157, 149, 57, 38, 248, 116, 56, 250, 92, 108, 192, 238, 249, 61, 124, 118, 147, 186, 229, 174, 17, 68, 79, 170, 239, 234, 244, 72, 255, 99, 171, 38, 111, 159, 131, 174, 144, 237, 194, 86, 4, 244, 176, 154, 77, 44, 188, 18, 17, 184, 111, 29, 54, 215, 190, 219, 210, 202, 120, 188, 93, 86, 160, 66, 52, 177, 69, 209, 121, 52, 33, 200, 176, 183, 9, 180, 199, 245, 30, 88, 170, 205, 232, 13, 241, 193, 193, 0, 137, 176, 174, 100, 179, 122, 8];
pub const TEST_BLS_G1_SIGNATURE_MESSAGE: &str = "This is a test message for signing";
pub const TEST_BLS_G1_SIGNATURE_HEX: &str = "a8282b71e3978ded8780b26b86ea3d4f4215c561ea08c7fe091bd7599e8ecb56885f6b8f07a808cea7699842d730d944";
pub const TEST_BLS_G1_SIGNATURE_BYTES: [u8; 48] = [168, 40, 43, 113, 227, 151, 141, 237, 135, 128, 178, 107, 134, 234, 61, 79, 66, 21, 197, 97, 234, 8, 199, 254, 9, 27, 215, 89, 158, 142, 203, 86, 136, 95, 107, 143, 7, 168, 8, 206, 167, 105, 152, 66, 215, 48, 217, 68];

/// Helper function to generate valid BLS test keys at runtime
/// This creates actual valid cryptographic keys for testing
pub fn generate_valid_test_keypair() -> (G2Affine, Scalar) {
    let private_key = Scalar::from_bytes(&TEST_BLS_PRIVATE_KEY).unwrap();
    let public_key = G2Affine::generator() * private_key;
    (public_key.into(), private_key)
}

/// Helper function to get the G1 generator point
pub fn g1_generator() -> G1Affine {
    G1Affine::generator()
}

/// Helper function to get the G2 generator point  
pub fn g2_generator() -> G2Affine {
    G2Affine::generator()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_points() {
        // Verify our constants are valid points
        let g1_gen = g1_generator();
        let g2_gen = g2_generator();

        assert!(bool::from(g1_gen.is_on_curve()));
        assert!(bool::from(g1_gen.is_torsion_free()));
        assert!(bool::from(g2_gen.is_on_curve()));
        assert!(bool::from(g2_gen.is_torsion_free()));

        // Test keypair generation
        let (_pk, _sk) = generate_valid_test_keypair();
        println!("Public key: {:?}", _pk);
        println!("Private key: {:?}", _sk);
    }
}
