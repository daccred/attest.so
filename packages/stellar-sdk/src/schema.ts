/**
 * Schema operations for the Stellar Attest Protocol
 */

import {
  AttestProtocolResponse,
  Schema,
  SchemaDefinition,
  ListSchemasByIssuerParams,
  PaginatedResponse,
  AttestProtocolErrorType,
  createSuccessResponse,
  createErrorResponse,
  createAttestProtocolError,
} from '@attestprotocol/core'

import { Client as ProtocolClient } from '@attestprotocol/stellar/dist/protocol'
import { Address, scValToNative } from '@stellar/stellar-sdk'
import { StellarConfig } from './types'
import { StellarSchemaEncoder, StellarSchemaDefinition } from './common/schema-encoder'

export class StellarSchemaRegistry {
  private protocolClient: ProtocolClient
  private publicKey: string

  constructor(config: StellarConfig, protocolClient: ProtocolClient) {
    this.protocolClient = protocolClient
    this.publicKey = config.publicKey
  }

  /**
   * Create a new schema using structured schema definition with validation
   */
  async createStructuredSchema(
    schemaDefinition: StellarSchemaDefinition,
    options?: {
      resolver?: string;
      revocable?: boolean;
      format?: 'xdr' | 'json';
    }
  ): Promise<AttestProtocolResponse<Schema>> {
    try {
      // Validate and encode the structured schema
      const encoder = new StellarSchemaEncoder(schemaDefinition);
      
      // Choose encoding format
      let schemaString: string;
      switch (options?.format || 'xdr') {
        case 'xdr':
          schemaString = encoder.toXDR();
          break;
        case 'json':
          schemaString = JSON.stringify(schemaDefinition);
          break;
        default:
          schemaString = encoder.toXDR();
      }
      
      // Use the standard createSchema method with encoded string
      return await this.createSchema({
        name: schemaDefinition.name,
        content: schemaString,
        resolver: options?.resolver,
        revocable: options?.revocable ?? true
      });
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          `Schema validation failed: ${error.message}`
        )
      );
    }
  }

  /**
   * Create a new schema on the Stellar network (accepts raw string or structured definition)
   */
  async createSchema(config: SchemaDefinition): Promise<AttestProtocolResponse<Schema>> {
    try {
      const validationError = this.validateSchemaDefinition(config)
      if (validationError) return createErrorResponse(validationError)

      const caller = this.publicKey
      const schemaDefinition = config.content
      const resolver = config.resolver || null
      const revocable = config.revocable ?? true

      const tx = await this.protocolClient.register({
        caller,
        schema_definition: schemaDefinition,
        resolver,
        revocable
      })

      const result = await tx.signAndSend()
      
      if (!result.returnValue) {
        throw createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          'Failed to get schema UID from transaction'
        )
      }

      const uid = scValToNative(result.returnValue).toString('hex')

      return createSuccessResponse({
        uid,
        definition: config.content,
        authority: caller,
        revocable: config.revocable ?? true,
        resolver: config.resolver || null,
      })
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to create schema'
        )
      )
    }
  }

  /**
   * Fetch a schema by its UID
   */
  async fetchSchemaById(id: string): Promise<AttestProtocolResponse<Schema | null>> {
    try {
      if (!/^[0-9a-fA-F]{64}$/.test(id)) {
        throw createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          'Invalid schema UID format. Expected a 64-character hex string.'
        )
      }

      const schemaUid = Buffer.from(id, 'hex')

      // Note: The current protocol contract doesn't have a get_schema method
      // This would need to be implemented in the contract or we'd need to use events/indexing
      return createSuccessResponse(null)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to fetch schema'
        )
      )
    }
  }

  /**
   * Parse a schema definition string into structured format if possible
   */
  parseSchemaDefinition(schemaString: string): { 
    encoder: StellarSchemaEncoder | null; 
    format: 'xdr' | 'json' | 'unknown' 
  } {
    // Try XDR format first
    if (schemaString.startsWith('XDR:')) {
      try {
        const encoder = StellarSchemaEncoder.fromXDR(schemaString);
        return { encoder, format: 'xdr' };
      } catch {
        return { encoder: null, format: 'unknown' };
      }
    }

    // Try JSON format
    try {
      const parsed = JSON.parse(schemaString);
      
      // Check if it looks like our structured format
      if (parsed.name && parsed.version && parsed.fields && Array.isArray(parsed.fields)) {
        const encoder = new StellarSchemaEncoder(parsed as StellarSchemaDefinition);
        return { encoder, format: 'json' };
      }
    } catch {
      // Not JSON
    }

    return { encoder: null, format: 'unknown' };
  }

  /**
   * Create a schema encoder from a schema UID (fetch from contract and parse)
   */
  async createEncoderFromSchema(schemaUID: string): Promise<AttestProtocolResponse<{
    encoder: StellarSchemaEncoder | null;
    format: 'xdr' | 'json' | 'unknown';
  }>> {
    try {
      const schemaResponse = await this.fetchSchemaById(schemaUID);
      if (schemaResponse.error || !schemaResponse.data) {
        return createSuccessResponse({ encoder: null, format: 'unknown' });
      }

      const parsed = this.parseSchemaDefinition(schemaResponse.data.definition);
      return createSuccessResponse(parsed);
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          `Failed to create encoder: ${error.message}`
        )
      );
    }
  }

  /**
   * Generate a deterministic ID from schema definition
   */
  async generateIdFromSchema(schema: SchemaDefinition): Promise<AttestProtocolResponse<string>> {
    try {
      const { generateIdFromSchema: generateId } = await import('./common')
      const uid = await generateId(schema, this.publicKey)
      return createSuccessResponse(uid)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          error.message || 'Failed to generate schema ID'
        )
      )
    }
  }

  /**
   * List schemas by issuer
   */
  async listSchemasByIssuer(
    params: ListSchemasByIssuerParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Schema>>> {
    try {
      // This would require indexing or event querying in a real implementation
      // For now, return empty results
      const emptyResponse: PaginatedResponse<Schema> = {
        items: [],
        total: 0,
        limit: params.limit ?? 10,
        offset: params.offset ?? 0,
        hasMore: false
      }
      
      return createSuccessResponse(emptyResponse)
    } catch (error: any) {
      return createErrorResponse(
        createAttestProtocolError(
          AttestProtocolErrorType.NETWORK_ERROR,
          error.message || 'Failed to list schemas'
        )
      )
    }
  }

  /**
   * Validate schema definition
   */
  private validateSchemaDefinition(config: SchemaDefinition): any {
    if (!config.content || config.content.trim() === '') {
      return createAttestProtocolError(
        AttestProtocolErrorType.VALIDATION_ERROR,
        'Schema content is required'
      )
    }

    if (config.resolver) {
      try {
        Address.fromString(config.resolver)
      } catch {
        return createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          'Invalid resolver address format'
        )
      }
    }

    return null
  }
}