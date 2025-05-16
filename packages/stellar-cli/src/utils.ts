import fs from 'fs'
import path from 'path'
import { logger } from './logger'

export const handleJsonFile = async (jsonFile: any) => {
  try {
    const filePath = path.resolve(jsonFile)

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }

    // Check file extension
    if (!filePath.toLowerCase().endsWith('.json')) {
      throw new Error('File must have a .json extension')
    }

    // Read and parse file
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    try {
      const jsonData = JSON.parse(fileContent)
      return jsonData
    } catch (parseError) {
      throw new Error('Invalid JSON format in file')
    }
  } catch (error: any) {
    logger.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Validates a JSON schema according to JSON Schema standards
 * @param schema The schema object to validate
 * @returns Error message string or null if valid
 */
export const checkValidJSONContent = (schema: any): string | null => {
  // Check for schema
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    return 'Invalid schema: must be an object.'
  }

  // Check for name
  if (typeof schema.name !== 'string') {
    return 'Invalid schema: name is required and must be a string.'
  }

  // Check for type
  if (typeof schema.type !== 'string' || schema.type !== 'object') {
    return 'Invalid schema: type is required and must be "object".'
  }

  // Check for properties
  if (typeof schema.properties !== 'object' || schema.properties === null) {
    return 'Invalid schema: properties is required and must be an object.'
  }

  // Check for required fields
  if (!Array.isArray(schema.required)) {
    return 'Invalid schema: required is required and must be an array.'
  }

  // Validate each property in properties
  for (const key in schema.properties) {
    const property = schema.properties[key]
    if (typeof property !== 'object' || property === null) {
      return `Invalid schema: properties.${key} must be an object.`
    }

    if (typeof property.type !== 'string') {
      return `Invalid schema: properties.${key}.type is required and must be a string.`
    }

    // Additional checks for specific types can be added here if needed
    // For example, checking maxLength for string types
    if (property.type === 'string' && typeof property.maxLength !== 'undefined') {
      if (typeof property.maxLength !== 'number') {
        return `Invalid schema: properties.${key}.maxLength must be a number.`
      }
    }

    if (property.type === 'integer' && typeof property.minimum !== 'undefined') {
      if (typeof property.minimum !== 'number') {
        return `Invalid schema: properties.${key}.minimum must be a number.`
      }
    }
  }

  return null // All checks passed
}

/**
 * Validates a Stellar schema object
 * @param content The schema content to validate
 * @returns Error message string or null if valid
 */
export const validateStellarSchema = (content: any): string | null => {
  if (!content) {
    return 'Schema content is required'
  }

  if (typeof content !== 'object') {
    return 'Schema must be an object'
  }

  // Check required fields for schema - accept either naming convention
  if (!content.schemaName && !content.name) {
    return 'Schema must have a schemaName or name property'
  }

  if (!content.schemaContent && !content.schema) {
    return 'Schema must have a schemaContent or schema property'
  }

  // Validate schema structure if it's meant to be a JSON schema
  const schemaToValidate = content.schemaContent || content.schema
  if (typeof schemaToValidate === 'object') {
    return checkValidJSONContent(schemaToValidate)
  }

  return null // All checks passed
}

/**
 * Validates a Stellar attestation object
 * @param content The attestation content to validate
 * @param schemaUid The schema UID (required reference)
 * @returns Error message string or null if valid
 */
export const validateStellarAttestation = (content: any, schemaUid?: string): string | null => {
  if (!content) {
    return 'Attestation content is required'
  }

  if (typeof content !== 'object') {
    return 'Attestation must be an object'
  }

  // Check if data is present (accepting either naming convention)
  if (!content.data && !content.attestationData) {
    return 'Attestation must have a data or attestationData property'
  }

  // Schema UID is required for creating attestations
  if (!schemaUid) {
    return 'Schema UID is required for creating attestations'
  }

  return null // All checks passed
}
