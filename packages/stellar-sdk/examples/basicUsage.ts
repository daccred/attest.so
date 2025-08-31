/**
 * Example: Basic Usage of the Stellar Attestation SDK
 *
 * This example demonstrates the fundamental operations of the SDK:
 * 1. Creating a schema
 * 2. Registering it on-chain
 * 3. Creating an attestation based on the schema
 * 4. Fetching and verifying the attestation
 */
import { SorobanSchemaEncoder, StellarClient } from '../src'
import { log, an, an_v, an_c, an_ac, an_e } from './logger'
import { registerCommonSchemas, SchemaRegistry } from './commonSchemas'
 

// Define client options
const options = {
  networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  contractId: 'CB767FNQ3J2PT35W6X27V325XI2I2P62X72MH5YVTWPYRFGCR44SS26S',
  walletSecret: 'SDVWUWJ55VSAXMLYL43NB7D7P2RLS4J7G4JUJ6J5HUI2S37S4Q2IMQYV'
}
// Initialize the client
const client = new StellarClient(options)

async function main() {
  log(an_c, 'Stellar Attestation SDK - Basic Usage Example')

  // Register the common schemas
  registerCommonSchemas()
  
  // 1. Get a pre-registered schema from the registry
  log(an_v, '1. Get pre-registered "identity-verification" schema')
  const identitySchema = SchemaRegistry.get('identity-verification')
  if (!identitySchema) {
    throw new Error('Identity schema not found')
  }

  // 2. Create an attestation using this schema
  log(an_v, '2. Create an attestation for identity verification')
  const attestationData = {
    fullName: 'John Doe',
    dateOfBirth: new Date('1990-01-15T00:00:00Z').getTime(), // Timestamp in milliseconds
    nationality: 'USA',
    documentType: 'passport',
    verificationLevel: 'premium',
    verifiedBy: 'GA5DBYT33L2JDX3S4O646RLYQRRN7E6VW4Y7H4343TCG3UTMV677F6A5'
  }
  
  const attestation = await client.createAndRegisterAttestation(
    identitySchema, 
    attestationData,
    'GA5DBYT33L2JDX3S4O646RLYQRRN7E6VW4Y7H4343TCG3UTMV677F6A5'
  )
  log(an_ac, '   - Attestation created successfully!')
  
  // 3. Fetch the attestation from the blockchain
  log(an_v, '3. Fetching the attestation from the blockchain')
  const fetchedAttestation = await client.getAttestation(attestation.uid)
  log(an_ac, `   - Fetched attestation with UID: ${fetchedAttestation.uid}`)
  
  // 4. Verify the attestation data
  log(an_v, '4. Verifying the attestation data')
  const decodedData = identitySchema.decode(fetchedAttestation.message)
  
  // Check if decoded data matches the original data
  const isDataValid = 
    decodedData.fullName === attestationData.fullName &&
    Number(decodedData.dateOfBirth) === attestationData.dateOfBirth &&
    decodedData.nationality === attestationData.nationality &&
    decodedData.documentType === attestationData.documentType
    
  if (isDataValid) {
    log(an_ac, '   - Attestation data verified successfully!')
    log(an, `   - Full Name: ${decodedData.fullName}`)
    log(an, `   - Date of Birth: ${new Date(Number(decodedData.dateOfBirth)).toDateString()}`)
  } else {
    log(an_e, '   - Attestation data verification failed.')
  }
}

main().catch(error => {
  log(an_e, 'Error in basic usage example:')
  console.error(error)
})