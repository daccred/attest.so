/**
 * Standardized schema encoder functions
 */

import { SorobanSchemaEncoder, StellarDataType, type StellarSchemaDefinition } from '../../src/common/schemaEncoder'
import { createTestKeypairs } from './keypairs'

/**
 * Create a standardized schema encoder for a given type.
 *
 * @param schemaType - The type of schema to create an encoder for
 * @returns SorobanSchemaEncoder instance
 */
export function createStandardizedSchemaEncoder(
  schemaType: 'identity' | 'degree' | 'certification' | 'employment'
): SorobanSchemaEncoder {
  const standardSchemas: Record<string, StellarSchemaDefinition> = {
    identity: {
      name: 'Identity Verification',
      description: 'Standardized identity verification attestation',
      fields: [
        { name: 'fullName', type: StellarDataType.STRING },
        { name: 'dateOfBirth', type: StellarDataType.TIMESTAMP },
        { name: 'nationality', type: StellarDataType.STRING },
        {
          name: 'documentType',
          type: StellarDataType.STRING,
          validation: { enum: ['passport', 'drivers_license', 'national_id', 'other'] },
        },
        { name: 'documentNumber', type: StellarDataType.STRING },
        {
          name: 'verificationLevel',
          type: StellarDataType.STRING,
          validation: { enum: ['basic', 'enhanced', 'premium'] },
        },
        { name: 'verificationDate', type: StellarDataType.TIMESTAMP },
        { name: 'verifiedBy', type: StellarDataType.ADDRESS },
      ],
      metadata: { category: 'identity', revocable: true, expirable: false },
    },
    degree: {
      name: 'Academic Degree',
      description: 'University degree or academic credential',
      fields: [
        { name: 'studentName', type: StellarDataType.STRING },
        { name: 'university', type: StellarDataType.STRING },
        { name: 'degree', type: StellarDataType.STRING },
        { name: 'fieldOfStudy', type: StellarDataType.STRING },
        { name: 'graduationDate', type: StellarDataType.TIMESTAMP },
        {
          name: 'gpa',
          type: StellarDataType.U32,
          optional: true,
          validation: { min: 0, max: 400 },
        },
        {
          name: 'honors',
          type: StellarDataType.STRING,
          optional: true,
          validation: { enum: ['summa_cum_laude', 'magna_cum_laude', 'cum_laude', 'none'] },
        },
      ],
      metadata: { category: 'education', revocable: false, expirable: false },
    },
    certification: {
      name: 'Professional Certification',
      description: 'Professional certification or license',
      fields: [
        { name: 'holderName', type: StellarDataType.STRING },
        { name: 'certificationName', type: StellarDataType.STRING },
        {
          name: 'issuingOrganization',
          type: StellarDataType.STRING,
        },
        { name: 'certificationNumber', type: StellarDataType.STRING },
        { name: 'issueDate', type: StellarDataType.TIMESTAMP },
        {
          name: 'expirationDate',
          type: StellarDataType.TIMESTAMP,
          optional: true,
        },
        { name: 'skillsValidated', type: 'array<string>' },
        {
          name: 'certificationLevel',
          type: StellarDataType.STRING,
          validation: { enum: ['entry', 'associate', 'professional', 'expert', 'master'] },
        },
      ],
      metadata: { category: 'professional', revocable: true, expirable: true },
    },
    employment: {
      name: 'Employment Verification',
      description: 'Employment history and status verification',
      fields: [
        { name: 'employeeName', type: StellarDataType.STRING },
        { name: 'employerName', type: StellarDataType.STRING },
        { name: 'jobTitle', type: StellarDataType.STRING },
        { name: 'department', type: StellarDataType.STRING, optional: true },
        {
          name: 'employmentType',
          type: StellarDataType.STRING,
          validation: { enum: ['full_time', 'part_time', 'contract', 'internship', 'consultant'] },
        },
        { name: 'startDate', type: StellarDataType.TIMESTAMP },
        { name: 'endDate', type: StellarDataType.TIMESTAMP, optional: true },
        { name: 'currentlyEmployed', type: StellarDataType.BOOL },
        {
          name: 'annualSalary',
          type: StellarDataType.AMOUNT,
          optional: true,
        },
        {
          name: 'performanceRating',
          type: StellarDataType.STRING,
          optional: true,
          validation: { enum: ['outstanding', 'exceeds_expectations', 'meets_expectations', 'needs_improvement'] },
        },
      ],
      metadata: { category: 'employment', revocable: true, expirable: false },
    },
  }

  return new SorobanSchemaEncoder(standardSchemas[schemaType])
}

/**
 * Encode attestation data using standardized schema.
 *
 * @param schemaType - Type of schema to use for encoding
 * @param data - Raw attestation data
 * @returns Encoded attestation data ready for contract submission
 */
export async function encodeStandardizedAttestation(
  schemaType: 'identity' | 'degree' | 'certification' | 'employment',
  data: Record<string, any>
) {
  const encoder = createStandardizedSchemaEncoder(schemaType)
  return encoder.encodeData(data)
}

/**
 * Create standardized test data that works with schema encoders.
 *
 * @param schemaType - Type of standardized data to create
 * @returns Data that validates against the standardized schema
 */
export function createStandardizedTestData(
  schemaType: 'identity' | 'degree' | 'certification' | 'employment'
): Record<string, any> {
  const testKeypairs = createTestKeypairs()
  const now = Date.now()

  const standardData = {
    identity: {
      fullName: 'John Alexander Smith',
      dateOfBirth: new Date('1990-03-15').getTime(),
      nationality: 'United States',
      documentType: 'passport',
      documentNumber: 'sha256:a1b2c3d4e5f6789abcdef...',
      verificationLevel: 'enhanced',
      verificationDate: now,
      verifiedBy: testKeypairs.authorityPublic,
    },
    degree: {
      studentName: 'Alice Marie Johnson',
      university: 'Stanford University',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Computer Science',
      graduationDate: new Date('2023-06-15').getTime(),
      gpa: 380, // 3.80 GPA
      honors: 'magna_cum_laude',
    },
    certification: {
      holderName: 'Sarah Elizabeth Chen',
      certificationName: 'AWS Solutions Architect - Professional',
      issuingOrganization: 'Amazon Web Services',
      certificationNumber: 'AWS-SAP-2023-001234',
      issueDate: new Date('2023-09-20').getTime(),
      expirationDate: new Date('2026-09-20').getTime(),
      skillsValidated: ['Cloud Architecture Design', 'Security Best Practices', 'Cost Optimization'],
      certificationLevel: 'professional',
    },
    employment: {
      employeeName: 'Michael Rodriguez',
      employerName: 'Tech Innovations LLC',
      jobTitle: 'Senior Software Engineer',
      department: 'Engineering',
      employmentType: 'full_time',
      startDate: new Date('2022-01-15').getTime(),
      currentlyEmployed: true,
      annualSalary: 150000,
      performanceRating: 'exceeds_expectations',
    },
  }

  return standardData[schemaType]
}

/**
 * Convert between legacy JSON Schema format and standardized encoder format.
 *
 * @param jsonSchema - Legacy JSON schema object
 * @returns SorobanSchemaEncoder instance
 */
export function convertLegacySchema(jsonSchema: any): SorobanSchemaEncoder {
  return SorobanSchemaEncoder.fromJSONSchema(jsonSchema)
}

/**
 * Get the standardized schema definition for a given type.
 *
 * @param schemaType - Type of schema
 * @returns Schema definition object
 */
export function getStandardizedSchema(
  schemaType: 'identity' | 'degree' | 'certification' | 'employment'
): StellarSchemaDefinition {
  const encoder = createStandardizedSchemaEncoder(schemaType)
  return encoder.getSchema()
}

/**
 * Generate a schema hash that matches the contract's schema UID generation.
 *
 * @param schemaEncoder - Schema encoder instance
 * @param authority - Authority address
 * @returns Schema hash/UID
 */
export function generateSchemaHash(schemaEncoder: SorobanSchemaEncoder, authority: string): string {
  // For now, use the encoder's hash method
  // In production, this should match the exact contract implementation
  return schemaEncoder.getSchemaHash()
}
