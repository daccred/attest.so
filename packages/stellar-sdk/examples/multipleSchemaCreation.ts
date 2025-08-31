/**
 * Example: Creating Multiple Schemas and Attestations in Batch
 *
 * This example demonstrates how to:
 * 1. Register a set of common schemas.
 * 2. Concurrently create and register multiple schemas on-chain.
 * 3. Use the newly registered schemas to create attestations.
 */
import { 
  StellarClient, 
  SorobanSchemaEncoder
} from '../src'
import { log, an, an_v, an_c, an_ac, an_e } from './logger'
import { registerCommonSchemas } from './commonSchemas'
import { ExampleSchemaRegistry as Registry } from './registry'



// Define client options
const options = {
    secretKeyOrCustomSigner: process.env.SECRET_KEY || 'YOUR_SECRET_KEY',
    publicKey: process.env.PUBLIC_KEY || 'YOUR_PUBLIC_KEY',
    url: 'https://soroban-testnet.stellar.org'
  }

async function main() {
  log(an_c, 'Stellar Attestation SDK - Multiple Schema Creation Example')

  // Register common schemas to be used
  registerCommonSchemas()

  // 1. Define multiple new custom schemas to be created
  log(an_v, '1. Defining custom schemas for "Course Completion" and "Event Attendance"')
  const newSchemas = [
    new SorobanSchemaEncoder({
      name: 'Course Completion',
      version: '1.0.0',
      description: 'Proof of completion for a specific course',
      fields: [
        { name: 'studentName', type: 'string' },
        { name: 'courseName', type: 'string' },
        { name: 'completionDate', type: 'timestamp' },
        { name: 'grade', type: 'string' }
      ]
    }),
    new SorobanSchemaEncoder({
      name: 'Event Attendance',
      version: '1.0.1',
      description: 'Proof of attendance for a specific event',
      fields: [
        { name: 'eventName', type: 'string' },
        { name: 'attendeeName', type: 'string' },
        { name: 'eventDate', type: 'timestamp' }
      ]
    })
  ]

  // 2. Concurrently create and register all schemas
  log(an_v, '2. Concurrently creating and registering schemas on-chain')
  try {
    const client = new StellarClient(options)
    const createdSchemas = await client.createAndRegisterSchemas(
      newSchemas.map(s => s.getSchemaDefinition())
    )
    
    createdSchemas.forEach(schema => {
      log(an_ac, `   - Schema registered with UID: ${schema.uid}`)
    })

    // Add the new schemas to the local registry for easy access
    newSchemas.forEach(encoder => Registry.register(encoder.schema.name, encoder))

    // 3. Create attestations using the new schemas
    log(an_v, '3. Creating attestations for the new schemas')
    
    // Attestation for Course Completion
    const courseSchema = Registry.get('Course Completion')
    if (courseSchema) {
      const courseAttestation = await client.createAndRegisterAttestation(
        courseSchema,
        {
          studentName: 'Alice',
          courseName: 'Introduction to Soroban',
          completionDate: new Date('2023-10-26T10:00:00Z').getTime(),
          grade: 'A'
        },
        'GA5DBYT33L2JDX3S4O646RLYQRRN7E6VW4Y7H4343TCG3UTMV677F6A5'
      )
      log(an_ac, `   - Created course completion attestation with UID: ${courseAttestation.uid}`)
    }

    // Attestation for Event Attendance
    const eventSchema = Registry.get('Event Attendance')
    if (eventSchema) {
      const eventAttestation = await client.createAndRegisterAttestation(
        eventSchema,
        {
          eventName: 'Stellar Meridian 2023',
          attendeeName: 'Bob',
          eventDate: new Date('2023-09-27T09:00:00Z').getTime()
        },
        'GA5DBYT33L2JDX3S4O646RLYQRRN7E6VW4Y7H4343TCG3UTMV677F6A5'
      )
      log(an_ac, `   - Created event attendance attestation with UID: ${eventAttestation.uid}`)
    }

  } catch (error) {
    log(an_e, 'Error during schema creation or attestation:')
    console.error(error)
  }
}

main().catch(error => {
  log(an_e, 'An unexpected error occurred:')
  console.error(error)
})