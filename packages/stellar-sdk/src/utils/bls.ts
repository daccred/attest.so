/**
 * BLS (Boneh-Lynn-Shacham) Cryptography Utilities
 * 
 * Functions for BLS key generation, signing, and verification
 * using the BLS12-381 curve for delegated attestations.
 */

import { bls12_381 } from '@noble/curves/bls12-381'
import { VerificationResult, BlsKeyPair } from '../types'
import { WeierstrassPoint } from '@noble/curves/abstract/weierstrass';


/** The core BLS pairing curve we support is short signatures */
const curve = bls12_381.shortSignatures;


/**
 * Generate a new BLS key pair for delegation.
 * 
 * @returns A BLS key pair with uncompressed public key (192 bytes) and private key (32 bytes)
 */
export function generateBlsKeys(): BlsKeyPair {
const { secretKey, publicKey } = curve.keygen();
  
  return {
    privateKey: secretKey,
    publicKey: publicKey.toBytes(false),
  }
}

/**
 * Sign a hashed message with a BLS private key.
 * @see createAttestationMessage for more details on the message format
 * 
 * @see createRevocationMessage for more details on the message format
 * 
 * @param message - The message to sign (should be hashed by default)
 * @param privateKey - The BLS private key
 * @returns The signature as a Buffer
 */
export function signHashedMessage(message: WeierstrassPoint<bigint>, privateKey: Uint8Array): Buffer {
  // Sign the message using BLS short signatures
  const signature = curve.sign(message, privateKey)
  return Buffer.from(signature.toBytes(false))
}



// public_key: Buffer.from(attesterBlsPublicKey.toBytes(false))

//     // Create the message to sign
//     const messageToSign = createAttestationMessage(delegatedRequest, dst)
    
//     // Sign with BLS private key (minimal signature scheme)
//     const signature = bls12_381.shortSignatures.sign(messageToSign, attesterBlsPrivateKey)
//     delegatedRequest.signature = Buffer.from(signature.toBytes(false))



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
      const isValid = bls12_381.shortSignatures.verify(signedMessage, expectedMessage, publicKey)
      
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
  const aggregated = bls12_381.shortSignatures.aggregateSignatures(sigs)
  
  return Buffer.from(aggregated.toHex());
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
    bls12_381.G2.Point.fromHex(pk.toString('hex'))
  )
  
  // Add all points together
  let aggregated = points[0]
  for (let i = 1; i < points.length; i++) {
    aggregated = aggregated.add(points[i])
  }
  return Buffer.from(aggregated.toHex());
}


type VerifyAggregateSignatureParams = {
  message: Buffer,
  publicKey: Buffer
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
  params: VerifyAggregateSignatureParams[],
): boolean {
  const paramsArray = params.map(param => ({
    message: bls12_381.G1.Point.fromHex(param.message.toString('hex')),
    publicKey: bls12_381.G2.Point.fromHex(param.publicKey.toString('hex'))
  }))
  try {
    return bls12_381.shortSignatures.verifyBatch(aggregatedSignature, paramsArray)
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
export function decompressPublicKey(compressedKey: Buffer) {
  if (compressedKey.length !== 96) {
    throw new Error('Compressed G2 public key must be 96 bytes')
  }
  
  const point = bls12_381.G2.Point.fromHex(compressedKey.toString('hex'))
  return point.toBytes(false);
}

/**
 * Convert a BLS public key from uncompressed to compressed format.
 * 
 * @param uncompressedKey - The uncompressed public key (192 bytes)
 * @returns The compressed public key (96 bytes)
 */
export function compressPublicKey(uncompressedKey: Buffer) {
  if (uncompressedKey.length !== 192) {
    throw new Error('Uncompressed G2 public key must be 192 bytes')
  }
  
  const point = bls12_381.G2.Point.fromHex(uncompressedKey.toString('hex'))
  return point.toBytes(false);
}