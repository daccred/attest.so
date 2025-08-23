/**
 * Stellar Schema Encoder - Standardized schema definition and data encoding for Stellar attestations
 * 
 * Provides type-safe schema definitions and encoding/decoding utilities.
 */

import { Address, xdr, Keypair } from '@stellar/stellar-sdk'

/**
 * Supported Stellar attestation data types
 */
export enum StellarDataType {
  STRING = 'string',
  BOOL = 'bool',
  U32 = 'u32',
  U64 = 'u64',
  I32 = 'i32',
  I64 = 'i64',
  I128 = 'i128',
  ADDRESS = 'address',
  BYTES = 'bytes',
  SYMBOL = 'symbol',
  ARRAY = 'array',
  OPTION = 'option',
  MAP = 'map',
  TIMESTAMP = 'timestamp',
  AMOUNT = 'amount'
}

/**
 * Schema field definition
 */
export interface SchemaField {
  name: string
  type: StellarDataType | string
  optional?: boolean
  description?: string
  validation?: {
    min?: number
    max?: number
    pattern?: string
    enum?: string[]
  }
}

/**
 * Complete schema definition with metadata
 */
export interface StellarSchemaDefinition {
  name: string
  version: string
  description: string
  fields: SchemaField[]
  metadata?: {
    category?: string
    tags?: string[]
    authority?: string
    revocable?: boolean
    expirable?: boolean
  }
}

/**
 * Encoded attestation data ready for contract submission
 */
export interface EncodedAttestationData {
  schemaHash: string
  encodedData: string
  decodedData: Record<string, any>
  schema: StellarSchemaDefinition
}

/**
 * Schema validation error
 */
export class SchemaValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'SchemaValidationError'
  }
}

/**
 * Stellar Schema Encoder - Provides standardized schema definition and data encoding
 */
export class StellarSchemaEncoder {
  private schema: StellarSchemaDefinition

  constructor(schema: StellarSchemaDefinition) {
    this.validateSchema(schema)
    this.schema = schema
  }

  /**
   * Get the schema definition
   */
  getSchema(): StellarSchemaDefinition {
    return { ...this.schema }
  }

  /**
   * Generate a unique hash for this schema
   */
  getSchemaHash(): string {
    const schemaString = JSON.stringify({
      name: this.schema.name,
      version: this.schema.version,
      fields: this.schema.fields.map(f => ({ name: f.name, type: f.type, optional: f.optional }))
    })
    
    const encoder = new TextEncoder()
    const data = encoder.encode(schemaString)
    return Array.from(new Uint8Array(data.slice(0, 32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Encode schema to XDR format for efficient storage and privacy
   */
  toXDR(): string {
    try {
      // Convert schema to XDR-encodable values
      const fieldsXdr = this.schema.fields.map(field => {
        // Convert field to XDR Value
        const fieldObj = xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('name'),
            val: xdr.ScVal.scvString(field.name)
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('type'),
            val: xdr.ScVal.scvString(field.type)
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('optional'),
            val: xdr.ScVal.scvBool(field.optional || false)
          }),
          ...(field.description ? [new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('description'),
            val: xdr.ScVal.scvString(field.description)
          })] : []),
          ...(field.validation ? [new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('validation'),
            val: this.validationToXdr(field.validation)
          })] : [])
        ])
        return fieldObj
      })

      // Create main schema XDR structure
      const schemaXdr = xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('name'),
          val: xdr.ScVal.scvString(this.schema.name)
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('version'),
          val: xdr.ScVal.scvString(this.schema.version)
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('description'),
          val: xdr.ScVal.scvString(this.schema.description)
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('fields'),
          val: xdr.ScVal.scvVec(fieldsXdr)
        })
      ])

      // Convert to XDR string
      const xdrString = schemaXdr.toXDR('base64')
      return `XDR:${xdrString}`
    } catch (error) {
      throw new SchemaValidationError(`Failed to encode schema to XDR: ${error}`)
    }
  }

  /**
   * Helper to convert validation rules to XDR
   */
  private validationToXdr(validation: any): xdr.ScVal {
    const entries: xdr.ScMapEntry[] = []
    
    if (validation.min !== undefined) {
      entries.push(new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('min'),
        val: xdr.ScVal.scvI128(new xdr.Int128Parts({
          hi: xdr.Uint64.fromString('0'),
          lo: xdr.Uint64.fromString(validation.min.toString())
        }))
      }))
    }
    
    if (validation.max !== undefined) {
      entries.push(new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('max'),
        val: xdr.ScVal.scvI128(new xdr.Int128Parts({
          hi: xdr.Uint64.fromString('0'),
          lo: xdr.Uint64.fromString(validation.max.toString())
        }))
      }))
    }
    
    if (validation.pattern) {
      entries.push(new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('pattern'),
        val: xdr.ScVal.scvString(validation.pattern)
      }))
    }
    
    if (validation.enum && validation.enum.length > 0) {
      const enumValues = validation.enum.map((val: string) => xdr.ScVal.scvString(val))
      entries.push(new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('enum'),
        val: xdr.ScVal.scvVec(enumValues)
      }))
    }
    
    return xdr.ScVal.scvMap(entries)
  }

  /**
   * Create schema encoder from XDR format
   */
  static fromXDR(xdrString: string): StellarSchemaEncoder {
    try {
      if (!xdrString.startsWith('XDR:')) {
        throw new Error('Invalid XDR format - missing XDR: prefix')
      }

      const xdrData = xdrString.substring(4)
      
      // Parse XDR back to ScVal
      const schemaScVal = xdr.ScVal.fromXDR(xdrData, 'base64')
      
      if (schemaScVal.switch() !== xdr.ScValType.scvMap()) {
        throw new Error('XDR data is not a map')
      }

      const schemaMap = schemaScVal.map()
      if (!schemaMap) {
        throw new Error('Invalid XDR schema map')
      }

      const schema: Partial<StellarSchemaDefinition> = {}

      // Extract schema properties from XDR map
      for (const entry of schemaMap) {
        const key = entry.key().sym().toString()
        const val = entry.val()

        switch (key) {
          case 'name':
            if (val.switch() === xdr.ScValType.scvString()) {
              schema.name = val.str().toString()
            }
            break
          case 'version':
            if (val.switch() === xdr.ScValType.scvString()) {
              schema.version = val.str().toString()
            }
            break
          case 'description':
            if (val.switch() === xdr.ScValType.scvString()) {
              schema.description = val.str().toString()
            }
            break
          case 'fields':
            if (val.switch() === xdr.ScValType.scvVec()) {
              schema.fields = this.parseFieldsFromXdr(val.vec() || [])
            }
            break
        }
      }

      // Validate required fields
      if (!schema.name || !schema.version || !schema.fields) {
        throw new Error('Missing required schema fields')
      }

      return new StellarSchemaEncoder(schema as StellarSchemaDefinition)
    } catch (error) {
      throw new SchemaValidationError(`Failed to decode XDR schema: ${error}`)
    }
  }

  /**
   * Helper to parse fields array from XDR
   */
  private static parseFieldsFromXdr(fieldsXdr: xdr.ScVal[]): SchemaField[] {
    return fieldsXdr.map(fieldXdr => {
      if (fieldXdr.switch() !== xdr.ScValType.scvMap()) {
        throw new Error('Field is not a map')
      }

      const fieldMap = fieldXdr.map()
      if (!fieldMap) {
        throw new Error('Invalid field map')
      }

      const field: Partial<SchemaField> = {}

      for (const entry of fieldMap) {
        const key = entry.key().sym().toString()
        const val = entry.val()

        switch (key) {
          case 'name':
            if (val.switch() === xdr.ScValType.scvString()) {
              field.name = val.str().toString()
            }
            break
          case 'type':
            if (val.switch() === xdr.ScValType.scvString()) {
              field.type = val.str().toString()
            }
            break
          case 'optional':
            if (val.switch() === xdr.ScValType.scvBool()) {
              field.optional = val.b()
            }
            break
          case 'description':
            if (val.switch() === xdr.ScValType.scvString()) {
              field.description = val.str().toString()
            }
            break
          case 'validation':
            if (val.switch() === xdr.ScValType.scvMap()) {
              const validationMap = val.map()
              if (validationMap) {
                field.validation = this.parseValidationFromXdr(validationMap)
              }
            }
            break
        }
      }

      if (!field.name || !field.type) {
        throw new Error('Missing required field properties')
      }

      return field as SchemaField
    })
  }

  /**
   * Helper to parse validation rules from XDR
   */
  private static parseValidationFromXdr(validationMap: xdr.ScMapEntry[]): any {
    const validation: any = {}

    for (const entry of validationMap) {
      const key = entry.key().sym().toString()
      const val = entry.val()

      switch (key) {
        case 'min':
          if (val.switch() === xdr.ScValType.scvI128()) {
            validation.min = parseInt(val.i128().toString())
          }
          break
        case 'max':
          if (val.switch() === xdr.ScValType.scvI128()) {
            validation.max = parseInt(val.i128().toString())
          }
          break
        case 'pattern':
          if (val.switch() === xdr.ScValType.scvString()) {
            validation.pattern = val.str().toString()
          }
          break
        case 'enum':
          if (val.switch() === xdr.ScValType.scvVec()) {
            validation.enum = (val.vec() || []).map(enumVal => {
              if (enumVal.switch() === xdr.ScValType.scvString()) {
                return enumVal.str().toString()
              }
              return ''
            }).filter(v => v)
          }
          break
      }
    }

    return validation
  }


  /**
   * Encode attestation data according to the schema
   */
  async encodeData(data: Record<string, any>): Promise<EncodedAttestationData> {
    this.validateData(data)
    
    const encodedData = JSON.stringify(this.processDataForEncoding(data))
    const schemaHash = this.getSchemaHash()

    return {
      schemaHash,
      encodedData,
      decodedData: { ...data },
      schema: this.getSchema()
    }
  }

  /**
   * Decode attestation data from encoded format
   */
  decodeData(encodedData: string): Record<string, any> {
    try {
      const parsed = JSON.parse(encodedData)
      return this.processDataForDecoding(parsed)
    } catch (error) {
      throw new SchemaValidationError(`Failed to decode data: ${error}`)
    }
  }

  /**
   * Validate data against the schema
   */
  validateData(data: Record<string, any>): void {
    // Check required fields
    for (const field of this.schema.fields) {
      if (!field.optional && !(field.name in data)) {
        throw new SchemaValidationError(`Required field '${field.name}' is missing`, field.name)
      }
    }

    // Validate each field
    for (const [key, value] of Object.entries(data)) {
      const field = this.schema.fields.find(f => f.name === key)
      if (!field) {
        throw new SchemaValidationError(`Unknown field '${key}'`, key)
      }

      this.validateFieldValue(field, value)
    }
  }

  /**
   * Generate default values for a schema
   */
  generateDefaults(): Record<string, any> {
    const defaults: Record<string, any> = {}

    for (const field of this.schema.fields) {
      if (field.optional) continue

      defaults[field.name] = this.getDefaultValue(field.type)
    }

    return defaults
  }

  /**
   * Convert schema to JSON Schema format for external compatibility
   */
  toJSONSchema(): object {
    const properties: Record<string, any> = {}
    const required: string[] = []

    for (const field of this.schema.fields) {
      properties[field.name] = {
        type: this.stellarTypeToJSONSchemaType(field.type),
        description: field.description
      }

      // If this is an address, add encoding and media type hints for round-trip fidelity
      if (field.type === StellarDataType.ADDRESS) {
        properties[field.name].contentEncoding = 'base32'
        properties[field.name].contentMediaType = 'application/vnd.daccred.address; chain=stellar'
      }

      if (field.validation) {
        Object.assign(properties[field.name], field.validation)
      }

      if (!field.optional) {
        required.push(field.name)
      }
    }

    return {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      title: this.schema.name,
      description: this.schema.description,
      version: this.schema.version,
      properties,
      required,
      additionalProperties: false
    }
  }

  /**
   * Create a schema encoder from JSON Schema
   */
  static fromJSONSchema(jsonSchema: any): StellarSchemaEncoder {
    const fields: SchemaField[] = []

    for (const [name, prop] of Object.entries(jsonSchema.properties || {})) {
      const property = prop as any
      const baseType = StellarSchemaEncoder.jsonSchemaTypeToStellarType(property.type)

      // Detect Stellar address strictly by base32 encoding hint or custom media type
      const isBase32Encoded = property.contentEncoding === 'base32'
      const mediaType: string | undefined = property.contentMediaType
      const isWalletAddress = typeof mediaType === 'string' && mediaType.startsWith('application/vnd.daccred.address')
      const resolvedType = (baseType === StellarDataType.STRING && (isBase32Encoded || isWalletAddress))
        ? StellarDataType.ADDRESS
        : baseType

      fields.push({
        name,
        type: resolvedType,
        optional: !jsonSchema.required?.includes(name),
        description: property.description,
        validation: {
          min: property.minimum,
          max: property.maximum,
          pattern: property.pattern,
          enum: property.enum
        }
      })
    }

    const schema: StellarSchemaDefinition = {
      name: jsonSchema.title || 'Untitled Schema',
      version: jsonSchema.version || '1.0.0',
      description: jsonSchema.description || '',
      fields
    }

    return new StellarSchemaEncoder(schema)
  }

  /**
   * Validate schema definition
   */
  private validateSchema(schema: StellarSchemaDefinition): void {
    if (!schema.name || typeof schema.name !== 'string') {
      throw new SchemaValidationError('Schema must have a valid name')
    }

    if (!schema.version || typeof schema.version !== 'string') {
      throw new SchemaValidationError('Schema must have a valid version')
    }

    if (!schema.fields || !Array.isArray(schema.fields) || schema.fields.length === 0) {
      throw new SchemaValidationError('Schema must have at least one field')
    }

    // Validate each field
    const fieldNames = new Set<string>()
    for (const field of schema.fields) {
      if (!field.name || typeof field.name !== 'string') {
        throw new SchemaValidationError('Each field must have a valid name')
      }

      if (fieldNames.has(field.name)) {
        throw new SchemaValidationError(`Duplicate field name: ${field.name}`)
      }
      fieldNames.add(field.name)

      if (!this.isValidStellarType(field.type)) {
        throw new SchemaValidationError(`Invalid type '${field.type}' for field '${field.name}'`)
      }
    }
  }

  /**
   * Validate individual field value
   */
  private validateFieldValue(field: SchemaField, value: any): void {
    if (value === null || value === undefined) {
      if (!field.optional) {
        throw new SchemaValidationError(`Field '${field.name}' cannot be null`, field.name)
      }
      return
    }

    // Type-specific validation
    switch (field.type) {
      case StellarDataType.STRING:
      case StellarDataType.SYMBOL:
        if (typeof value !== 'string') {
          throw new SchemaValidationError(`Field '${field.name}' must be a string`, field.name)
        }
        break

      case StellarDataType.BOOL:
        if (typeof value !== 'boolean') {
          throw new SchemaValidationError(`Field '${field.name}' must be a boolean`, field.name)
        }
        break

      case StellarDataType.U32:
      case StellarDataType.U64:
      case StellarDataType.I32:
      case StellarDataType.I64:
      case StellarDataType.I128:
      case StellarDataType.AMOUNT:
        if (typeof value !== 'number' && typeof value !== 'bigint') {
          throw new SchemaValidationError(`Field '${field.name}' must be a number`, field.name)
        }
        break

      case StellarDataType.ADDRESS:
        if (typeof value !== 'string' || !this.isValidStellarAddress(value)) {
          throw new SchemaValidationError(`Field '${field.name}' must be a valid Stellar address`, field.name)
        }
        break

      case StellarDataType.TIMESTAMP:
        if (typeof value !== 'number' && typeof value !== 'string') {
          throw new SchemaValidationError(`Field '${field.name}' must be a timestamp`, field.name)
        }
        break
    }

    // Validation rules
    if (field.validation) {
      if (field.validation.enum && !field.validation.enum.includes(value)) {
        throw new SchemaValidationError(
          `Field '${field.name}' must be one of: ${field.validation.enum.join(', ')}`,
          field.name
        )
      }

      if (typeof value === 'string' && field.validation.pattern) {
        if (!new RegExp(field.validation.pattern).test(value)) {
          throw new SchemaValidationError(`Field '${field.name}' does not match pattern`, field.name)
        }
      }

      if (typeof value === 'number') {
        if (field.validation.min !== undefined && value < field.validation.min) {
          throw new SchemaValidationError(`Field '${field.name}' is below minimum value`, field.name)
        }
        if (field.validation.max !== undefined && value > field.validation.max) {
          throw new SchemaValidationError(`Field '${field.name}' exceeds maximum value`, field.name)
        }
      }
    }
  }

  /**
   * Process data for encoding (type conversions, etc.)
   */
  private processDataForEncoding(data: Record<string, any>): Record<string, any> {
    const processed: Record<string, any> = {}

    for (const [key, value] of Object.entries(data)) {
      const field = this.schema.fields.find(f => f.name === key)
      if (!field) continue

      switch (field.type) {
        case StellarDataType.ADDRESS:
          // Ensure address is in proper format
          processed[key] = typeof value === 'string' ? value : value.toString()
          break

        case StellarDataType.TIMESTAMP:
          // Convert to Unix timestamp
          processed[key] = typeof value === 'string' ? new Date(value).getTime() : value
          break

        case StellarDataType.I128:
        case StellarDataType.AMOUNT:
          // Handle big numbers
          processed[key] = typeof value === 'bigint' ? value.toString() : value
          break

        default:
          processed[key] = value
      }
    }

    return processed
  }

  /**
   * Process data for decoding (reverse of encoding)
   */
  private processDataForDecoding(data: Record<string, any>): Record<string, any> {
    const processed: Record<string, any> = {}

    for (const [key, value] of Object.entries(data)) {
      const field = this.schema.fields.find(f => f.name === key)
      if (!field) {
        processed[key] = value
        continue
      }

      switch (field.type) {
        case StellarDataType.I128:
        case StellarDataType.AMOUNT:
          // Convert back to BigInt if it was a string
          processed[key] = typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : value
          break

        default:
          processed[key] = value
      }
    }

    return processed
  }

  /**
   * Get default value for a type
   */
  private getDefaultValue(type: string): any {
    switch (type) {
      case StellarDataType.STRING:
      case StellarDataType.SYMBOL:
        return ''
      case StellarDataType.BOOL:
        return false
      case StellarDataType.U32:
      case StellarDataType.U64:
      case StellarDataType.I32:
      case StellarDataType.I64:
      case StellarDataType.AMOUNT:
        return 0
      case StellarDataType.I128:
        return BigInt(0)
      case StellarDataType.ADDRESS:
        return 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      case StellarDataType.TIMESTAMP:
        return Date.now()
      case StellarDataType.BYTES:
        return new Uint8Array(0)
      case StellarDataType.ARRAY:
        return []
      case StellarDataType.MAP:
        return {}
      default:
        return null
    }
  }

  /**
   * Check if a type is valid Stellar type
   */
  private isValidStellarType(type: string): boolean {
    return Object.values(StellarDataType).includes(type as StellarDataType) ||
           type.startsWith('array<') ||
           type.startsWith('option<') ||
           type.startsWith('map<')
  }

  /**
   * Convert Stellar type to a coarse JSON Schema "type".
   *
   * Key considerations:
   * - Numeric types (u32/u64/i32/i64/i128/amount/timestamp) map to 'number' to maximize
   *   interoperability with generic JSON Schema tooling, even though several are conceptually
   *   integers. Callers should treat them as integers where applicable.
   * - Values that can exceed JavaScript's safe integer range (i128/amount) are encoded as strings
   *   at runtime (see processDataForEncoding). Downstream validators may want to add a 'pattern'
   *   or custom 'format' to communicate this constraint.
   * - 'address' and 'symbol' are represented as 'string'. Schema authors can provide a 'pattern'
   *   to constrain an address, since JSON Schema does not natively know about Stellar addresses.
   * - 'array' and 'map' are generic container types; element/key/value types are not preserved by
   *   this mapping. For stronger typing, model nested fields explicitly or extend with metadata.
   */
  private stellarTypeToJSONSchemaType(stellarType: string): string {
    switch (stellarType) {
      case StellarDataType.STRING:
      case StellarDataType.SYMBOL:
      case StellarDataType.ADDRESS:
        return 'string'
      case StellarDataType.BOOL:
        return 'boolean'
      case StellarDataType.U32:
      case StellarDataType.U64:
      case StellarDataType.I32:
      case StellarDataType.I64:
      case StellarDataType.I128:
      case StellarDataType.AMOUNT:
      case StellarDataType.TIMESTAMP:
        return 'number'
      case StellarDataType.ARRAY:
        return 'array'
      case StellarDataType.MAP:
        return 'object'
      default:
        return 'string'
    }
  }

  /**
   * Convert a JSON Schema "type" into a Stellar type.
   *
   * Key considerations:
   * - JSON Schema collapses many specialized types into 'string' or 'number'. Without additional
   *   hints (e.g., 'format', 'pattern', or custom metadata), we default to the broadest sensible
   *   Stellar types.
   *   - 'number' and 'integer' default to i64.
   *   - 'string' remains a generic string (we do not assume 'address' or 'symbol').
   * - Arrays/objects map to generic 'array'/'map'; element types are not inferred.
   * - If you need address, amount, i128, or timestamp fidelity, provide explicit Stellar types in
   *   the schema definition or pre-process JSON Schema using metadata before calling this method.
   */
  private static jsonSchemaTypeToStellarType(jsonType: string): string {
    switch (jsonType) {
      case 'string':
        return StellarDataType.STRING
      case 'boolean':
        return StellarDataType.BOOL
      case 'number':
      case 'integer':
        return StellarDataType.I64
      case 'array':
        return StellarDataType.ARRAY
      case 'object':
        return StellarDataType.MAP
      default:
        return StellarDataType.STRING
    }
  }

  /**
   * Validate Stellar address format
   */
  private isValidStellarAddress(address: string): boolean {
    try {
      Address.fromString(address)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Pre-defined schema encoders for common use cases
 */
export class StellarSchemaService {
  private static schemas = new Map<string, StellarSchemaEncoder>()

  /**
   * Register a schema encoder
   */
  static register(name: string, encoder: StellarSchemaEncoder): void {
    this.schemas.set(name, encoder)
  }

  /**
   * Get a registered schema encoder
   */
  static get(name: string): StellarSchemaEncoder | undefined {
    return this.schemas.get(name)
  }

  /**
   * List all registered schema names
   */
  static list(): string[] {
    return Array.from(this.schemas.keys())
  }

  /**
   * Initialize with common schemas
   */
  static initializeDefaults(): void {
    // Identity verification schema
    this.register('identity-verification', new StellarSchemaEncoder({
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
    this.register('academic-credential', new StellarSchemaEncoder({
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
    this.register('professional-certification', new StellarSchemaEncoder({
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
}

// Initialize default schemas
StellarSchemaService.initializeDefaults()