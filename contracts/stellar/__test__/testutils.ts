import fs from 'fs'
import path from 'path'
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import * as ProtocolContract from '../bindings/src/protocol'
import { keccak256 } from 'js-sha3';
import { bls12_381 } from '@noble/curves/bls12-381';
import { sha256 } from '@noble/hashes/sha2';

export interface TestConfig {
  adminSecretKey: string
  rpcUrl: string
  protocolContractId: string
  authorityContractId: string
}

/**
 * Check if a Stellar account exists on the network
 */
export async function accountExists(publicKey: string): Promise<boolean> {
  try {
    const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${publicKey}`)
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * Fund a Stellar account using Friendbot (testnet only)
 * Only funds if the account doesn't exist yet
 */
export async function fundAccountIfNeeded(publicKey: string): Promise<void> {
  const exists = await accountExists(publicKey)
  
  if (exists) {
    console.log(`Account ${publicKey} already exists, skipping funding`)
    return
  }
  
  try {
    console.log(`Funding new account: ${publicKey}`)
    const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`)
    if (!response.ok) {
      console.warn(`Friendbot funding failed for ${publicKey}: ${response.statusText}`)
    } else {
      console.log(`Successfully funded account: ${publicKey}`)
    }
  } catch (error) {
    console.warn(`Error funding account ${publicKey}:`, error)
  }
}

/**
 * Load test configuration from deployments.json and environment
 */
export function loadTestConfig(): TestConfig {
  const deploymentsPath = path.join(__dirname, '..', 'deployments.json')
  
  try {
    // Load deployment data
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'))
    const testnetDeployments = deployments.testnet
    
    if (!testnetDeployments) {
      throw new Error('No testnet deployments found in deployments.json')
    }
    
    const protocolContractId = testnetDeployments.protocol?.id
    const authorityContractId = testnetDeployments.authority?.id
    
    if (!protocolContractId) {
      throw new Error('Protocol contract ID not found in deployments.json')
    }
    
    if (!authorityContractId) {
      throw new Error('Authority contract ID not found in deployments.json')
    }
    
    // Use default testnet values - this matches the 'drew' identity used in deployment
    const adminSecretKey = process.env.ADMIN_SECRET_KEY || 'SBHSWGCYESJSH2JHJGZGYWYP7Z7KQVOCFGO5MZMVDIYXEA7NXGWO2XGC'
    const rpcUrl = 'https://soroban-testnet.stellar.org'
    
    return {
      adminSecretKey,
      rpcUrl,
      protocolContractId,
      authorityContractId
    }
  } catch (error) {
    throw new Error(`Failed to load test configuration: ${error}`)
  }
}

/**
 * Parse environment file content into key-value pairs
 */
function parseEnvFile(content: string): Record<string, string> {
  const envMap: Record<string, string> = {}
  
  for (const line of content.split('\n')) {
    // Skip comments and empty lines
    if (line.trim() && !line.trim().startsWith('#')) {
      // Remove potential 'export ' prefix
      const trimmedLine = line.replace(/^\s*export\s+/, '')
      const [key, ...valueParts] = trimmedLine.split('=')
      
      if (key && valueParts.length > 0) {
        // Remove potential quotes around the value
        let value = valueParts.join('=').trim()
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1)
        }
        envMap[key.trim()] = value
      }
    }
  }
  
  return envMap
}





/**
 * Generates an attestation UID in JavaScript, replicating the logic from the Soroban smart contract.
 *
 * This function takes the same inputs as the Rust `generate_attestation_uid` function,
 * serializes them in the specific way Soroban expects, concatenates them, and then
 * computes the Keccak-256 hash to produce a unique 32-byte identifier.
 * @example
 * const exampleSchemaUid = Buffer.from('11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff', 'hex');
const exampleSubject = 'GA7QYNF7SOWQ3GLR2BGMZEP2PQBH3INKC4DRG343CX5FD2FNU3M4B4K4';
const exampleNonce = 12345n; // Use the 'n' suffix for BigInt literals

// Generate the UID
const attestationUid = generateAttestationUid(exampleSchemaUid, exampleSubject, exampleNonce);

 *
 * @param {Buffer} schemaUid - A 32-byte buffer representing the schema UID.
 * @param {string} subject - The public key string of the subject (e.g., "G...").
 * @param {bigint} nonce - The nonce as a BigInt, which corresponds to a Rust `u64`.
 * @returns {Buffer} A 32-byte buffer representing the calculated attestation UID.
 */
export function generateAttestationUid(schemaUid: Buffer, subject: string, nonce: bigint) {
  if (!(schemaUid instanceof Buffer) || schemaUid.length !== 32) {
    throw new Error('schemaUid must be a 32-byte Buffer.');
  }
  if (typeof subject !== 'string' || !subject.startsWith('G')) {
    throw new Error('subject must be a valid Stellar public key string.');
  }
  if (typeof nonce !== 'bigint') {
    throw new Error('nonce must be a BigInt.');
  }

  // 1. Convert schema_uid (BytesN<32>) to its XDR representation.
  // In Rust: hash_input.append(&schema_uid.to_xdr(env));
  const schemaUidScVal = nativeToScVal(schemaUid);
  const schemaUidXdr = schemaUidScVal.toXDR();

  // 2. Convert subject address (Address) to its XDR representation.
  // In Rust: hash_input.append(&subject.clone().to_xdr(env));
  const subjectAddress = new Address(subject);
  const subjectScVal = subjectAddress.toScVal();
  const subjectXdr = subjectScVal.toXDR();

  // 3. Convert nonce (u64) to an 8-byte big-endian buffer.
  // In Rust: let nonce_bytes = nonce.to_be_bytes();
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64BE(nonce, 0);

  // 4. Concatenate all parts in the correct order.
  // The Rust code appends the XDR of schema_uid, the XDR of the subject,
  // and finally the raw bytes of the nonce.
  const hashInput = Buffer.concat([
    schemaUidXdr,
    subjectXdr,
    nonceBuffer,
  ]);

  // 5. Compute the Keccak-256 hash of the concatenated buffer.
  // In Rust: env.crypto().keccak256(&hash_input).into()
  const hash = keccak256(hashInput);

  // 6. Return the resulting hash as a Buffer.
  return Buffer.from(hash, 'hex');
}
 


/**
 * Creates the message to sign for delegated attestations
 * Must match the exact format from delegation.rs create_attestation_message
 */
export function createAttestationMessage(request: ProtocolContract.DelegatedAttestationRequest, attestationDST: Buffer) {
  // Match exact format from Rust contract: 
  // Domain Separator + Schema UID + Nonce + Deadline + [Expiration Time] + Value Length
  const components: Buffer[] = []
  
  // Domain separation (ATTEST_PROTOCOL_V1_DELEGATED)
  components.push(attestationDST)
  
  // Schema UID (32 bytes)
  components.push(Buffer.from(request.schema_uid))
  
  // Nonce (8 bytes, big-endian u64)
  const nonceBuffer = Buffer.allocUnsafe(8)
  nonceBuffer.writeBigUInt64BE(request.nonce, 0)
  components.push(nonceBuffer)
  
  // Deadline (8 bytes, big-endian u64) 
  const deadlineBuffer = Buffer.allocUnsafe(8)
  deadlineBuffer.writeBigUInt64BE(request.deadline, 0)
  components.push(deadlineBuffer)
  
  // Optional expiration time - skip since request doesn't have it
  
  // Value length (8 bytes, big-endian u64)
  const valueLenBuffer = Buffer.allocUnsafe(8)
  valueLenBuffer.writeBigUInt64BE(BigInt(request.value.length), 0)
  components.push(valueLenBuffer)
  
  const message = Buffer.concat(components)
  return bls12_381.shortSignatures.hash(sha256(message))
}

/**
 * Creates the message to sign for delegated revocations
 * Must match the exact format from delegation.rs create_revocation_message
 */
export function createRevocationMessage(request: ProtocolContract.DelegatedRevocationRequest, revocationDST: Buffer) {
  const components: Buffer[] = []
  
  // Domain separation (REVOKE_PROTOCOL_V1_DELEGATED)
  components.push(revocationDST)
  
  // Schema UID (32 bytes)
  components.push(Buffer.from(request.schema_uid))
  
  // Nonce (8 bytes, big-endian u64)
  const nonceBuffer = Buffer.allocUnsafe(8)
  nonceBuffer.writeBigUInt64BE(request.nonce, 0)
  components.push(nonceBuffer)
  
  // Deadline (8 bytes, big-endian u64)
  const deadlineBuffer = Buffer.allocUnsafe(8)
  deadlineBuffer.writeBigUInt64BE(request.deadline, 0)
  components.push(deadlineBuffer)
  
  const message = Buffer.concat(components)
  return bls12_381.shortSignatures.hash(message)
}


