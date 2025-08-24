//! # BLS G2 Generator Sanity Checks
//!
//! This test file is a standalone utility for auditing and verifying the canonical
//! G2 generator point for the BLS12-381 curve. Its purpose is to provide high
//! confidence that the cryptographic constants used in the contract are correct
//! and compatible with multiple, independent BLS libraries.
//!
//! **It does not test any contract logic.** Instead, it tests the underlying
//! cryptographic libraries themselves.

// --- Explicit Imports ---
// By declaring all `use` statements at the top, we can easily see all external
// dependencies of this test module.

// Primary BLS library for generating the reference point.
use bls12_381::G2Affine;

// A second, high-performance BLS library used for cross-verification.
use blst::min_sig::{PublicKey as BlstPublicKey, SecretKey as BlstSecretKey};

// Utility for encoding byte arrays as human-readable hexadecimal strings.
use hex;

// Rust standard library components for file system operations.
use std::fs::{create_dir_all, File};
use std::io::Write;

/// **Test: Dump and Verify `bls12_381` G2 Generator**
///
/// This test performs an internal sanity check on the `bls12_381` crate's G2 generator.
/// It verifies fundamental properties and ensures that serialization and deserialization
/// (both compressed and uncompressed) are self-consistent. The results are written
/// to a log file for auditing.
#[test]
fn dump_and_verify_g2_generator() {
    // 1. Get the canonical G2 generator from the `bls12_381` crate.
    let g2_generator = G2Affine::generator();

    // 2. Assert fundamental cryptographic invariants.
    // These checks confirm the point is valid according to curve mathematics.
    assert!(bool::from(g2_generator.is_on_curve()), "Generator must be on the curve");
    assert!(
        bool::from(g2_generator.is_torsion_free()),
        "Generator must be in the prime-order subgroup"
    );

    // 3. Serialize the point to its two standard byte representations.
    let compressed_bytes = g2_generator.to_compressed();
    let uncompressed_bytes = g2_generator.to_uncompressed();
    assert_eq!(compressed_bytes.len(), 96, "Compressed G2 point must be 96 bytes");
    assert_eq!(uncompressed_bytes.len(), 192, "Uncompressed G2 point must be 192 bytes");

    // 4. Perform a round-trip check to ensure deserialization works correctly.
    let g_from_compressed = G2Affine::from_compressed(&compressed_bytes).unwrap();
    let g_from_uncompressed = G2Affine::from_uncompressed(&uncompressed_bytes).unwrap();
    assert_eq!(g_from_compressed, g2_generator, "Compressed round-trip failed");
    assert_eq!(g_from_uncompressed, g2_generator, "Uncompressed round-trip failed");

    // 5. Write a clean, human-readable log file for auditing purposes.
    let _ = create_dir_all("target"); // Ensure the target directory exists.
    let mut log_file = File::create("target/__bls_generator__.log").expect("Failed to create log file");
    writeln!(log_file, "--- BLS12-381 G2 Generator Audit ---").unwrap();
    writeln!(log_file, "Source Crate: bls12_381").unwrap();
    writeln!(
        log_file,
        "Is On Curve      : {}",
        bool::from(g2_generator.is_on_curve())
    )
    .unwrap();
    writeln!(
        log_file,
        "Is Torsion-Free  : {}",
        bool::from(g2_generator.is_torsion_free())
    )
    .unwrap();
    writeln!(log_file, "------------------------------------------").unwrap();
    writeln!(log_file, "Compressed (96B) Hex   : {}", hex::encode(compressed_bytes)).unwrap();
    writeln!(log_file, "Compressed (96B) Bytes : {:?}", compressed_bytes).unwrap();
    writeln!(log_file, "------------------------------------------").unwrap();
    writeln!(log_file, "Uncompressed (192B) Hex: {}", hex::encode(uncompressed_bytes)).unwrap();
    writeln!(log_file, "Uncompressed (192B) Bytes: {:?}", uncompressed_bytes).unwrap();

    println!("Wrote G2 generator dump to target/__bls_generator__.log");
}

/// **Test: Cross-Check G2 Generator Between `bls12_381` and `blst` Crates**
///
/// This test provides extremely high confidence by verifying that two independent,
/// reputable BLS libraries agree on the exact value and byte representation of the
/// G2 generator point. This is crucial for ensuring interoperability with off-chain
/// signing tools that may use a different library (like `blst`).
#[test]
fn cross_check_g2_generator_between_crates() {
    // --- Part 1: Generate the reference point using `bls12_381` ---
    let reference_generator = G2Affine::generator();
    let ref_compressed = reference_generator.to_compressed();
    let ref_uncompressed = reference_generator.to_uncompressed();

    // --- Part 2: Verify the reference bytes using the `blst` library ---

    // 2a. Check if `blst` can parse and validate the bytes from `bls12_381`.
    let pk_from_comp = BlstPublicKey::from_bytes(&ref_compressed).expect("blst failed to parse compressed bytes");
    let pk_from_uncomp = BlstPublicKey::from_bytes(&ref_uncompressed).expect("blst failed to parse uncompressed bytes");

    pk_from_comp.validate().expect("blst rejected compressed point");
    pk_from_uncomp.validate().expect("blst rejected uncompressed point");

    // 2b. Check if `blst` re-serializes to the exact same byte representation.
    assert_eq!(
        pk_from_comp.compress(),
        ref_compressed,
        "blst vs bls12_381 compressed mismatch"
    );
    assert_eq!(
        pk_from_uncomp.serialize(),
        ref_uncompressed,
        "blst vs bls12_381 uncompressed mismatch"
    );

    // 2c. Check if `blst` derives the same generator from a secret key of 1.
    // This proves mathematically that both crates are using the same generator point.
    let sk_one = {
        let mut b = [0u8; 32];
        b[31] = 1; // A secret key scalar with a value of 1 (big-endian).
        BlstSecretKey::from_bytes(&b).expect("blst failed to create secret key of 1")
    };
    let generator_from_blst = sk_one.sk_to_pk();
    assert_eq!(
        generator_from_blst.compress(),
        ref_compressed,
        "Generator value mismatch between crates"
    );

    // --- Part 3: Write a detailed audit log ---
    let _ = create_dir_all("target");
    let mut log_file = File::create("target/__bls_cross_check__.log").expect("Failed to create log file");
    writeln!(log_file, "--- Cross-Check BLS12-381 G2 Generator ---").unwrap();
    writeln!(log_file, "Reference Crate: bls12_381").unwrap();
    writeln!(log_file, "Verification Crate: blst").unwrap();
    writeln!(log_file, "------------------------------------------").unwrap();
    writeln!(log_file, "Ref Compressed (96B) Hex   : {}", hex::encode(ref_compressed)).unwrap();
    writeln!(log_file, "Ref Compressed (96B) Bytes : {:?}", ref_compressed).unwrap();
    writeln!(log_file, "------------------------------------------").unwrap();
    writeln!(
        log_file,
        "Ref Uncompressed (192B) Hex: {}",
        hex::encode(ref_uncompressed)
    )
    .unwrap();
    writeln!(log_file, "Ref Uncompressed (192B) Bytes: {:?}", ref_uncompressed).unwrap();
    writeln!(log_file, "------------------------------------------").unwrap();
    writeln!(
        log_file,
        "blst valid(compressed)?   : {}",
        pk_from_comp.validate().is_ok()
    )
    .unwrap();
    writeln!(
        log_file,
        "blst valid(uncompressed)? : {}",
        pk_from_uncomp.validate().is_ok()
    )
    .unwrap();
    writeln!(
        log_file,
        "blst re-compress matches?   : {}",
        pk_from_comp.compress() == ref_compressed
    )
    .unwrap();
    writeln!(
        log_file,
        "blst sk=1 matches?          : {}",
        generator_from_blst.compress() == ref_compressed
    )
    .unwrap();

    println!("Wrote G2 generator cross-check to target/__bls_cross_check__.log");
}
