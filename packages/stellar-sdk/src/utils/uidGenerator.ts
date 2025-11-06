/**
 * UID Generation Utilities
 *
 * Functions for generating deterministic UIDs for attestations and schemas
 * that match the Rust contract implementation exactly.
 */

import { Address, nativeToScVal } from '@stellar/stellar-sdk'
import { keccak256 } from 'js-sha3'
import { sha256 } from '@noble/hashes/sha2.js'

/**
 * Generate an attestation UID matching the Rust contract implementation.
 *
 * This function replicates the logic from `generate_attestation_uid` in the
 * Soroban smart contract, using XDR serialization and Keccak-256 hashing.
 *
 * @algorithm
 * - Converts schema UID to XDR representation
 * - Converts subject address to XDR representation
 * - Converts nonce to 8-byte big-endian buffer
 * - Concatenates all parts in the correct order
 * - Computes Keccak-256 hash of the concatenated buffer
 *
 * @param schemaUid - A 32-byte buffer representing the schema UID
 * @param subject - The Stellar public key string of the subject (e.g., "G...")
 * @param nonce - The nonce as a BigInt (corresponds to Rust u64)
 * @returns A 32-byte buffer representing the attestation UID
 */
export function generateAttestationUid(schemaUid: Buffer, subject: string, nonce: bigint): Buffer {
  if (!(schemaUid instanceof Buffer) || schemaUid.length !== 32) {
    throw new Error('schemaUid must be a 32-byte Buffer')
  }
  if (typeof subject !== 'string' || !subject.startsWith('G')) {
    throw new Error('subject must be a valid Stellar public key string')
  }
  if (typeof nonce !== 'bigint') {
    throw new Error('nonce must be a BigInt')
  }

  const schemaUidScVal = nativeToScVal(schemaUid)
  const schemaUidXdr = schemaUidScVal.toXDR()

  const subjectAddress = new Address(subject)
  const subjectScVal = subjectAddress.toScVal()
  const subjectXdr = subjectScVal.toXDR()

  const nonceBuffer = Buffer.alloc(8)
  nonceBuffer.writeBigUInt64BE(nonce, 0)

  const hashInput = Buffer.concat([schemaUidXdr, subjectXdr, nonceBuffer])

  const hash = keccak256(hashInput)

  return Buffer.from(hash, 'hex')
}

/**
 * Generate a schema UID matching the Rust contract implementation.
 *
 * This function replicates the logic from `generate_schema_uid` in the
 * Soroban smart contract, using XDR serialization and SHA-256 hashing.
 *
 * @algorithm
 * 1. Convert definition string to XDR representation
 * 2. Convert authority address to XDR representation
 * 3. Convert resolver address to XDR representation (if provided)
 * 4. Concatenate all XDR components in the correct order
 * 5. Compute SHA-256 hash of the concatenated buffer
 *
 * @param definition - The schema definition string
 * @param authority - The authority address registering the schema
 * @param resolver - Optional resolver address
 * @returns A 32-byte buffer representing the schema UID
 */
export function generateSchemaUid(definition: string, authority: string, resolver?: string): Buffer {
  if (!definition || typeof definition !== 'string') {
    throw new Error('definition must be a non-empty string')
  }
  if (!authority || typeof authority !== 'string') {
    throw new Error('authority must be a non-empty string')
  }

  const components: Buffer[] = []

  const definitionScVal = nativeToScVal(definition)
  components.push(definitionScVal.toXDR())

  try {
    const authorityAddress = new Address(authority)
    const authorityScVal = authorityAddress.toScVal()
    components.push(authorityScVal.toXDR())
  } catch {
    const authorityScVal = nativeToScVal(authority)
    components.push(authorityScVal.toXDR())
  }

  if (resolver) {
    try {
      const resolverAddress = new Address(resolver)
      const resolverScVal = resolverAddress.toScVal()
      components.push(resolverScVal.toXDR())
    } catch {
      const resolverScVal = nativeToScVal(resolver)
      components.push(resolverScVal.toXDR())
    }
  }

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
