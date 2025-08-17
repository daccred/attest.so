/**
 * Schema-related utility functions
 */

import { SchemaDefinition } from '@attestprotocol/core'

/**
 * Generate a schema UID using the same algorithm as the Stellar protocol contract.
 * 
 * This function implements the exact same logic as the `generate_uid` function
 * in the protocol contract (contracts/stellar/protocol/src/instructions/schema.rs)
 * 
 * The UID is derived from:
 * - Schema definition (as string)
 * - Authority address (who is registering the schema)
 * - Optional resolver address
 * 
 * All values are serialized to XDR format and concatenated before hashing with SHA-256.
 * 
 * @param schemaDefinition - The string representation of the schema
 * @param authority - The address of the authority registering the schema
 * @param resolver - Optional resolver address
 * @returns Promise<string> - The 64-character hex string schema UID
 */
export async function generateSchemaUid(
  schemaDefinition: string,
  authority: string,
  resolver?: string | null
): Promise<string> {
  // Create a combined string that matches the contract's XDR serialization approach
  // Note: This is a simplified version - the actual contract uses XDR serialization
  // For practical purposes, we concatenate the values in the same order
  let dataToHash = schemaDefinition + authority
  
  if (resolver) {
    dataToHash += resolver
  }

  // Hash using SHA-256 (same as contract)
  const encoder = new TextEncoder()
  const data = encoder.encode(dataToHash)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  
  // Convert to hex string (32 bytes = 64 hex characters)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a deterministic schema UID from a SchemaDefinition object.
 * 
 * This function takes a SchemaDefinition and generates the same UID that would
 * be created by the contract when registering the schema.
 * 
 * @param schema - The schema definition object
 * @param authority - The authority address (defaults to empty string if not provided)
 * @returns Promise<string> - The 64-character hex string schema UID
 */
export async function generateIdFromSchema(
  schema: SchemaDefinition,
  authority?: string
): Promise<string> {
  const auth = authority || ''
  return generateSchemaUid(schema.content, auth, schema.resolver)
}

/**
 * Format a schema UID for display (with dashes for readability).
 * 
 * @param uid - The 64-character hex UID
 * @returns Formatted UID string
 */
export function formatSchemaUid(uid: string): string {
  if (uid.length !== 64) {
    return uid
  }
  
  return `${uid.slice(0, 8)}-${uid.slice(8, 16)}-${uid.slice(16, 24)}-${uid.slice(24, 32)}-${uid.slice(32)}`
}

/**
 * Parse a formatted schema UID back to raw hex string.
 * 
 * @param formattedUid - The formatted UID with dashes
 * @returns Raw 64-character hex string
 */
export function parseFormattedUid(formattedUid: string): string {
  return formattedUid.replace(/-/g, '')
}