/**
 * Tests for StellarAttestationClient implementation
 * 
 * These tests verify the core functionality of the Stellar SDK client
 * as defined in the requirements document.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { StellarAttestationClient } from '../src/client'
import {
  generateAttestationUid,
  generateSchemaUid,
  generateBlsKeys,
  encodeSchema,
  decodeSchema,
  createSimpleSchema
} from '../src/utils'
import { ClientOptions } from '../src/types'
import { Keypair } from '@stellar/stellar-sdk'

const accountKeyPair = Keypair.random();

describe('StellarAttestationClient', () => {
  let client: StellarAttestationClient
  
  beforeAll(async () => {
    // fund our Account KeyPair with the Friendbot API 
    const friendbotUrl = `https://friendbot.stellar.org?addr=${accountKeyPair.publicKey()}`
    await fetch(friendbotUrl)
    .then(response => response.json())
    .then(data => {
      console.log('Friendbot response:', data)
    })
    .catch(error => {
      console.error('Friendbot error:', error)
    })

    const options: ClientOptions = {
      rpcUrl: 'https://soroban-testnet.stellar.org',
      network: 'testnet',
      publicKey: accountKeyPair.publicKey(),
    }
    client = new StellarAttestationClient(options)
  })

  describe('Client Initialization', () => {
    it('should create a client instance', () => {
      expect(client).toBeDefined()
      expect(client.getClientInstance()).toBeDefined()
      expect(client.getServerInstance()).toBeDefined()
    })

    it('should handle mainnet configuration', () => {
      const mainnetClient = new StellarAttestationClient({
        rpcUrl: 'https://soroban.stellar.org',
        network: 'mainnet',
        publicKey: accountKeyPair.publicKey(),
      })
      expect(mainnetClient).toBeDefined()
    })

    it('should accept custom contract ID', () => {
      const customClient = new StellarAttestationClient({
        rpcUrl: 'https://soroban-testnet.stellar.org',
        contractId: 'CCUSTOMCONTRACTIDEXAMPLE123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        publicKey: accountKeyPair.publicKey(),
      })
      expect(customClient).toBeDefined()
    })
  })

  describe('UID Generation (Items 4-5)', () => {
    it('should generate attestation UID', () => {
      const schemaUid = Buffer.alloc(32, 1)
      const subject = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const nonce = BigInt(12345)
      
      const uid = client.generateAttestationUid(schemaUid, subject, nonce)
      
      expect(uid).toBeInstanceOf(Buffer)
      expect(uid.length).toBe(32)
    })

    it('should generate deterministic attestation UIDs', () => {
      const schemaUid = Buffer.alloc(32, 2)
      const subject = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const nonce = BigInt(99999)
      
      const uid1 = generateAttestationUid(schemaUid, subject, nonce)
      const uid2 = generateAttestationUid(schemaUid, subject, nonce)
      
      expect(uid1.equals(uid2)).toBe(true)
    })

    it('should generate schema UID', () => {
      const definition = 'name:string,age:u32'
      const authority = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      
      const uid = client.generateSchemaUid(definition, authority)
      
      expect(uid).toBeInstanceOf(Buffer)
      expect(uid.length).toBe(32)
    })

    it('should generate deterministic schema UIDs', () => {
      const definition = 'name:string,verified:bool'
      const authority = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
      const resolver = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF'
      
      const uid1 = generateSchemaUid(definition, authority, resolver)
      const uid2 = generateSchemaUid(definition, authority, resolver)
      
      expect(uid1.equals(uid2)).toBe(true)
    })
  })

  describe('BLS Key Generation (Item 13)', () => {
    it('should generate BLS key pairs', () => {
      const keyPair = client.generateBlsKeys()
      
      expect(keyPair).toBeDefined()
      expect(keyPair.publicKey).toBeInstanceOf(Buffer)
      expect(keyPair.privateKey).toBeInstanceOf(Buffer)
      expect(keyPair.publicKey.length).toBe(192) // Uncompressed G2 point
      expect(keyPair.privateKey.length).toBe(32)
    })

    it('should generate different keys each time', () => {
      const keyPair1 = generateBlsKeys()
      const keyPair2 = generateBlsKeys()
      
      expect(keyPair1.privateKey.equals(keyPair2.privateKey)).toBe(false)
      expect(keyPair1.publicKey.equals(keyPair2.publicKey)).toBe(false)
    })
  })

  describe('Schema Encoding/Decoding (Items 14-15)', () => {
    it('should encode schema to XDR', () => {
      const schema = createSimpleSchema('TestSchema', [
        { name: 'field1', type: 'string' },
        { name: 'field2', type: 'u32', optional: true }
      ])
      
      const encoded = client.encodeSchema(schema)
      
      expect(encoded).toBeDefined()
      expect(encoded).toMatch(/^XDR:/)
      expect(encoded.length).toBeGreaterThan(10)
    })

    it('should decode XDR schema', () => {
      const originalSchema = createSimpleSchema('TestSchema', [
        { name: 'username', type: 'string' },
        { name: 'age', type: 'u32' }
      ])
      
      const encoded = encodeSchema(originalSchema)
      const decoded = client.decodeSchema(encoded)
      
      expect(decoded).toBeDefined()
      expect(decoded.name).toBe('TestSchema')
      expect(decoded.fields).toHaveLength(2)
      expect(decoded.fields[0].name).toBe('username')
      expect(decoded.fields[0].type).toBe('string')
    })

    it('should handle JSON schema format', () => {
      const jsonSchema = {
        name: 'JSONSchema',
        version: '1.0',
        description: 'Test JSON schema',
        fields: [
          { name: 'id', type: 'u64', optional: false }
        ]
      }
      
      const jsonString = JSON.stringify(jsonSchema)
      const decoded = decodeSchema(jsonString)
      
      expect(decoded).toBeDefined()
      expect(decoded.name).toBe('JSONSchema')
      expect(decoded.fields).toHaveLength(1)
    })
  })

  describe('Message Creation (Items 9-10)', () => {
    it('should create attestation message for delegation', () => {
      const request = {
        schema_uid: Buffer.alloc(32, 3),
        subject: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        attester: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
        value: 'test-value',
        nonce: BigInt(1000),
        deadline: BigInt(Date.now() + 3600000),
        expiration_time: undefined,
        signature: Buffer.alloc(96) // Placeholder
      }
      
      const dst = Buffer.from('ATTEST_PROTOCOL_V1_DELEGATED', 'utf8')
      const message = client.createAttestMessage(request, dst)
      
      expect(message).toBeInstanceOf(Buffer)
      expect(message.length).toBeGreaterThan(0)
    })

    it('should create revocation message for delegation', () => {
      const request = {
        attestationUid: Buffer.alloc(32, 4),
        revoker: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        nonce: BigInt(2000),
        deadline: BigInt(Date.now() + 3600000),
        signature: Buffer.alloc(96) // Placeholder
      }
      
      const dst = Buffer.from('REVOKE_PROTOCOL_V1_DELEGATED', 'utf8')
      const message = client.createRevokeMessage(request, dst)
      
      expect(message).toBeInstanceOf(Buffer)
      expect(message.length).toBeGreaterThan(0)
    })
  })

  describe('Signature Verification (Item 16)', () => {
    it('should verify signature structure', () => {
      const keyPair = generateBlsKeys()
      const validSignature = Buffer.alloc(96, 1) // Mock signature
      
      const result = client.verifySignature(
        validSignature,
        keyPair.publicKey
      )
      
      expect(result).toBeDefined()
      expect(result.isValid).toBeDefined()
    })

    it('should reject invalid signature length', () => {
      const keyPair = generateBlsKeys()
      const invalidSignature = Buffer.alloc(50) // Wrong size
      
      const result = client.verifySignature(
        invalidSignature,
        keyPair.publicKey
      )
      
      expect(result.isValid).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should throw error for invalid schema UID in attestation generation', () => {
      expect(() => {
        generateAttestationUid(
          Buffer.alloc(16), // Wrong size
          'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
          BigInt(1)
        )
      }).toThrow('schemaUid must be a 32-byte Buffer')
    })

    it('should throw error for invalid subject in attestation generation', () => {
      expect(() => {
        generateAttestationUid(
          Buffer.alloc(32),
          'invalid-address',
          BigInt(1)
        )
      }).toThrow('subject must be a valid Stellar public key')
    })

    it('should throw error when contract ID is missing', () => {
      expect(() => {
        new StellarAttestationClient({
          rpcUrl: 'https://soroban-testnet.stellar.org',
          network: 'futurenet' as any // Network without default contract
        })
      }).toThrow()
    })
  })
})