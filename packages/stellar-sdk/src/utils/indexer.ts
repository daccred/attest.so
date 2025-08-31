/**
 * Horizon Integration Utilities
 * 
 * Functions for interacting with the Horizon API to fetch
 * attestations and schemas from the blockchain. Integrates with
 * the local horizon server instance primarily, with Stellar horizon
 * as complementary data source.
 */

import { ContractSchema, ContractAttestation } from '../types'
import { HorizonError, NetworkError } from '../common/errors'

/**
 * Horizon API configuration
 */
export interface HorizonConfig {
  baseUrl: string
  network: 'testnet' | 'mainnet'
  registryUrl?: string
}

/**
 * Default Horizon configurations with registry endpoints
 */
export const HORIZON_CONFIGS: Record<string, HorizonConfig> = {
  testnet: {
    baseUrl: 'https://horizon-testnet.stellar.org',
    network: 'testnet',
    registryUrl: 'http://localhost:3001/api/registry'
  },
  mainnet: {
    baseUrl: 'https://horizon.stellar.org', 
    network: 'mainnet',
    registryUrl: 'https://api.attest.so/api/registry'
  }
}

/**
 * Registry API endpoints configuration
 * Primarily uses local horizon server instance
 */
export const REGISTRY_ENDPOINTS = {
  testnet: process.env.HORIZON_REGISTRY_URL || HORIZON_CONFIGS.testnet.registryUrl || 'http://localhost:3001/api/registry',
  mainnet: process.env.HORIZON_REGISTRY_URL || HORIZON_CONFIGS.mainnet.registryUrl || 'https://api.attest.so/api/registry'
}

/**
 * Fetch attestations by ledger number
 */
export async function fetchAttestationsByLedger(
  ledger: number,
  limit: number = 100,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<ContractAttestation[]> {
  try {
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/attestations?by_ledger=${ledger}&limit=${limit}`
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new HorizonError(
        `Failed to fetch attestations for ledger ${ledger}`,
        response.status,
        endpoint
      )
    }

    const data = await response.json()
    
    // Transform the horizon registry API response to match our ContractAttestation type
    return (data.data || []).map((item: any) => ({
      uid: Buffer.from(item.attestation_uid, 'hex'),
      schemaUid: Buffer.from(item.schema_uid, 'hex'),
      subject: item.subjectAddress,
      attester: item.attesterAddress,
      value: item.value,
      timestamp: new Date(item.createdAt).getTime(),
      expirationTime: item.expiration_time,
      revocationTime: item.revokedAt ? new Date(item.revokedAt).getTime() : undefined,
      revoked: item.revoked || false
    }))
  } catch (error: any) {
    if (error instanceof HorizonError) {
      throw error
    }
    throw new NetworkError(`Failed to fetch attestations by ledger: ${error.message}`, error)
  }
}

/**
 * Fetch schemas by ledger number
 */
export async function fetchSchemasByLedger(
  ledger: number,
  limit: number = 100,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<ContractSchema[]> {
  try {
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/schemas?by_ledger=${ledger}&limit=${limit}`
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new HorizonError(
        `Failed to fetch schemas for ledger ${ledger}`,
        response.status,
        endpoint
      )
    }

    const data = await response.json()
    
    // Transform the horizon registry API response to match our ContractSchema type
    return (data.data || []).map((item: any) => ({
      uid: Buffer.from(item.uid, 'hex'),
      definition: item.schema_definition || item.parsed_schema_definition,
      authority: item.deployerAddress,
      resolver: item.resolverAddress,
      revocable: item.revocable ?? true,
      timestamp: new Date(item.createdAt).getTime()
    }))
  } catch (error: any) {
    if (error instanceof HorizonError) {
      throw error
    }
    throw new NetworkError(`Failed to fetch schemas by ledger: ${error.message}`, error)
  }
}

/**
 * Fetch attestations by wallet address
 */
export async function fetchAttestationsByWallet(
  walletAddress: string,
  limit: number = 100,
  offset: number = 0,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{
  attestations: ContractAttestation[]
  total: number
  hasMore: boolean
}> {
  try {
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/attestations?attester=${walletAddress}&limit=${limit}&offset=${offset}`
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new HorizonError(
        `Failed to fetch attestations for wallet ${walletAddress}`,
        response.status,
        endpoint
      )
    }

    const data = await response.json()
    
    return {
      attestations: (data.data || []).map((item: any) => ({
        uid: Buffer.from(item.attestation_uid, 'hex'),
        schemaUid: Buffer.from(item.schema_uid, 'hex'),
        subject: item.subjectAddress,
        attester: item.attesterAddress,
        value: item.value,
        timestamp: new Date(item.createdAt).getTime(),
        expirationTime: item.expiration_time,
        revocationTime: item.revokedAt ? new Date(item.revokedAt).getTime() : undefined,
        revoked: item.revoked || false
      })),
      total: data.pagination?.total || 0,
      hasMore: data.pagination?.hasMore || false
    }
  } catch (error: any) {
    if (error instanceof HorizonError) {
      throw error
    }
    throw new NetworkError(`Failed to fetch attestations by wallet: ${error.message}`, error)
  }
}

/**
 * Fetch schemas by wallet address (schemas created by this wallet)
 */
export async function fetchSchemasByWallet(
  walletAddress: string,
  limit: number = 100,
  offset: number = 0,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{
  schemas: ContractSchema[]
  total: number
  hasMore: boolean
}> {
  try {
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/schemas?deployer=${walletAddress}&limit=${limit}&offset=${offset}`
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new HorizonError(
        `Failed to fetch schemas for wallet ${walletAddress}`,
        response.status,
        endpoint
      )
    }

    const data = await response.json()
    
    return {
      schemas: (data.data || []).map((item: any) => ({
        uid: Buffer.from(item.uid, 'hex'),
        definition: item.schema_definition || item.parsed_schema_definition,
        authority: item.deployerAddress,
        resolver: item.resolverAddress,
        revocable: item.revocable ?? true,
        timestamp: new Date(item.createdAt).getTime()
      })),
      total: data.pagination?.total || 0,
      hasMore: data.pagination?.hasMore || false
    }
  } catch (error: any) {
    if (error instanceof HorizonError) {
      throw error
    }
    throw new NetworkError(`Failed to fetch schemas by wallet: ${error.message}`, error)
  }
}

/**
 * Fetch latest attestations
 */
export async function fetchLatestAttestations(
  limit: number = 100,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<ContractAttestation[]> {
  try {
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/attestations?limit=${limit}`
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new HorizonError(
        'Failed to fetch latest attestations',
        response.status,
        endpoint
      )
    }

    const data = await response.json()
    
    return (data.data || []).map((item: any) => ({
      uid: Buffer.from(item.attestation_uid, 'hex'),
      schemaUid: Buffer.from(item.schema_uid, 'hex'),
      subject: item.subjectAddress,
      attester: item.attesterAddress,
      value: item.value,
      timestamp: new Date(item.createdAt).getTime(),
      expirationTime: item.expiration_time,
      revocationTime: item.revokedAt ? new Date(item.revokedAt).getTime() : undefined,
      revoked: item.revoked || false
    }))
  } catch (error: any) {
    if (error instanceof HorizonError) {
      throw error
    }
    throw new NetworkError(`Failed to fetch latest attestations: ${error.message}`, error)
  }
}

/**
 * Fetch latest schemas
 */
export async function fetchLatestSchemas(
  limit: number = 100,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<ContractSchema[]> {
  try {
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/schemas?limit=${limit}`
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new HorizonError(
        'Failed to fetch latest schemas',
        response.status,
        endpoint
      )
    }

    const data = await response.json()
    
    return (data.data || []).map((item: any) => ({
      uid: Buffer.from(item.uid, 'hex'),
      definition: item.schema_definition || item.parsed_schema_definition,
      authority: item.deployerAddress,
      resolver: item.resolverAddress,
      revocable: item.revocable ?? true,
      timestamp: new Date(item.createdAt).getTime()
    }))
  } catch (error: any) {
    if (error instanceof HorizonError) {
      throw error
    }
    throw new NetworkError(`Failed to fetch latest schemas: ${error.message}`, error)
  }
}

/**
 * Get a single attestation by UID
 */
export async function getAttestationByUid(
  uid: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<ContractAttestation | null> {
  try {
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/attestations/${uid}`
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new HorizonError(
        `Failed to fetch attestation ${uid}`,
        response.status,
        endpoint
      )
    }

    const data = await response.json()
    const item = data.data
    
    return {
      uid: Buffer.from(item.attestation_uid, 'hex'),
      schemaUid: Buffer.from(item.schema_uid, 'hex'),
      subject: item.subjectAddress,
      attester: item.attesterAddress,
      value: item.value,
      timestamp: new Date(item.createdAt).getTime(),
      expirationTime: item.expiration_time,
      revocationTime: item.revokedAt ? new Date(item.revokedAt).getTime() : undefined,
      revoked: item.revoked || false
    }
  } catch (error: any) {
    if (error instanceof HorizonError) {
      throw error
    }
    throw new NetworkError(`Failed to get attestation by UID: ${error.message}`, error)
  }
}

/**
 * Get a single schema by UID
 */
export async function getSchemaByUid(
  uid: string,
  includeAttestations: boolean = false,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<ContractSchema | null> {
  try {
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/schemas/${uid}${includeAttestations ? '?include_attestations=true' : ''}`
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new HorizonError(
        `Failed to fetch schema ${uid}`,
        response.status,
        endpoint
      )
    }

    const data = await response.json()
    const item = data.data
    
    return {
      uid: Buffer.from(item.uid, 'hex'),
      definition: item.schema_definition || item.parsed_schema_definition,
      authority: item.deployerAddress,
      resolver: item.resolverAddress,
      revocable: item.revocable ?? true,
      timestamp: new Date(item.createdAt).getTime()
    }
  } catch (error: any) {
    if (error instanceof HorizonError) {
      throw error
    }
    throw new NetworkError(`Failed to get schema by UID: ${error.message}`, error)
  }
}

/**
 * Registry dump structure for bulk data retrieval
 */
export interface RegistryDump {
  schemas: ContractSchema[]
  attestations: ContractAttestation[]
  timestamp: number
  ledger: number
}

/**
 * Fetch the full registry dump
 */
export async function fetchRegistryDump(
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<RegistryDump> {
  try {
    // Fetch both schemas and attestations in parallel since no single dump endpoint exists
    const [schemasResponse, attestationsResponse] = await Promise.all([
      fetch(`${REGISTRY_ENDPOINTS[network]}/schemas?limit=1000`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
      }),
      fetch(`${REGISTRY_ENDPOINTS[network]}/attestations?limit=1000`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
      })
    ])

    if (!schemasResponse.ok || !attestationsResponse.ok) {
      throw new HorizonError(
        'Failed to fetch registry dump',
        schemasResponse.status || attestationsResponse.status,
        `${REGISTRY_ENDPOINTS[network]}/schemas and /attestations`
      )
    }

    const [schemasData, attestationsData] = await Promise.all([
      schemasResponse.json(),
      attestationsResponse.json()
    ])
    
    return {
      schemas: (schemasData.data || []).map((item: any) => ({
        uid: Buffer.from(item.uid, 'hex'),
        definition: item.schema_definition || item.parsed_schema_definition,
        authority: item.deployerAddress,
        resolver: item.resolverAddress,
        revocable: item.revocable ?? true,
        timestamp: new Date(item.createdAt).getTime()
      })),
      attestations: (attestationsData.data || []).map((item: any) => ({
        uid: Buffer.from(item.attestation_uid, 'hex'),
        schemaUid: Buffer.from(item.schema_uid, 'hex'),
        subject: item.subjectAddress,
        attester: item.attesterAddress,
        value: item.value,
        timestamp: new Date(item.createdAt).getTime(),
        expirationTime: item.expiration_time,
        revocationTime: item.revokedAt ? new Date(item.revokedAt).getTime() : undefined,
        revoked: item.revoked || false
      })),
      timestamp: Date.now(),
      ledger: Math.max(...(attestationsData.data || []).map((a: any) => a.ledger || 0), 0)
    }
  } catch (error: any) {
    if (error instanceof HorizonError) {
      throw error
    }
    throw new NetworkError(`Failed to fetch registry dump: ${error.message}`, error)
  }
}