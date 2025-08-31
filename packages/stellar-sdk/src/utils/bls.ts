/**
 * BLS (Boneh-Lynn-Shacham) Cryptography Utilities
 * 
 * Functions for BLS key generation, signing, and verification
 * using the BLS12-381 curve for delegated attestations.
 */

import { bls12_381 } from '@noble/curves/bls12-381'
import { BlsKeyPair, VerificationResult } from '../types'

/**
 * Generate a new BLS key pair for delegation.
 * 
 * @returns A BLS key pair with uncompressed public key (192 bytes) and private key (32 bytes)
 */
export function generateBlsKeys(): BlsKeyPair {
  // Generate random private key (32 bytes)
  const privateKey = bls12_381.utils.randomPrivateKey()
  
  // Get the public key from private key
  const publicKeyPoint = bls12_381.G2.ProjectivePoint.fromPrivateKey(privateKey)
  
  // Convert to uncompressed format (192 bytes for G2 point)
  const publicKey = publicKeyPoint.toRawBytes(false) // false = uncompressed
  
  return {
    publicKey: Buffer.from(publicKey),
    privateKey: Buffer.from(privateKey)
  }
}

/**
 * Sign a message with a BLS private key.
 * 
 * @param message - The message to sign (should be hashed already)
 * @param privateKey - The BLS private key
 * @returns The signature as a Buffer
 */
export function signMessage(message: Buffer, privateKey: Buffer): Buffer {
  // Sign the message using BLS short signatures
  const signature = bls12_381.sign(message, privateKey)
  return Buffer.from(signature)
}

/**
 * Verify a BLS signature and optionally extract metadata.
 * 
 * @param signedMessage - The signature to verify
 * @param publicKey - The BLS public key (192 bytes uncompressed)
 * @param expectedMessage - Optional expected message for validation
 * @returns Verification result with validity and optional metadata
 */
export function verifySignature(
  signedMessage: Buffer,
  publicKey: Buffer,
  expectedMessage?: Buffer
): VerificationResult {
  try {
    // If we have an expected message, verify against it
    if (expectedMessage) {
      const isValid = bls12_381.verify(signedMessage, expectedMessage, publicKey)
      
      return {
        isValid,
        metadata: isValid ? {
          originalMessage: expectedMessage,
          inputs: {}
        } : undefined
      }
    }
    
    // Without expected message, just check if signature is valid format
    // This is a basic check - real verification needs the message
    if (signedMessage.length !== 96) { // G1 point compressed size
      return {
        isValid: false
      }
    }
    
    // Try to parse as a valid G1 point (signature)
    try {
      // This will throw if not a valid point
      bls12_381.G1.ProjectivePoint.fromHex(signedMessage.toString('hex'))
      
      return {
        isValid: true,
        metadata: {
          originalMessage: Buffer.from([]),
          inputs: {
            signatureLength: signedMessage.length,
            publicKeyLength: publicKey.length
          }
        }
      }
    } catch {
      return {
        isValid: false
      }
    }
  } catch (error: any) {
    return {
      isValid: false
    }
  }
}

/**
 * Aggregate multiple BLS signatures into one.
 * 
 * @param signatures - Array of signatures to aggregate
 * @returns The aggregated signature
 */
export function aggregateSignatures(signatures: Buffer[]): Buffer {
  if (signatures.length === 0) {
    throw new Error('Cannot aggregate empty signature array')
  }
  
  // Convert buffers to the right format for aggregation
  const sigs = signatures.map(sig => sig)
  
  // Use the library's aggregation function
  const aggregated = bls12_381.aggregateSignatures(sigs)
  
  return Buffer.from(aggregated)
}

/**
 * Aggregate multiple BLS public keys into one.
 * 
 * @param publicKeys - Array of public keys to aggregate
 * @returns The aggregated public key
 */
export function aggregatePublicKeys(publicKeys: Buffer[]): Buffer {
  if (publicKeys.length === 0) {
    throw new Error('Cannot aggregate empty public key array')
  }
  
  // Convert buffers to points and aggregate
  const points = publicKeys.map(pk => 
    bls12_381.G2.ProjectivePoint.fromHex(pk.toString('hex'))
  )
  
  // Add all points together
  let aggregated = points[0]
  for (let i = 1; i < points.length; i++) {
    aggregated = aggregated.add(points[i])
  }
  
  return Buffer.from(aggregated.toRawBytes(false))
}

/**
 * Verify an aggregated signature against multiple messages and public keys.
 * 
 * @param aggregatedSignature - The aggregated signature
 * @param messages - Array of messages that were signed
 * @param publicKeys - Array of corresponding public keys
 * @returns True if the aggregated signature is valid
 */
export function verifyAggregateSignature(
  aggregatedSignature: Buffer,
  messages: Buffer[],
  publicKeys: Buffer[]
): boolean {
  if (messages.length !== publicKeys.length) {
    throw new Error('Number of messages must match number of public keys')
  }
  
  try {
    return bls12_381.verifyBatch(aggregatedSignature, messages, publicKeys)
  } catch {
    return false
  }
}

/**
 * Convert a BLS public key from compressed to uncompressed format.
 * 
 * @param compressedKey - The compressed public key (96 bytes)
 * @returns The uncompressed public key (192 bytes)
 */
export function decompressPublicKey(compressedKey: Buffer): Buffer {
  if (compressedKey.length !== 96) {
    throw new Error('Compressed G2 public key must be 96 bytes')
  }
  
  const point = bls12_381.G2.ProjectivePoint.fromHex(compressedKey.toString('hex'))
  return Buffer.from(point.toRawBytes(false))
}

/**
 * Convert a BLS public key from uncompressed to compressed format.
 * 
 * @param uncompressedKey - The uncompressed public key (192 bytes)
 * @returns The compressed public key (96 bytes)
 */
export function compressPublicKey(uncompressedKey: Buffer): Buffer {
  if (uncompressedKey.length !== 192) {
    throw new Error('Uncompressed G2 public key must be 192 bytes')
  }
  
  const point = bls12_381.G2.ProjectivePoint.fromHex(uncompressedKey.toString('hex'))
  return Buffer.from(point.toRawBytes(true))
}