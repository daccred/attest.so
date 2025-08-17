/**
 * Standardized Schema Encoder Demo
 * 
 * Demonstrates the EAS-inspired standardized schema approach for Stellar attestations.
 * This provides type safety, validation, and standardized encoding/decoding.
 */

import StellarAttestProtocol, { 
  StellarSchemaEncoder, 
  StellarSchemaRegistry, 
  StellarDataType,
  common as _internal 
 
} from '../src'

async function demonstrateStandardizedSchemas() {
  console.log('🔧 Stellar Standardized Schema Encoder Demo')
  console.log('===========================================\n')

  // Show available registry schemas
  console.log('📚 Available Registry Schemas:')
  console.log(StellarSchemaRegistry.list().join(', '))
  console.log('')

  // 1. Using pre-registered schemas
  console.log('🏭 Using Pre-Registered Schemas:')
  console.log('================================')
  
  const identityEncoder = StellarSchemaRegistry.get('identity-verification')!
  console.log(`Identity Schema: ${identityEncoder.getSchema().name} v${identityEncoder.getSchema().version}`)
  console.log(`Schema Hash: ${identityEncoder.getSchemaHash()}\n`)

  // 2. Creating custom standardized schemas
  console.log('🎨 Creating Custom Standardized Schemas:')
  console.log('========================================')
  
  const customEncoder = new StellarSchemaEncoder({
    name: 'KYC Verification',
    version: '2.0.0',
    description: 'Enhanced KYC verification with risk scoring',
    fields: [
      { 
        name: 'subjectAddress', 
        type: StellarDataType.ADDRESS, 
        description: 'Stellar address of the subject' 
      },
      { 
        name: 'riskScore', 
        type: StellarDataType.U32, 
        validation: { min: 0, max: 1000 },
        description: 'Risk score (0-1000, lower is better)' 
      },
      { 
        name: 'verificationTier', 
        type: StellarDataType.STRING, 
        validation: { enum: ['bronze', 'silver', 'gold', 'platinum'] },
        description: 'KYC verification tier' 
      },
      { 
        name: 'documentsVerified', 
        type: 'array<string>', 
        description: 'List of verified document types' 
      },
      { 
        name: 'expirationTimestamp', 
        type: StellarDataType.TIMESTAMP, 
        description: 'When this KYC expires' 
      },
      { 
        name: 'notes', 
        type: StellarDataType.STRING, 
        optional: true, 
        description: 'Additional verification notes' 
      }
    ],
    metadata: {
      category: 'compliance',
      revocable: true,
      expirable: true
    }
  })

  console.log(`Custom Schema: ${customEncoder.getSchema().name}`)
  console.log(`Schema Hash: ${customEncoder.getSchemaHash()}`)
  console.log(`JSON Schema format:`)
  console.log(JSON.stringify(customEncoder.toJSONSchema(), null, 2))
  console.log('')

  // 3. Data validation and encoding
  console.log('🔍 Data Validation and Encoding:')
  console.log('================================')

  const testKeypairs = _internal.createTestKeypairs()
  
  // Valid data
  const validKycData = {
    subjectAddress: testKeypairs.recipientPublic,
    riskScore: 150,
    verificationTier: 'gold',
    documentsVerified: ['passport', 'utility_bill', 'bank_statement'],
    expirationTimestamp: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year from now
    notes: 'High-value customer with excellent credit history'
  }

  try {
    console.log('✅ Validating valid data...')
    customEncoder.validateData(validKycData)
    console.log('Validation passed!')

    const encoded = await customEncoder.encodeData(validKycData)
    console.log(`Encoded data length: ${encoded.encodedData.length} characters`)
    console.log(`Schema hash: ${encoded.schemaHash}`)
    
    // Decode it back
    const decoded = customEncoder.decodeData(encoded.encodedData)
    console.log(`Decoded data matches: ${JSON.stringify(decoded) === JSON.stringify(validKycData)}`)
    console.log('')
  } catch (error) {
    console.error('❌ Validation failed:', error)
  }

  // Invalid data demonstration
  console.log('❌ Testing Invalid Data:')
  console.log('========================')

  const invalidKycData = {
    subjectAddress: 'invalid-address',
    riskScore: 1500, // Too high
    verificationTier: 'diamond', // Not in enum
    documentsVerified: 'passport', // Should be array
    expirationTimestamp: 'invalid-date' // Should be number
  }

  try {
    customEncoder.validateData(invalidKycData)
    console.log('Unexpected: Validation passed for invalid data')
  } catch (error: any) {
    console.log(`Expected validation error: ${error.message}`)
  }
  console.log('')

  // 4. Using standardized internal utilities
  console.log('🧩 Using Standardized Internal Utilities:')
  console.log('=========================================')

  const standardTypes = ['identity', 'degree', 'certification', 'employment'] as const
  
  for (const type of standardTypes) {
    console.log(`\n📋 ${type.toUpperCase()} Schema:`)
    
    // Get standardized schema
    const schema = _internal.getStandardizedSchema(type)
    console.log(`Name: ${schema.name}`)
    console.log(`Fields: ${schema.fields.length}`)
    console.log(`Required fields: ${schema.fields.filter(f => !f.optional).map(f => f.name).join(', ')}`)
    
    // Create and validate standardized test data
    const testData = _internal.createStandardizedTestData(type)
    const validation = _internal.validateAttestationData(type, testData)
    console.log(`Test data valid: ${validation.valid}`)
    
    // Encode using standardized encoder
    const encoded = await _internal.encodeStandardizedAttestation(type, testData)
    console.log(`Encoded schema hash: ${encoded.schemaHash.substring(0, 16)}...`)
  }

  console.log('')

  // 5. Schema interoperability
  console.log('🔄 Schema Interoperability:')
  console.log('===========================')

  // Convert from JSON Schema to standardized format
  const legacyJsonSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Legacy Business License',
    description: 'A business license verification',
    type: 'object',
    properties: {
      businessName: { type: 'string' },
      licenseNumber: { type: 'string' },
      issuedDate: { type: 'string', format: 'date' },
      expiresDate: { type: 'string', format: 'date' },
      isActive: { type: 'boolean' }
    },
    required: ['businessName', 'licenseNumber', 'issuedDate', 'isActive']
  }

  const convertedEncoder = _internal.convertLegacySchema(legacyJsonSchema)
  console.log(`Converted schema: ${convertedEncoder.getSchema().name}`)
  console.log(`Converted fields: ${convertedEncoder.getSchema().fields.length}`)
  console.log(`Can generate defaults: ${JSON.stringify(convertedEncoder.generateDefaults(), null, 2)}`)
  console.log('')

  // 6. Registry management
  console.log('📝 Registry Management:')
  console.log('=======================')

  // Register our custom schema
  StellarSchemaRegistry.register('custom-kyc', customEncoder)
  console.log(`Registered schemas: ${StellarSchemaRegistry.list().length}`)
  console.log(`Available: ${StellarSchemaRegistry.list().join(', ')}`)

  // Retrieve and use
  const retrievedEncoder = StellarSchemaRegistry.get('custom-kyc')
  if (retrievedEncoder) {
    console.log(`✅ Successfully retrieved custom schema: ${retrievedEncoder.getSchema().name}`)
  }

  console.log('\n🎉 Demo Complete!')
  console.log('=================')
  console.log('Key Benefits of Standardized Schema Approach:')
  console.log('• Type-safe schema definitions with validation')
  console.log('• Consistent encoding/decoding across all attestations')
  console.log('• Interoperability with JSON Schema ecosystem')
  console.log('• Pre-registered schemas for common use cases')
  console.log('• Extensible registry system for custom schemas')
  console.log('• Contract-compatible data formatting')
  console.log('• Industry-standard field types and validations')
  console.log('\nThis approach provides the same benefits as EAS schema encoding')
  console.log('but is specifically adapted for Stellar/Soroban contracts.')
}

// Run the demo
demonstrateStandardizedSchemas().catch(console.error)