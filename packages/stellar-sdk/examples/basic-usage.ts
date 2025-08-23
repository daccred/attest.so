/**
 * Basic usage example for Stellar Attest Protocol SDK
 */

import { StellarAttestProtocol, StellarDataType } from '../src'
import { Keypair, Networks } from '@stellar/stellar-sdk'

// Example configuration for testnet
async function basicUsageExample() {
  console.log('🌟 Stellar Attest Protocol SDK - Basic Usage Example')
  
  // Generate a keypair for testing (in production, use your actual keypair)
  const keypair = Keypair.random()
  console.log('Generated test keypair:', keypair.publicKey())
  
  // Initialize the SDK
  const sdk = new StellarAttestProtocol({
    secretKeyOrCustomSigner: keypair.secret(),
    publicKey: keypair.publicKey(),
    url: 'https://soroban-testnet.stellar.org',
    networkPassphrase: Networks.TESTNET,
    contractAddresses: {
      protocol: 'CBRNU64BJDQMRZJYNEZLZ7HYF4L2IJ2MMKS6QWH4R7TIUBYOMW62UMDU',
      authority: 'CDI6DGF4MOFHHPGV647OUE33PNZSPER43KDULACAVLFVJBWHBCB4SCJG'
    }
  })
  
  console.log('✅ SDK initialized')
  
  // Example 1: Generate schema ID
  console.log('\n📋 Example 1: Generate Schema ID')
  const schemaDefinition = {
    content: 'string name, uint32 age, bool verified',
    revocable: true
  }
  
  const schemaIdResult = await sdk.generateIdFromSchema(schemaDefinition)
  if (schemaIdResult.success) {
    console.log('Schema ID:', schemaIdResult.data)
  } else {
    console.error('Failed to generate schema ID:', schemaIdResult.error)
  }
  
  // Example 2: Check available data types
  console.log('\n🏷️  Example 2: Available Data Types')
  console.log('Available data types:')
  Object.values(StellarDataType).forEach(type => {
    console.log(`  - ${type}`)
  })
  
  // Example 3: Access service components
  console.log('\n🔧 Example 3: Service Components')
  console.log('Protocol Client:', !!sdk.getProtocolClient())
  console.log('Authority Client:', !!sdk.getAuthorityClient())
  console.log('Schema Service:', !!sdk.getSchemaService())
  console.log('Attestation Service:', !!sdk.getAttestationService())
  console.log('Authority Service:', !!sdk.getAuthorityService())
  
  console.log('\n🎉 Basic usage example completed!')
  
  // Note: For live operations (initialize, createSchema, issueAttestation, etc.)
  // you would need a funded testnet account and proper contract initialization
  console.log('\n💡 Next steps:')
  console.log('  1. Fund your account with testnet XLM from https://laboratory.stellar.org/')
  console.log('  2. Initialize the protocol: await sdk.initialize()')
  console.log('  3. Create schemas and issue attestations')
}

// Run the example
if (require.main === module) {
  basicUsageExample().catch(console.error)
}

export { basicUsageExample }