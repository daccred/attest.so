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
}) 