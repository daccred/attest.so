/**
 * Simple tests for Stellar SDK components
 */

import { describe, it, expect } from 'vitest'
import { StellarAttestProtocol } from '../src/stellar-sdk'
import { StellarConfig } from '../src/types'
import { StellarDataType, SchemaValidationError } from '../src/common/schema-encoder'
import { Keypair } from '@stellar/stellar-sdk'

describe('Stellar SDK Basic Functionality', () => {
  describe('StellarAttestProtocol', () => {
    it('should create instance with valid config', () => {
      const keypair = Keypair.random()
      const config: StellarConfig = {
        secretKeyOrCustomSigner: keypair.secret(),
        publicKey: keypair.publicKey(),
        url: 'https://soroban-testnet.stellar.org'
      }
      
      const sdk = new StellarAttestProtocol(config)
      
      expect(sdk).toBeDefined()
      expect(sdk.getProtocolClient()).toBeDefined()
      expect(sdk.getAuthorityClient()).toBeDefined()
      expect(sdk.getSchemaService()).toBeDefined()
      expect(sdk.getAttestationService()).toBeDefined()
      expect(sdk.getAuthorityService()).toBeDefined()
    })

    it('should use default configuration values', () => {
      const keypair = Keypair.random()
      const config: StellarConfig = {
        secretKeyOrCustomSigner: keypair.secret(),
        publicKey: keypair.publicKey()
      }
      
      const sdk = new StellarAttestProtocol(config)
      expect(sdk).toBeDefined()
    })
  })

  describe('StellarDataType', () => {
    it('should have correct enum values', () => {
      expect(StellarDataType.STRING).toBe('string')
      expect(StellarDataType.BOOL).toBe('bool')
      expect(StellarDataType.U32).toBe('u32')
      expect(StellarDataType.U64).toBe('u64')
      expect(StellarDataType.I32).toBe('i32')
      expect(StellarDataType.I64).toBe('i64')
      expect(StellarDataType.I128).toBe('i128')
      expect(StellarDataType.ADDRESS).toBe('address')
      expect(StellarDataType.BYTES).toBe('bytes')
      expect(StellarDataType.SYMBOL).toBe('symbol')
      expect(StellarDataType.ARRAY).toBe('array')
      expect(StellarDataType.OPTION).toBe('option')
      expect(StellarDataType.MAP).toBe('map')
      expect(StellarDataType.TIMESTAMP).toBe('timestamp')
      expect(StellarDataType.AMOUNT).toBe('amount')
    })
  })

  describe('SchemaValidationError', () => {
    it('should create error with message', () => {
      const message = 'Test validation error'
      const error = new SchemaValidationError(message)
      
      expect(error.message).toBe(message)
      expect(error.name).toBe('SchemaValidationError')
      expect(error instanceof Error).toBe(true)
    })

    it('should create error with field', () => {
      const message = 'Field validation error'
      const field = 'testField'
      const error = new SchemaValidationError(message, field)
      
      expect(error.message).toBe(message)
      expect(error.field).toBe(field)
    })
  })

  describe('Type exports', () => {
    it('should export all required types', () => {
      // This test ensures that all exports from index.ts work
      expect(StellarAttestProtocol).toBeDefined()
      expect(StellarDataType).toBeDefined()
      expect(SchemaValidationError).toBeDefined()
    })
  })
})