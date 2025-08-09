import { describe, it, expect } from 'vitest'
import {
  createSuccessResponse,
  createErrorResponse,
  createAttestProtocolError,
  AttestProtocolErrorType
} from '../src/types'

describe('Core Types', () => {
  describe('AttestSDKResponse helpers', () => {
    it('should create success response correctly', () => {
      const data = { test: 'value' }
      const response = createSuccessResponse(data)
      
      expect(response.data).toEqual(data)
      expect(response.error).toBeUndefined()
    })

    it('should create error response correctly', () => {
      const error = new Error('Test error')
      const response = createErrorResponse(error)
      
      expect(response.data).toBeUndefined()
      expect(response.error).toBe(error)
    })
  })

  describe('AttestProtocolError creation', () => {
    it('should create structured error correctly', () => {
      const error = createAttestProtocolError(
        AttestProtocolErrorType.VALIDATION_ERROR,
        'Test message',
        { extra: 'data' },
        'TEST_CODE'
      )

      expect(error.type).toBe(AttestProtocolErrorType.VALIDATION_ERROR)
      expect(error.message).toBe('Test message')
      expect(error.details).toEqual({ extra: 'data' })
      expect(error.code).toBe('TEST_CODE')
    })

    it('should create error with minimal parameters', () => {
      const error = createAttestProtocolError(
        AttestProtocolErrorType.NETWORK_ERROR,
        'Network failed'
      )

      expect(error.type).toBe(AttestProtocolErrorType.NETWORK_ERROR)
      expect(error.message).toBe('Network failed')
      expect(error.details).toBeUndefined()
      expect(error.code).toBeUndefined()
    })
  })
})