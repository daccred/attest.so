import { describe, it, expect } from 'vitest'
import { SorobanSchemaEncoder, StellarDataType, SchemaValidationError } from '../src/common/schemaEncoder'

describe('SorobanSchemaEncoder with AJV', () => {
  const testSchema = {
    name: 'Test Schema',
    description: 'A test schema for validation',
    fields: [
      {
        name: 'name',
        type: StellarDataType.STRING,
        optional: false,
        description: 'User name'
      },
      {
        name: 'age',
        type: StellarDataType.U32,
        optional: false,
        validation: { min: 0, max: 150 }
      },
      {
        name: 'address',
        type: StellarDataType.ADDRESS,
        optional: false,
        description: 'Stellar address'
      },
      {
        name: 'amount',
        type: StellarDataType.AMOUNT,
        optional: true,
        validation: { min: 0 }
      },
      {
        name: 'timestamp',
        type: StellarDataType.TIMESTAMP,
        optional: true
      },
      {
        name: 'verified',
        type: StellarDataType.BOOL,
        optional: false
      }
    ]
  }

  it('should validate correct data', () => {
    const encoder = new SorobanSchemaEncoder(testSchema)
    
    const validData = {
      name: 'John Doe',
      age: 30,
      address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      amount: 1000,
      timestamp: Date.now(),
      verified: true
    }

    expect(() => encoder.validateData(validData)).not.toThrow()
  })

  it('should throw error for missing required field', () => {
    const encoder = new SorobanSchemaEncoder(testSchema)
    
    const invalidData = {
      name: 'John Doe',
      age: 30,
      // missing address
      verified: true
    }

    expect(() => encoder.validateData(invalidData)).toThrow(SchemaValidationError)
    expect(() => encoder.validateData(invalidData)).toThrow('Required field \'address\' is missing')
  })

  it('should throw error for invalid type', () => {
    const encoder = new SorobanSchemaEncoder(testSchema)
    
    const invalidData = {
      name: 'John Doe',
      age: 'thirty', // should be number
      address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      verified: true
    }

    expect(() => encoder.validateData(invalidData)).toThrow(SchemaValidationError)
  })

  it('should throw error for invalid Stellar address', () => {
    const encoder = new SorobanSchemaEncoder(testSchema)
    
    const invalidData = {
      name: 'John Doe',
      age: 30,
      address: 'invalid-address',
      verified: true
    }

    expect(() => encoder.validateData(invalidData)).toThrow(SchemaValidationError)
    expect(() => encoder.validateData(invalidData)).toThrow('has invalid format')
  })

  it('should validate number constraints', () => {
    const encoder = new SorobanSchemaEncoder(testSchema)
    
    const invalidData = {
      name: 'John Doe',
      age: 200, // exceeds max of 150
      address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      verified: true
    }

    expect(() => encoder.validateData(invalidData)).toThrow(SchemaValidationError)
  })

  it('should generate JSON Schema with custom formats', () => {
    const encoder = new SorobanSchemaEncoder(testSchema)
    const jsonSchema = encoder.toJSONSchema() as any

    expect(jsonSchema.properties.address.format).toBe('stellar-address')
    expect(jsonSchema.properties.amount.format).toBe('stellar-amount')
    expect(jsonSchema.properties.timestamp.format).toBe('stellar-timestamp')
  })

  it('should work with standardized schemas', () => {
    const identitySchema = {
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
      ]
    }

    const encoder = new SorobanSchemaEncoder(identitySchema)
    
    const validIdentityData = {
      fullName: 'John Alexander Smith',
      dateOfBirth: new Date('1990-03-15').getTime(),
      nationality: 'United States',
      documentType: 'passport',
      documentNumber: 'sha256:a1b2c3d4e5f6789abcdef...',
      verificationLevel: 'enhanced',
      verificationDate: Date.now(),
      verifiedBy: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    }

    expect(() => encoder.validateData(validIdentityData)).not.toThrow()
  })
}) 