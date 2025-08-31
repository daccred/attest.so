/**
 * UID Generation Utilities
 * 
 * Functions for generating deterministic UIDs for attestations and schemas
 * that match the Rust contract implementation exactly.
 */

import { Address, nativeToScVal } from '@stellar/stellar-sdk'
import { keccak256 } from 'js-sha3'
import { sha256 } from '@noble/hashes/sha2'

/**
 * Generate an attestation UID matching the Rust contract implementation.
 * 
 * This function replicates the logic from `generate_attestation_uid` in the
 * Soroban smart contract, using XDR serialization and Keccak-256 hashing.
 * 
 * @param schemaUid - A 32-byte buffer representing the schema UID
 * @param subject - The Stellar public key string of the subject (e.g., "G...")
 * @param nonce - The nonce as a BigInt (corresponds to Rust u64)
 * @returns A 32-byte buffer representing the attestation UID
 */
export function generateAttestationUid(
  schemaUid: Buffer, 
  subject: string, 
  nonce: bigint
): Buffer {
  // Validate inputs
  if (!(schemaUid instanceof Buffer) || schemaUid.length !== 32) {
    throw new Error('schemaUid must be a 32-byte Buffer')
  }
  if (typeof subject !== 'string' || !subject.startsWith('G')) {
    throw new Error('subject must be a valid Stellar public key string')
  }
  if (typeof nonce !== 'bigint') {
    throw new Error('nonce must be a BigInt')
  }

  // 1. Convert schema_uid to XDR
  const schemaUidScVal = nativeToScVal(schemaUid)
  const schemaUidXdr = schemaUidScVal.toXDR()

  // 2. Convert subject address to XDR
  const subjectAddress = new Address(subject)
  const subjectScVal = subjectAddress.toScVal()
  const subjectXdr = subjectScVal.toXDR()

  // 3. Convert nonce to 8-byte big-endian buffer
  const nonceBuffer = Buffer.alloc(8)
  nonceBuffer.writeBigUInt64BE(nonce, 0)

  // 4. Concatenate all parts in the correct order
  const hashInput = Buffer.concat([
    schemaUidXdr,
    subjectXdr,
    nonceBuffer,
  ])

  // 5. Compute Keccak-256 hash
  const hash = keccak256(hashInput)

  // 6. Return as Buffer
  return Buffer.from(hash, 'hex')
}

/**
 * Generate a schema UID matching the Rust contract implementation.
 * 
 * This function replicates the logic from `generate_schema_uid` in the
 * Soroban smart contract, using XDR serialization and SHA-256 hashing.
 * 
 * @param definition - The schema definition string
 * @param authority - The authority address registering the schema
 * @param resolver - Optional resolver address
 * @returns A 32-byte buffer representing the schema UID
 */
export function generateSchemaUid(
  definition: string,
  authority: string,
  resolver?: string
): Buffer {
  // Validate inputs
  if (!definition || typeof definition !== 'string') {
    throw new Error('definition must be a non-empty string')
  }
  if (!authority || typeof authority !== 'string') {
    throw new Error('authority must be a non-empty string')
  }
  
  // Convert to XDR format for proper serialization
  const components: Buffer[] = []
  
  // Add definition as XDR string
  const definitionScVal = nativeToScVal(definition)
  components.push(definitionScVal.toXDR())
  
  // Add authority address as XDR
  try {
    const authorityAddress = new Address(authority)
    const authorityScVal = authorityAddress.toScVal()
    components.push(authorityScVal.toXDR())
  } catch {
    // If not a valid address, treat as string
    const authorityScVal = nativeToScVal(authority)
    components.push(authorityScVal.toXDR())
  }
  
  // Add resolver if provided
  if (resolver) {
    try {
      const resolverAddress = new Address(resolver)
      const resolverScVal = resolverAddress.toScVal()
      components.push(resolverScVal.toXDR())
    } catch {
      // If not a valid address, treat as string
      const resolverScVal = nativeToScVal(resolver)
      components.push(resolverScVal.toXDR())
    }
  }
  
  // Concatenate and hash with SHA-256
  const hashInput = Buffer.concat(components)
  const hash = sha256(hashInput)
  
  return Buffer.from(hash)
}

/**
 * Format a UID for display (with dashes for readability).
 * 
 * @param uid - The 32-byte buffer or 64-character hex string
 * @returns Formatted UID string
 */
export function formatUid(uid: Buffer | string): string {
  const hexString = typeof uid === 'string' ? uid : uid.toString('hex')
  
  if (hexString.length !== 64) {
    return hexString
  }
  
  return `${hexString.slice(0, 8)}-${hexString.slice(8, 16)}-${hexString.slice(16, 24)}-${hexString.slice(24, 32)}-${hexString.slice(32)}`
}

/**
 * Parse a formatted UID back to raw buffer.
 * 
 * @param formattedUid - The formatted UID with dashes
 * @returns Raw 32-byte buffer
 */
export function parseFormattedUid(formattedUid: string): Buffer {
  const hexString = formattedUid.replace(/-/g, '')
  return Buffer.from(hexString, 'hex')
}