/**
 * Common Schema Definitions for Stellar Attestations
 *
 * This file provides a set of pre-defined, common schema encoders for use cases
 * like identity verification, academic credentials, and professional certifications.
 * These can be used as-is or as a starting point for custom schemas.
 *
 * @packageDocumentation
 */

import { SorobanSchemaEncoder, StellarDataType } from '../src'



/**
 * Pre-defined schema encoders for common use cases
 */
export class SchemaRegistry {
  private static schemas = new Map<string, SorobanSchemaEncoder>()

  /**
   * Register a schema encoder
   */
  static register(name: string, encoder: SorobanSchemaEncoder): void {
    this.schemas.set(name, encoder)
  }

  /**
   * Get a registered schema encoder
   */
  static get(name: string): SorobanSchemaEncoder | undefined {
    return this.schemas.get(name)
  }

  /**
   * List all registered schema names
   */
  static list(): string[] {
    return Array.from(this.schemas.keys())
  }
}

/**
 * Registers the set of common, pre-defined schemas with the SchemaRegistry.
 * This function can be called to populate the registry with schemas for
 * identity verification, academic credentials, and professional certifications.
 *
 * @example
 * ```typescript
 * import { registerCommonSchemas } from './common-schemas';
 *
 * // Register all common schemas
 * registerCommonSchemas();
 *
 * // Now you can retrieve a schema
 * const identitySchema = SchemaRegistry.get('identity-verification');
 * ```
 */
export function registerCommonSchemas(): void {
  // Identity verification schema
  SchemaRegistry.register('identity-verification', new SorobanSchemaEncoder({
    name: 'Identity Verification',
    version: '1.0.0',
    description: 'Standard identity verification attestation',
    fields: [
      { name: 'fullName', type: StellarDataType.STRING, description: 'Legal full name' },
      { name: 'dateOfBirth', type: StellarDataType.TIMESTAMP, description: 'Date of birth' },
      { name: 'nationality', type: StellarDataType.STRING, description: 'Nationality' },
      { name: 'documentType', type: StellarDataType.STRING, validation: { enum: ['passport', 'drivers_license', 'national_id'] } },
      { name: 'verificationLevel', type: StellarDataType.STRING, validation: { enum: ['basic', 'enhanced', 'premium'] } },
      { name: 'verifiedBy', type: StellarDataType.ADDRESS, description: 'Verifying authority address' }
    ]
  }))

  // Academic credential schema
  SchemaRegistry.register('academic-credential', new SorobanSchemaEncoder({
    name: 'Academic Credential',
    version: '1.0.0', 
    description: 'University degree or academic achievement',
    fields: [
      { name: 'studentName', type: StellarDataType.STRING, description: 'Name of the student' },
      { name: 'institution', type: StellarDataType.STRING, description: 'Educational institution' },
      { name: 'degree', type: StellarDataType.STRING, description: 'Type of degree' },
      { name: 'fieldOfStudy', type: StellarDataType.STRING, description: 'Major or field' },
      { name: 'graduationDate', type: StellarDataType.TIMESTAMP, description: 'Graduation date' },
      { name: 'gpa', type: StellarDataType.U32, optional: true, validation: { min: 0, max: 400 } }, // GPA * 100
      { name: 'honors', type: StellarDataType.STRING, optional: true, validation: { enum: ['summa_cum_laude', 'magna_cum_laude', 'cum_laude', 'none'] } }
    ]
  }))

  // Professional certification schema
  SchemaRegistry.register('professional-certification', new SorobanSchemaEncoder({
    name: 'Professional Certification',
    version: '1.0.0',
    description: 'Professional certification or license',
    fields: [
      { name: 'holderName', type: StellarDataType.STRING, description: 'Certification holder name' },
      { name: 'certificationName', type: StellarDataType.STRING, description: 'Name of certification' },
      { name: 'issuingOrganization', type: StellarDataType.STRING, description: 'Issuing organization' },
      { name: 'certificationNumber', type: StellarDataType.STRING, description: 'Certification number' },
      { name: 'issueDate', type: StellarDataType.TIMESTAMP, description: 'Issue date' },
      { name: 'expirationDate', type: StellarDataType.TIMESTAMP, optional: true, description: 'Expiration date' },
      { name: 'level', type: StellarDataType.STRING, validation: { enum: ['entry', 'associate', 'professional', 'expert', 'master'] } }
    ]
  }))
} 