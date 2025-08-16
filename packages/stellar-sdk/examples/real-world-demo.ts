/**
 * Real-world demonstration of the Stellar Attest Protocol SDK
 * Shows how to create realistic schemas and attestations
 */

import StellarAttestProtocol, { _internal } from '../src'

async function demonstrateRealWorldUsage() {
  console.log('🌟 Real-World Stellar Attestation Demo')
  console.log('=====================================\n')

  // Create test keypairs
  const { authority, recipient } = _internal.createTestKeypairs()
  console.log('👥 Test Accounts:')
  console.log(`Authority: ${authority.publicKey()}`)
  console.log(`Recipient: ${recipient.publicKey()}\n`)

  // Initialize SDK
  const client = new StellarAttestProtocol({
    secretKeyOrCustomSigner: authority.secret(),
    publicKey: authority.publicKey(),
  })

  console.log('📋 Creating Real-World Schemas:')
  console.log('==============================\n')

  // Create different types of schemas
  const schemaTypes = ['degree', 'identity', 'certification', 'employment'] as const
  const createdSchemas: Array<{ type: string, uid: string }> = []

  for (const schemaType of schemaTypes) {
    console.log(`📝 Creating ${schemaType} schema...`)
    
    const schema = _internal.createTestSchema(schemaType)
    console.log(`Schema Name: ${schema.name}`)
    
    // Show a snippet of the schema content
    const parsedContent = JSON.parse(schema.content)
    console.log(`Schema Title: ${parsedContent.title}`)
    console.log(`Required Fields: ${parsedContent.required?.join(', ') || 'None'}`)
    
    // Generate the UID that would be created
    const uid = await _internal.generateIdFromSchema(schema, authority.publicKey())
    console.log(`Generated UID: ${_internal.formatSchemaUid(uid)}`)
    
    createdSchemas.push({ type: schemaType, uid })
    console.log('✅ Schema ready for registration\n')
  }

  console.log('🎯 Creating Real-World Attestations:')
  console.log('===================================\n')

  // Create realistic attestations for each schema type
  for (const { type, uid } of createdSchemas) {
    console.log(`🔖 Creating ${type} attestation...`)
    
    const attestation = _internal.createTestAttestation(
      uid,
      type as any,
      recipient.publicKey()
    )
    
    // Parse and display the attestation data
    const attestationData = JSON.parse(attestation.data)
    console.log(`Subject: ${attestation.subject}`)
    console.log(`Reference: ${attestation.reference}`)
    
    // Show some key fields from the attestation data
    switch (type) {
      case 'degree':
        console.log(`Student: ${attestationData.studentName}`)
        console.log(`University: ${attestationData.university}`)
        console.log(`Degree: ${attestationData.degree} in ${attestationData.fieldOfStudy}`)
        break
      case 'identity':
        console.log(`Name: ${attestationData.fullName}`)
        console.log(`Verification Level: ${attestationData.verificationLevel}`)
        console.log(`Document Type: ${attestationData.documentType}`)
        break
      case 'certification':
        console.log(`Holder: ${attestationData.holderName}`)
        console.log(`Certification: ${attestationData.certificationName}`)
        console.log(`Issuer: ${attestationData.issuingOrganization}`)
        break
      case 'employment':
        console.log(`Employee: ${attestationData.employeeName}`)
        console.log(`Company: ${attestationData.employerName}`)
        console.log(`Position: ${attestationData.jobTitle}`)
        break
    }
    
    console.log('✅ Attestation ready for submission\n')
  }

  console.log('🔄 Generating Dynamic Test Data:')
  console.log('===============================\n')

  // Demonstrate the realistic test data generator
  for (const type of schemaTypes) {
    console.log(`🎲 Random ${type} data:`)
    const randomData = _internal.generateRealisticTestData(type)
    
    // Display a few key fields
    const keys = Object.keys(randomData).slice(0, 3)
    for (const key of keys) {
      const value = randomData[key as keyof typeof randomData]
      console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    }
    console.log('')
  }

  console.log('🏁 Demo Complete!')
  console.log('=================')
  console.log('This demo showed how to:')
  console.log('• Create professional JSON Schema-based attestation schemas')
  console.log('• Generate realistic test data for different use cases')
  console.log('• Format and display attestation information')
  console.log('• Use the internal utilities for testing and development')
  console.log('\nAll schemas and attestations use industry-standard formats')
  console.log('and realistic data that matches real-world use cases.')
}

// Run the demo
demonstrateRealWorldUsage().catch(console.error)