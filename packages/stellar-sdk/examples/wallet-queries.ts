/**
 * Example: Wallet-specific queries with the Stellar SDK
 * 
 * This example demonstrates how to fetch attestations and schemas
 * associated with specific wallet addresses.
 */

import { StellarClient, ClientOptions } from '../src'

async function main() {
  // Initialize the client
  const options: ClientOptions = {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    network: 'testnet'
  }
  
  const client = new StellarClient(options)
  
  // Example wallet address (replace with actual address)
  const walletAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
  
  console.log(`\n🔍 Querying data for wallet: ${walletAddress}\n`)
  
  try {
    // 1. Fetch attestations where this wallet is the attester
    console.log('📜 Fetching attestations by wallet...')
    const attestationsResult = await client.fetchAttestationsByWallet(
      walletAddress,
      10,  // limit to 10 results
      0    // start from beginning
    )
    
    console.log(`Found ${attestationsResult.total} total attestations`)
    console.log(`Showing ${attestationsResult.attestations.length} attestations`)
    console.log(`Has more pages: ${attestationsResult.hasMore}`)
    
    // Display attestation details
    attestationsResult.attestations.forEach((attestation, index) => {
      console.log(`\nAttestation ${index + 1}:`)
      console.log(`  UID: ${attestation.uid.toString('hex')}`)
      console.log(`  Schema UID: ${attestation.schemaUid.toString('hex')}`)
      console.log(`  Subject: ${attestation.subject}`)
      console.log(`  Value: ${attestation.value}`)
      console.log(`  Revoked: ${attestation.revoked}`)
    })
    
    // 2. Fetch schemas created by this wallet
    console.log('\n📋 Fetching schemas by wallet...')
    const schemasResult = await client.fetchSchemasByWallet(
      walletAddress,
      10,  // limit to 10 results
      0    // start from beginning
    )
    
    console.log(`Found ${schemasResult.total} total schemas`)
    console.log(`Showing ${schemasResult.schemas.length} schemas`)
    console.log(`Has more pages: ${schemasResult.hasMore}`)
    
    // Display schema details
    schemasResult.schemas.forEach((schema, index) => {
      console.log(`\nSchema ${index + 1}:`)
      console.log(`  UID: ${schema.uid.toString('hex')}`)
      console.log(`  Definition: ${schema.definition}`)
      console.log(`  Authority: ${schema.authority}`)
      console.log(`  Revocable: ${schema.revocable}`)
      if (schema.resolver) {
        console.log(`  Resolver: ${schema.resolver}`)
      }
    })
    
    // 3. Demonstrate pagination
    if (attestationsResult.hasMore) {
      console.log('\n📖 Fetching next page of attestations...')
      const nextPage = await client.fetchAttestationsByWallet(
        walletAddress,
        10,   // limit
        10    // offset by previous limit to get next page
      )
      
      console.log(`Next page has ${nextPage.attestations.length} attestations`)
    }
    
    // 4. Cross-reference: Find attestations using schemas created by this wallet
    if (schemasResult.schemas.length > 0) {
      console.log('\n🔗 Cross-referencing schemas and attestations...')
      
      const firstSchema = schemasResult.schemas[0]
      console.log(`Looking for attestations using schema: ${firstSchema.uid.toString('hex')}`)
      
      // Filter attestations that use this schema
      const relatedAttestations = attestationsResult.attestations.filter(
        att => att.schemaUid.equals(firstSchema.uid)
      )
      
      console.log(`Found ${relatedAttestations.length} attestations using this schema`)
    }
    
    // 5. Advanced: Fetch and analyze wallet activity patterns
    console.log('\n📊 Analyzing wallet activity...')
    
    // Get all attestations (up to 100)
    const allAttestations = await client.fetchAttestationsByWallet(walletAddress, 100, 0)
    
    // Analyze attestation patterns
    const stats = {
      total: allAttestations.total,
      revoked: allAttestations.attestations.filter(a => a.revoked).length,
      expired: allAttestations.attestations.filter(a => 
        a.expirationTime && a.expirationTime < Date.now()
      ).length,
      active: 0
    }
    
    stats.active = stats.total - stats.revoked - stats.expired
    
    console.log('Wallet Statistics:')
    console.log(`  Total Attestations: ${stats.total}`)
    console.log(`  Active: ${stats.active}`)
    console.log(`  Revoked: ${stats.revoked}`)
    console.log(`  Expired: ${stats.expired}`)
    
    // Find most used schema
    const schemaUsage = new Map<string, number>()
    allAttestations.attestations.forEach(att => {
      const schemaId = att.schemaUid.toString('hex')
      schemaUsage.set(schemaId, (schemaUsage.get(schemaId) || 0) + 1)
    })
    
    if (schemaUsage.size > 0) {
      const mostUsedSchema = Array.from(schemaUsage.entries())
        .sort((a, b) => b[1] - a[1])[0]
      
      console.log(`  Most Used Schema: ${mostUsedSchema[0]} (${mostUsedSchema[1]} uses)`)
    }
    
  } catch (error) {
    console.error('Error querying wallet data:', error)
  }
}

// Run the example
main().catch(console.error)

/**
 * Example output:
 * 
 * 🔍 Querying data for wallet: GAAA...AWHF
 * 
 * 📜 Fetching attestations by wallet...
 * Found 25 total attestations
 * Showing 10 attestations
 * Has more pages: true
 * 
 * Attestation 1:
 *   UID: a3f2b8c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
 *   Schema UID: 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
 *   Subject: GBBB...BWHF
 *   Value: {"verified": true, "level": "premium"}
 *   Revoked: false
 * 
 * 📋 Fetching schemas by wallet...
 * Found 5 total schemas
 * Showing 5 schemas
 * Has more pages: false
 * 
 * Schema 1:
 *   UID: 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
 *   Definition: XDR:AAAA...
 *   Authority: GAAA...AWHF
 *   Revocable: true
 * 
 * 📊 Analyzing wallet activity...
 * Wallet Statistics:
 *   Total Attestations: 25
 *   Active: 20
 *   Revoked: 3
 *   Expired: 2
 *   Most Used Schema: 1234567890abcdef... (15 uses)
 */