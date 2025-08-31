/**
 * Validation utility functions
 */

import { createStandardizedSchemaEncoder } from './standardizedSchemas'

/**
 * Validate attestation data against a schema type.
 * 
 * @param schemaType - Type of schema to validate against
 * @param data - Data to validate
 * @returns Validation result with any errors
 */
export function validateAttestationData(
  schemaType: 'identity' | 'degree' | 'certification' | 'employment',
  data: Record<string, any>
): { valid: boolean; errors: string[] } {
  try {
    const encoder = createStandardizedSchemaEncoder(schemaType)
    encoder.validateData(data)
    return { valid: true, errors: [] }
  } catch (error: any) {
    return { valid: false, errors: [error.message] }
  }
}