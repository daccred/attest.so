/**
 * Example: Wallet-specific queries with the Stellar SDK
 * 
 * This example demonstrates how to fetch attestations and schemas
 * associated with specific wallet addresses.
 */

import { ClientOptions, StellarClient } from '../src'
import { log, an, an_v, an_c, an_ac, an_e } from './logger'
import { registerCommonSchemas } from './commonSchemas'
import { ExampleSchemaRegistry as Registry } from './registry'


async function main() {
  log(an_c, 'Stellar Attestation SDK - Wallet-specific Queries Example')

  // Register common schemas to have some data context
  registerCommonSchemas()

  // Initialize the client
  const options = {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    network: 'testnet'
  }
  
  const client = new StellarClient(options as ClientOptions)
  
  // Example wallet address (replace with actual address)
  const walletAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
  
  log(an_v, `1. Fetching attestations for wallet: ${walletAddress}`)
  
  try {
    // 1. Fetch attestations where this wallet is the attester
    log(an_v, '📜 Fetching attestations by wallet...')
    const attestationsResult = await client.fetchAttestationsByWallet(
      walletAddress,
      10,  // limit to 10 results
      0    // start from beginning
    )
    
    log(an_ac, `Found ${attestationsResult.total} total attestations`)
    log(an_ac, `Showing ${attestationsResult.attestations.length} attestations`)
    log(an_ac, `Has more pages: ${attestationsResult.hasMore}`)
    
    // Display attestation details
    attestationsResult.attestations.forEach((attestation, index) => {
      log(an, `\nAttestation ${index + 1}:`)
      log(an_ac, `  UID: ${attestation.uid.toString('hex')}`)
      log(an_ac, `  Schema UID: ${attestation.schemaUid.toString('hex')}`)
      log(an_ac, `  Subject: ${attestation.subject}`)
      log(an_ac, `  Value: ${attestation.value}`)
      log(an_ac, `  Revoked: ${attestation.revoked}`)
    })
    
    // 2. Fetch schemas created by this wallet
    log(an_v, '\n📋 Fetching schemas by wallet...')
    const schemasResult = await client.fetchSchemasByWallet(
      walletAddress,
      10,  // limit to 10 results
      0    // start from beginning
    )
    
    log(an_ac, `Found ${schemasResult.total} total schemas`)
    log(an_ac, `Showing ${schemasResult.schemas.length} schemas`)
    log(an_ac, `Has more pages: ${schemasResult.hasMore}`)
    
    // Display schema details
    schemasResult.schemas.forEach((schema, index) => {
      log(an, `\nSchema ${index + 1}:`)
      log(an_ac, `  UID: ${schema.uid.toString('hex')}`)
      log(an_ac, `  Definition: ${schema.definition}`)
      log(an_ac, `  Authority: ${schema.authority}`)
      log(an_ac, `  Revocable: ${schema.revocable}`)
      if (schema.resolver) {
        log(an_ac, `  Resolver: ${schema.resolver}`)
      }
    })
    
    // 3. Demonstrate pagination
    if (attestationsResult.hasMore) {
      log(an_v, '\n📖 Fetching next page of attestations...')
      const nextPage = await client.fetchAttestationsByWallet(
        walletAddress,
        10,   // limit
        10    // offset by previous limit to get next page
      )
      
      log(an_ac, `Next page has ${nextPage.attestations.length} attestations`)
    }
    
    // 4. Cross-reference: Find attestations using schemas created by this wallet
    if (schemasResult.schemas.length > 0) {
      log(an_v, '\n🔗 Cross-referencing schemas and attestations...')
      
      const firstSchema = schemasResult.schemas[0]
      log(an_ac, `Looking for attestations using schema: ${firstSchema.uid.toString('hex')}`)
      
      // Filter attestations that use this schema
      const relatedAttestations = attestationsResult.attestations.filter(
        att => att.schemaUid.equals(firstSchema.uid)
      )
      
      log(an_ac, `Found ${relatedAttestations.length} attestations using this schema`)
    }
    
    // 5. Advanced: Fetch and analyze wallet activity patterns
    log(an_v, '\n📊 Analyzing wallet activity...')
    
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
    
    log(an, 'Wallet Statistics:')
    log(an_ac, `  Total Attestations: ${stats.total}`)
    log(an_ac, `  Active: ${stats.active}`)
    log(an_ac, `  Revoked: ${stats.revoked}`)
    log(an_ac, `  Expired: ${stats.expired}`)
    
    // Find most used schema
    const schemaUsage = new Map<string, number>()
    allAttestations.attestations.forEach(att => {
      const schemaName = Registry.list().find(name => {
        const encoder = Registry.get(name)
        //@ts-ignore
        return encoder?.getSchema().metadata.equals(att.schemaUid)
      }) || 'Unknown Schema'
      
      schemaUsage.set(schemaName, (schemaUsage.get(schemaName) || 0) + 1)
    })
    
    if (schemaUsage.size > 0) {
      const mostUsedSchema = Array.from(schemaUsage.entries())
        .sort((a, b) => b[1] - a[1])[0]
      
      log(an_ac, `  Most Used Schema: ${mostUsedSchema[0]} (${mostUsedSchema[1]} uses)`)
    }

    log(an, '   Schema Usage Patterns:')
    for (const [schemaName, count] of schemaUsage.entries()) {
      const encoder = Registry.get(schemaName)
      const description = encoder ? `(${encoder.getSchema().description})` : ''
      log(an_ac, `     - "${schemaName}" used ${count} time(s) ${description}`)
    }
  } catch (error) {
    log(an_e, '   - Error querying wallet data:')
    log(an_e, `     - ${error.message}`)
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