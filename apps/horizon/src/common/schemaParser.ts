/**
 * Schema Parser Utility
 * 
 * Provides utilities for parsing schema definitions from various formats
 * (XDR, JSON Schema, or Schema String) into JSONSchema equivalents using
 * the SorobanSchemaEncoder from @attestprotocol/stellar-sdk.
 */

import { SorobanSchemaEncoder } from '@attestprotocol/stellar-sdk'


/**
 * Attempts to parse a schema definition string and convert it to JSONSchema.
 * 
 * This function can handle:
 * - XDR format (prefixed with "XDR:")
 * - JSON Schema objects (as JSON strings)
 * - Soroban Schema definitions (as JSON strings)
 * 
 * @param defString - The schema definition string to parse
 * @returns The JSONSchema representation of the schema, or undefined if parsing fails
 */
export function parseSchemaDefinition(defString: string): Record<string, any> | undefined {
  if (!defString || typeof defString !== 'string') {
    return undefined
  }

  try {
    // Case 1: XDR format (starts with "XDR:")
    if (defString.startsWith('XDR:')) {
      console.log('🔍 Detected XDR schema format, parsing with SorobanSchemaEncoder...')
      const encoder = SorobanSchemaEncoder.fromXDR(defString)
      return encoder.toJSONSchema()
    }

    // Case 2: Try to parse as JSON
    let parsedSchema: any
    try {
      parsedSchema = JSON.parse(defString)
    } catch (jsonError) {
      console.warn('⚠️ Schema definition is not valid JSON:', jsonError)
      return undefined
    }

    // Case 3: Check if it's already a JSON Schema (has $schema property)
    if (parsedSchema.$schema) {
      console.log('🔍 Detected JSON Schema format, returning as-is')
      return parsedSchema
    }

    // Case 4: Check if it's a Soroban Schema Definition (has name and fields properties)
    if (parsedSchema.name && Array.isArray(parsedSchema.fields)) {
      console.log('🔍 Detected Soroban Schema Definition, converting to JSON Schema...')
      const encoder = new SorobanSchemaEncoder(parsedSchema)
      return encoder.toJSONSchema()
    }

    // Case 5: Try to create encoder from JSON Schema format
    if (parsedSchema.properties) {
      console.log('🔍 Detected JSON Schema properties, converting via SorobanSchemaEncoder...')
      const encoder = SorobanSchemaEncoder.fromJSONSchema(parsedSchema)
      return encoder.toJSONSchema()
    }

    console.warn('⚠️ Unrecognized schema format, returning parsed JSON as fallback')
    return parsedSchema

  } catch (error: any) {
    console.warn(`⚠️ Failed to parse schema definition: ${error.message}`)
    return undefined
  }
}

/**
 * Validates if a string is a valid XDR schema format
 * @param defString - The definition string to check
 * @returns true if it's a valid XDR format
 */
export function isXDRFormat(defString: string): boolean {
  return typeof defString === 'string' && defString.startsWith('XDR:')
}

/**
 * Validates if a parsed object is a Soroban Schema Definition
 * @param obj - The object to check
 * @returns true if it's a valid Soroban Schema Definition
 */
export function isSorobanSchemaDefinition(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.name === 'string' &&
    Array.isArray(obj.fields) &&
    obj.fields.length > 0
  )
}

/**
 * Validates if a parsed object is a JSON Schema
 * @param obj - The object to check
 * @returns true if it appears to be a JSON Schema
 */
export function isJSONSchema(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    (obj.$schema || obj.properties || obj.type === 'object')
  )
}