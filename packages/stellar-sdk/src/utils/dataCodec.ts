/**
 * Schema Encoding/Decoding Utilities
 *
 * Functions for encoding and decoding schema definitions to/from XDR format
 * compatible with the Stellar Attest Protocol.
 */

import { SorobanSchemaEncoder, StellarSchemaDefinition } from '../common/schemaEncoder'

/**
 * Encode a schema definition to XDR string format.
 *
 * @param schema - The schema definition object
 * @returns XDR-encoded string with "XDR:" prefix
 */
export function encodeSchema(schema: StellarSchemaDefinition): string {
  const encoder = new SorobanSchemaEncoder(schema)
  return encoder.toXDR()
}

/**
 * Decode a schema from XDR or JSON format.
 *
 * @param encoded - The encoded schema string (XDR or JSON)
 * @returns The decoded schema definition
 */
export function decodeSchema(encoded: string): StellarSchemaDefinition {
  // Check if it's XDR format
  if (encoded.startsWith('XDR:') || encoded.includes('AAAA')) {
    const decodedEncoder = SorobanSchemaEncoder.fromXDR(encoded)
    return decodedEncoder.getSchema()
  }

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(encoded)
    // If it's a valid schema object, return it
    if (parsed.name && parsed.version && parsed.fields) {
      return parsed as StellarSchemaDefinition
    }
    throw new Error('Invalid JSON schema format')
  } catch {
    // If not JSON, try as raw XDR without prefix
    const withPrefix = encoded.startsWith('XDR:') ? encoded : `XDR:${encoded}`
    const decodedEncoder = SorobanSchemaEncoder.fromXDR(withPrefix)
    return decodedEncoder.getSchema()
  }
}

/**
 * Validate a schema definition.
 *
 * @param schema - The schema definition to validate
 * @returns True if valid, throws error if invalid
 */
export function validateSchema(schema: StellarSchemaDefinition): boolean {
  // Creating the encoder will validate the schema
  new SorobanSchemaEncoder(schema)
  return true
}

/**
 * Create a simple schema definition for testing.
 *
 * @param name - Schema name
 * @param fields - Array of field definitions
 * @returns A schema definition object
 */
export function createSimpleSchema(
  name: string,
  fields: Array<{ name: string; type: string; optional?: boolean }>
): StellarSchemaDefinition {
  return {
    name,
    version: '1.0',
    description: `Schema for ${name}`,
    fields: fields.map((field) => ({
      name: field.name,
      type: field.type as any, // Will be validated by encoder
      optional: field.optional ?? false,
    })),
  }
}
