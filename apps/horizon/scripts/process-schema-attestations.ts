#!/usr/bin/env ts-node

/**
 * Schema Attestation Processor
 * 
 * This script processes each JSONL schema file, matches schema names to values
 * from write-schema.ts, creates attestations for those schemas, and updates
 * the database with category information.
 * 
 * Usage: npx ts-node process-schema-attestations.ts
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Keypair, Transaction } from '@stellar/stellar-sdk';
import * as ProtocolContract from '@attestprotocol/stellar-contracts/protocol';
import { getDB } from '../src/common/db';
import schemaValues from './write-schema';

// Configuration
const ATTEST_PROTOCOL_CONTRACT_ID = 'CBLG2QQ4BLFB7SSOPGYYJJHO5SLQROPRCLKBDMFQWRDXRA4ZXRIRWZW3';
const RPC_URL = 'https://soroban-testnet.stellar.org';
const SCRIPTS_DIR = __dirname;

interface SchemaEntry {
  name: string;
  uid: string;
  category: string;
}

interface ProcessingResult {
  category: string;
  processed: number;
  attestations: number;
  dbUpdates: number;
  errors: string[];
}

/**
 * Fund account using Stellar Friendbot
 */
async function fundAccountIfNeeded(publicKey: string): Promise<void> {
  try {
    console.log(`🏦 Funding account: ${publicKey}`);
    const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
    if (!response.ok) {
      console.warn(`⚠️  Friendbot funding failed for ${publicKey}: ${response.statusText}`);
    } else {
      console.log(`✅ Successfully funded account: ${publicKey}`);
    }
    // Wait for account to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.warn(`❌ Error funding account ${publicKey}:`, error);
  }
}

/**
 * Create an attestation for a schema
 */
async function createAttestation(
  client: ProtocolContract.Client,
  keypair: Keypair,
  schemaUid: string,
  schemaName: string,
  schemaValue: any
): Promise<string | null> {
  try {
    console.log(`📝 Creating attestation for schema: ${schemaName}`);
    
    // Convert schema value to JSON string
    const attestationValue = JSON.stringify(schemaValue);
    
    const tx = await client.attest({
      attester: keypair.publicKey(),
      schema_uid: Buffer.from(schemaUid, 'hex'),
      value: attestationValue,
      expiration_time: undefined // No expiration
    }, {
      fee: 1000000,
      timeoutInSeconds: 60
    });

    const sent = await tx.signAndSend({
      signTransaction: async (xdr: string) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase);
        transaction.sign(keypair);
        return { signedTxXdr: transaction.toXDR() };
      }
    });

    const res = sent.result as ProtocolContract.contract.Result<Buffer>;
    if (res.isOk()) {
      const attestationUid = res.unwrap();
      const uidHex = attestationUid.toString('hex');
      console.log(`✅ Attestation created for ${schemaName} with UID: ${uidHex}`);
      return uidHex;
    } else {
      console.error(`❌ Failed to create attestation for ${schemaName}:`, res.unwrapErr());
      return null;
    }
  } catch (error) {
    console.error(`❌ Error creating attestation for ${schemaName}:`, error);
    return null;
  }
}

/**
 * Update schema category in database
 */
async function updateSchemaCategory(schemaUid: string, category: string): Promise<boolean> {
  try {
    const db = await getDB();
    if (!db) {
      console.error('❌ Database connection not available');
      return false;
    }

    const result = await db.schema.update({
      where: { uid: schemaUid },
      data: { 
        category: category,
        type: category // Also update the type field for consistency
      }
    });

    console.log(`✅ Updated schema ${schemaUid} with category: ${category}`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating schema ${schemaUid} category:`, error);
    return false;
  }
}

/**
 * Process a single JSONL file
 */
async function processJsonlFile(
  filePath: string,
  client: ProtocolContract.Client,
  keypair: Keypair
): Promise<ProcessingResult> {
  const fileName = filePath.split('/').pop() || '';
  const category = fileName.replace('schemas-', '').replace('.jsonl', '');
  
  console.log(`\n📂 Processing category: ${category}`);
  console.log(`📄 File: ${fileName}`);
  
  const result: ProcessingResult = {
    category,
    processed: 0,
    attestations: 0,
    dbUpdates: 0,
    errors: []
  };

  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const lines = fileContent.trim().split('\n').filter(line => line.trim());
    
    console.log(`📊 Found ${lines.length} schemas in ${category} category`);

    for (const line of lines) {
      try {
        const schemaEntry: SchemaEntry = JSON.parse(line);
        result.processed++;
        
        console.log(`\n[${result.processed}/${lines.length}] Processing: ${schemaEntry.name}`);
        
        // Check if we have a matching schema value
        if (!(schemaEntry.name in schemaValues)) {
          const error = `Schema value not found for: ${schemaEntry.name}`;
          console.warn(`⚠️  ${error}`);
          result.errors.push(error);
          continue;
        }

        // Get the schema value
        const schemaValue = schemaValues[schemaEntry.name as keyof typeof schemaValues];
        
        // Create attestation
        const attestationUid = await createAttestation(
          client,
          keypair,
          schemaEntry.uid,
          schemaEntry.name,
          schemaValue
        );
        
        if (attestationUid) {
          result.attestations++;
        }

        // Update database with category
        const dbUpdated = await updateSchemaCategory(schemaEntry.uid, schemaEntry.category);
        if (dbUpdated) {
          result.dbUpdates++;
        }

        // Add delay between operations to avoid rate limiting
        console.log(`⏱️  Waiting 2 seconds before next schema...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        const errorMsg = `Error processing line in ${category}: ${error}`;
        console.error(`❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

  } catch (error) {
    const errorMsg = `Error reading file ${filePath}: ${error}`;
    console.error(`❌ ${errorMsg}`);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Main processing function
 */
async function main() {
  console.log('🚀 Starting Schema Attestation Processing...\n');

  try {
    // Generate keypair for attestations
    const keypair = Keypair.random();
    console.log(`🔑 Generated keypair: ${keypair.publicKey()}`);

    // Fund the account
    await fundAccountIfNeeded(keypair.publicKey());

    // Create protocol client
    const protocolClient = new ProtocolContract.Client({
      contractId: ATTEST_PROTOCOL_CONTRACT_ID,
      networkPassphrase: ProtocolContract.networks.testnet.networkPassphrase,
      rpcUrl: RPC_URL,
      allowHttp: true,
      publicKey: keypair.publicKey()
    });

    // Find all JSONL schema files
    const files = readdirSync(SCRIPTS_DIR)
      .filter(file => file.startsWith('schemas-') && file.endsWith('.jsonl'))
      .map(file => join(SCRIPTS_DIR, file));

    if (files.length === 0) {
      console.log('❌ No schema JSONL files found in scripts directory');
      return;
    }

    console.log(`📋 Found ${files.length} schema files to process:`);
    files.forEach(file => console.log(`  • ${file.split('/').pop()}`));

    // Process each file
    const results: ProcessingResult[] = [];
    for (const file of files) {
      const result = await processJsonlFile(file, protocolClient, keypair);
      results.push(result);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 PROCESSING SUMMARY');
    console.log('='.repeat(60));

    let totalProcessed = 0;
    let totalAttestations = 0;
    let totalDbUpdates = 0;
    let totalErrors = 0;

    results.forEach(result => {
      console.log(`\n📂 Category: ${result.category}`);
      console.log(`   Processed: ${result.processed}`);
      console.log(`   Attestations: ${result.attestations}`);
      console.log(`   DB Updates: ${result.dbUpdates}`);
      console.log(`   Errors: ${result.errors.length}`);
      
      if (result.errors.length > 0) {
        result.errors.forEach(error => console.log(`     ❌ ${error}`));
      }

      totalProcessed += result.processed;
      totalAttestations += result.attestations;
      totalDbUpdates += result.dbUpdates;
      totalErrors += result.errors.length;
    });

    console.log('\n' + '='.repeat(60));
    console.log('🎯 TOTALS');
    console.log('='.repeat(60));
    console.log(`📊 Total Schemas Processed: ${totalProcessed}`);
    console.log(`📝 Total Attestations Created: ${totalAttestations}`);
    console.log(`💾 Total DB Updates: ${totalDbUpdates}`);
    console.log(`❌ Total Errors: ${totalErrors}`);
    console.log(`💰 Account Used: ${keypair.publicKey()}`);

    if (totalErrors === 0) {
      console.log('\n🎉 All schemas processed successfully!');
    } else {
      console.log(`\n⚠️  Processing completed with ${totalErrors} errors. Check logs above for details.`);
    }

  } catch (error) {
    console.error('❌ Schema attestation processing failed:', error);
    process.exit(1);
  }
}

// Execute the main function
if (require.main === module) {
  main().catch(console.error);
}

export { main }; 