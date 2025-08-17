/**
 * Multiple Schema Creation Demo
 * 
 * Demonstrates creating and working with multiple custom schemas,
 * schema management, and attestation creation using the Stellar SDK.
 */

import StellarAttestProtocol, { 
  StellarSchemaEncoder, 
  StellarSchemaRegistry,
  StellarDataType,
  _internal 
} from '../src'

async function demonstrateMultipleSchemas() {
  console.log('🔧 Multiple Schema Creation Demo')
  console.log('================================\n')

  // Initialize the SDK
  const attest = new StellarAttestProtocol({
    secretKeyOrCustomSigner: process.env.SECRET_KEY || 'YOUR_SECRET_KEY',
    publicKey: process.env.PUBLIC_KEY || 'YOUR_PUBLIC_KEY',
    url: 'https://soroban-testnet.stellar.org'
  })

  const testKeypairs = _internal.createTestKeypairs()

  // 1. Creating Multiple Custom Schemas using Schema Service
  console.log('📋 Feature 1: Creating Multiple Custom Schemas')
  console.log('==============================================')
  
  // Schema 1: Simple verification schema
  const simpleSchemaDefinition = {
    schema: 'bool verified, uint64 timestamp',
    resolver: '0x0000000000000000000000000000000000000000',
    revocable: true
  }

  const simpleSchemaResult = await attest.createSchema(simpleSchemaDefinition)
  if (simpleSchemaResult.data) {
    console.log(`✅ Simple Schema Created: ${simpleSchemaResult.data.id}`)
    console.log(`   Schema: ${simpleSchemaResult.data.schema}`)
    console.log(`   Revocable: ${simpleSchemaResult.data.revocable}\n`)
  }

  // Schema 2: Complex data types schema
  const complexSchemaDefinition = {
    schema: 'string name, uint32 age, bool active, address wallet, uint64 created, string[] tags',
    resolver: '0x0000000000000000000000000000000000000000',
    revocable: true
  }

  const complexSchemaResult = await attest.createSchema(complexSchemaDefinition)
  if (complexSchemaResult.data) {
    console.log(`✅ Complex Schema Created: ${complexSchemaResult.data.id}`)
    console.log(`   Schema: ${complexSchemaResult.data.schema}`)
    console.log(`   Revocable: ${complexSchemaResult.data.revocable}\n`)
  }

  // Schema 3: Non-revocable permanent schema
  const permanentSchemaDefinition = {
    schema: 'string recordType, string permanentId, uint64 issuedDate, string dataHash',
    resolver: '0x0000000000000000000000000000000000000000',
    revocable: false
  }

  const permanentSchemaResult = await attest.createSchema(permanentSchemaDefinition)
  if (permanentSchemaResult.data) {
    console.log(`✅ Permanent Schema Created: ${permanentSchemaResult.data.id}`)
    console.log(`   Schema: ${permanentSchemaResult.data.schema}`)
    console.log(`   Revocable: ${permanentSchemaResult.data.revocable}\n`)
  }

  // 2. Using Schema Encoder for Advanced Schema Creation
  console.log('🔧 Feature 2: Advanced Schema Creation with StellarSchemaEncoder')
  console.log('===============================================================')

  // Create a complex schema with the encoder
  const advancedSchema = new StellarSchemaEncoder({
    name: 'Advanced Verification',
    version: '1.0.0',
    description: 'Advanced verification with multiple data types',
    fields: [
      { name: 'subjectAddress', type: StellarDataType.ADDRESS },
      { name: 'verificationLevel', type: StellarDataType.STRING },
      { name: 'score', type: StellarDataType.U32 },
      { name: 'isActive', type: StellarDataType.BOOL },
      { name: 'createdAt', type: StellarDataType.TIMESTAMP },
      { name: 'tags', type: 'array<string>' },
      { name: 'metadata', type: StellarDataType.STRING, optional: true }
    ]
  })

  console.log(`✅ Advanced Schema Encoder Created: ${advancedSchema.getSchema().name}`)
  console.log(`   Fields: ${advancedSchema.getSchema().fields.length}`)
  console.log(`   Schema Hash: ${advancedSchema.getSchemaHash().substring(0, 16)}...\n`)

  // 3. Schema Registration in Registry
  console.log('📚 Feature 3: Schema Registry Management')
  console.log('=======================================')

  // Register the schema in the registry
  StellarSchemaRegistry.register('advanced-verification', advancedSchema)
  
  console.log(`Available schemas: ${StellarSchemaRegistry.list().join(', ')}`)
  
  // Retrieve schema from registry
  const retrievedSchema = StellarSchemaRegistry.get('advanced-verification')
  if (retrievedSchema) {
    console.log(`✅ Retrieved schema from registry: ${retrievedSchema.getSchema().name}`)
  }
  console.log('')

  // 4. Creating Attestations with Different Schemas
  console.log('📝 Feature 4: Creating Attestations with Multiple Schemas')
  console.log('========================================================')

  // Attestation with simple schema
  if (simpleSchemaResult.data) {
    const simpleAttestationResult = await attest.issueAttestation({
      schemaId: simpleSchemaResult.data.id,
      data: '0x0000000000000000000000000000000000000000000000000000000000000001' + // verified = true
            BigInt(Date.now()).toString(16).padStart(16, '0'), // timestamp
      subject: testKeypairs.recipientPublic,
      expirationTime: BigInt(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      revocable: true
    })

    if (simpleAttestationResult.data) {
      console.log(`✅ Simple Attestation Created: ${simpleAttestationResult.data.id}`)
      console.log(`   Schema: ${simpleAttestationResult.data.schemaId}`)
      console.log(`   Subject: ${simpleAttestationResult.data.subject}`)
      console.log(`   Revocable: ${simpleAttestationResult.data.revocable}\n`)
    }
  }

  // Attestation with complex schema
  if (complexSchemaResult.data) {
    // Encode complex data manually for demo
    const encodedComplexData = '0x' + 
      Buffer.from('John Doe').toString('hex').padEnd(64, '0') + // name
      (25).toString(16).padStart(8, '0') + // age = 25
      '01' + // active = true
      testKeypairs.recipientPublic.substring(2) + // wallet address
      BigInt(Date.now()).toString(16).padStart(16, '0') + // created
      Buffer.from('["developer","verified"]').toString('hex') // tags array

    const complexAttestationResult = await attest.issueAttestation({
      schemaId: complexSchemaResult.data.id,
      data: encodedComplexData,
      subject: testKeypairs.recipientPublic,
      expirationTime: BigInt(0), // No expiration
      revocable: true
    })

    if (complexAttestationResult.data) {
      console.log(`✅ Complex Attestation Created: ${complexAttestationResult.data.id}`)
      console.log(`   Schema: ${complexAttestationResult.data.schemaId}`)
      console.log(`   Subject: ${complexAttestationResult.data.subject}`)
      console.log(`   Has Expiration: ${complexAttestationResult.data.expirationTime > 0n}\n`)
    }
  }

  // Non-revocable attestation with permanent schema
  if (permanentSchemaResult.data) {
    const permanentData = '0x' + 
      Buffer.from('birth_certificate').toString('hex').padEnd(64, '0') + // recordType
      Buffer.from('BC-2024-001').toString('hex').padEnd(64, '0') + // permanentId
      BigInt(Date.now()).toString(16).padStart(16, '0') + // issuedDate
      Buffer.from('0xa1b2c3d4e5f6').toString('hex').padEnd(64, '0') // dataHash

    const permanentAttestationResult = await attest.issueAttestation({
      schemaId: permanentSchemaResult.data.id,
      data: permanentData,
      subject: testKeypairs.recipientPublic,
      expirationTime: BigInt(0), // No expiration
      revocable: false // Cannot be revoked
    })

    if (permanentAttestationResult.data) {
      console.log(`✅ Permanent Attestation Created: ${permanentAttestationResult.data.id}`)
      console.log(`   Schema: ${permanentAttestationResult.data.schemaId}`)
      console.log(`   Subject: ${permanentAttestationResult.data.subject}`)
      console.log(`   Revocable: ${permanentAttestationResult.data.revocable}\n`)
    }
  }

  // 5. Querying Schemas and Attestations
  console.log('🔍 Feature 5: Querying Schemas and Attestations')
  console.log('===============================================')

  // List schemas by issuer
  const schemasResult = await attest.listSchemasByIssuer({
    issuer: attest.config.publicKey,
    limit: 10,
    offset: 0
  })

  if (schemasResult.data) {
    console.log(`✅ Found ${schemasResult.data.items.length} schemas created by issuer`)
    schemasResult.data.items.forEach((schema, index) => {
      console.log(`   ${index + 1}. Schema ID: ${schema.id.substring(0, 16)}... | Revocable: ${schema.revocable}`)
    })
  }

  // List attestations by subject
  const attestationsResult = await attest.listAttestationsByWallet({
    wallet: testKeypairs.recipientPublic,
    limit: 10,
    offset: 0
  })

  if (attestationsResult.data) {
    console.log(`\n✅ Found ${attestationsResult.data.items.length} attestations for subject`)
    attestationsResult.data.items.forEach((attestation, index) => {
      console.log(`   ${index + 1}. Attestation ID: ${attestation.id.substring(0, 16)}... | Schema: ${attestation.schemaId.substring(0, 16)}...`)
    })
  }
  console.log('')

  // 6. Schema Data Validation using Encoder
  console.log('✔️ Feature 6: Schema Data Validation')
  console.log('===================================')

  // Test data validation with the advanced schema
  const validData = {
    subjectAddress: testKeypairs.recipientPublic,
    verificationLevel: 'gold',
    score: 95,
    isActive: true,
    createdAt: Date.now(),
    tags: ['verified', 'premium'],
    metadata: 'Additional info'
  }

  try {
    advancedSchema.validateData(validData)
    console.log('✅ Valid data passed validation')
    
    // Encode the data
    const encodedData = await advancedSchema.encodeData(validData)
    console.log(`✅ Data encoded successfully: ${encodedData.encodedData.length} chars`)
    
    // Decode it back
    const decodedData = advancedSchema.decodeData(encodedData.encodedData)
    console.log(`✅ Data decoded successfully`)
    console.log(`   Address matches: ${decodedData.subjectAddress === validData.subjectAddress}`)
    console.log(`   Level matches: ${decodedData.verificationLevel === validData.verificationLevel}`)
  } catch (error: any) {
    console.error(`❌ Validation failed: ${error.message}`)
  }

  // Test with invalid data
  const invalidData = {
    subjectAddress: 'invalid-address',
    verificationLevel: '', // empty string
    score: -1, // negative score
    isActive: 'not-boolean', // wrong type
    createdAt: 'invalid-timestamp',
    tags: 'not-an-array'
  }

  try {
    advancedSchema.validateData(invalidData)
    console.log('Unexpected: Invalid data passed validation')
  } catch (error: any) {
    console.log(`✅ Invalid data correctly rejected: ${error.message}`)
  }
  console.log('')

  // 7. Schema Retrieval and Information
  console.log('📖 Feature 7: Schema Retrieval and Information')
  console.log('==============================================')

  // Fetch schema by ID
  if (simpleSchemaResult.data) {
    const fetchedSchema = await attest.fetchSchemaById(simpleSchemaResult.data.id)
    if (fetchedSchema.data) {
      console.log(`✅ Fetched schema: ${fetchedSchema.data.id}`)
      console.log(`   Schema definition: ${fetchedSchema.data.schema}`)
      console.log(`   Resolver: ${fetchedSchema.data.resolver}`)
      console.log(`   Revocable: ${fetchedSchema.data.revocable}`)
    }
  }
  console.log('')

  console.log('🎉 Multiple Schema Creation Demo Complete!')
  console.log('==========================================')
  console.log('Features demonstrated:')
  console.log('• Creating multiple schemas with different data types')
  console.log('• Using StellarSchemaEncoder for advanced schema creation')
  console.log('• Schema registry management and retrieval')
  console.log('• Creating attestations with different schemas')
  console.log('• Revocable vs non-revocable schema configurations')
  console.log('• Querying schemas and attestations by various filters')
  console.log('• Data validation and encoding/decoding')
  console.log('• Schema information retrieval and inspection')
  console.log('• Working with both simple and complex data structures')
  console.log('• Proper error handling for invalid data')
}

// Run the demo
demonstrateMultipleSchemas().catch(console.error)