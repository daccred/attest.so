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
  network: 'testnet' | 'mainnet' | 'local'
  registryUrl?: string
}

/**
 * Registry API response interfaces
 */
export interface RegistryPagination {
  total: number
  hasMore: boolean
  limit: number
  offset: number
}

export interface RegistryResponse<T> {
  success: boolean
  data: T[]
  pagination?: RegistryPagination
}

export interface RegistrySingleResponse<T> {
  success: boolean
  data: T
  error?: string
}

/**
 * Raw API data interfaces (as returned from registry router)
 */
export interface RawAttestationData {
  attestation_uid: string
  schema_uid: string
  subjectAddress: string
  attesterAddress: string
  value: any
  createdAt: string
  expiration_time?: number
  revokedAt?: string
  revoked: boolean
  ledger: number
}

export interface RawSchemaData {
  uid: string
  schema_definition?: string
  parsed_schema_definition?: any
  deployerAddress: string
  resolverAddress: string
  revocable: boolean
  createdAt: string
  ledger: number
  type?: string
}

/**
 * Default Horizon configurations with registry endpoints
 */
export const HORIZON_CONFIGS: Record<string, HorizonConfig> = {
  local: {
    network: 'local',
    baseUrl: 'http://localhost:8000',
    registryUrl: 'http://localhost:8000/api/registry',
  },
  testnet: {
    network: 'testnet',
    baseUrl: 'https://horizon-testnet.stellar.org',
    registryUrl: 'https://graph.attest.so/api/registry',
  },
  mainnet: {
    network: 'mainnet',
    baseUrl: 'https://horizon.stellar.org',
    registryUrl: 'https://graph.attest.so/api/registry',
  },
}

/**
 * Registry API endpoints configuration
 * Primarily uses local horizon server instance
 */
export const REGISTRY_ENDPOINTS = {
  testnet:
    process.env.HORIZON_REGISTRY_URL || HORIZON_CONFIGS.testnet.registryUrl || 'https://graph.attest.so/api/registry',
  mainnet:
    process.env.HORIZON_REGISTRY_URL || HORIZON_CONFIGS.mainnet.registryUrl || 'https://graph.attest.so/api/registry',
}

/**
 * Transform raw attestation data to ContractAttestation
 */
function transformAttestation(item: RawAttestationData): ContractAttestation {
  return {
    uid: Buffer.from(item.attestation_uid, 'hex'),
    schemaUid: Buffer.from(item.schema_uid, 'hex'),
    subject: item.subjectAddress,
    attester: item.attesterAddress,
    value: item.value,
    timestamp: new Date(item.createdAt).getTime(),
    expirationTime: item.expiration_time,
    revocationTime: item.revokedAt ? new Date(item.revokedAt).getTime() : undefined,
    revoked: item.revoked || false,
  }
}

/**
 * Transform raw schema data to ContractSchema
 */
function transformSchema(item: RawSchemaData): ContractSchema {
  return {
    uid: Buffer.from(item.uid, 'hex'),
    definition: item.schema_definition || item.parsed_schema_definition,
    authority: item.deployerAddress,
    resolver: item.resolverAddress,
    revocable: item.revocable ?? true,
    timestamp: new Date(item.createdAt).getTime(),
  }
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
    // Enforce maximum limit of 100 items
    const validLimit = Math.min(limit, 100)
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/attestations?by_ledger=${ledger}&limit=${validLimit}`

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new HorizonError(`Failed to fetch attestations for ledger ${ledger}`, response.status, endpoint)
    }

    const apiResponse = (await response.json()) as RegistryResponse<RawAttestationData>

    // Transform the horizon registry API response to match our ContractAttestation type
    return (apiResponse.data || []).map(transformAttestation)
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
    // Enforce maximum limit of 100 items
    const validLimit = Math.min(limit, 100)
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/schemas?by_ledger=${ledger}&limit=${validLimit}`

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new HorizonError(`Failed to fetch schemas for ledger ${ledger}`, response.status, endpoint)
    }

    const apiResponse = (await response.json()) as RegistryResponse<RawSchemaData>

    // Transform the horizon registry API response to match our ContractSchema type
    return (apiResponse.data || []).map(transformSchema)
  } catch (error: any) {
    if (error instanceof HorizonError) {
      throw error
    }
    throw new NetworkError(`Failed to fetch schemas by ledger: ${error.message}`, error)
  }
}

/**
 * Fetch attestations by wallet address
 * Note: Only accepts limit parameter (max 100), no offset support
 */
export async function fetchAttestationsByWallet(
  walletAddress: string,
  limit: number = 100,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{
  attestations: ContractAttestation[]
  total: number
  hasMore: boolean
}> {
  try {
    // Enforce maximum limit of 100 items
    const validLimit = Math.min(limit, 100)
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/attestations?attester=${walletAddress}&limit=${validLimit}`

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new HorizonError(`Failed to fetch attestations for wallet ${walletAddress}`, response.status, endpoint)
    }

    const apiResponse = (await response.json()) as RegistryResponse<RawAttestationData>

    return {
      attestations: (apiResponse.data || []).map(transformAttestation),
      total: apiResponse.pagination?.total || 0,
      hasMore: apiResponse.pagination?.hasMore || false,
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
 * Note: Only accepts limit parameter (max 100), no offset support
 */
export async function fetchSchemasByWallet(
  walletAddress: string,
  limit: number = 100,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{
  schemas: ContractSchema[]
  total: number
  hasMore: boolean
}> {
  try {
    // Enforce maximum limit of 100 items
    const validLimit = Math.min(limit, 100)
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/schemas?deployer=${walletAddress}&limit=${validLimit}`

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new HorizonError(`Failed to fetch schemas for wallet ${walletAddress}`, response.status, endpoint)
    }

    const apiResponse = (await response.json()) as RegistryResponse<RawSchemaData>

    return {
      schemas: (apiResponse.data || []).map(transformSchema),
      total: apiResponse.pagination?.total || 0,
      hasMore: apiResponse.pagination?.hasMore || false,
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
    // Enforce maximum limit of 100 items
    const validLimit = Math.min(limit, 100)
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/attestations?limit=${validLimit}`

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new HorizonError('Failed to fetch latest attestations', response.status, endpoint)
    }

    const apiResponse = (await response.json()) as RegistryResponse<RawAttestationData>

    return (apiResponse.data || []).map(transformAttestation)
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
    // Enforce maximum limit of 100 items
    const validLimit = Math.min(limit, 100)
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/schemas?limit=${validLimit}`

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new HorizonError('Failed to fetch latest schemas', response.status, endpoint)
    }

    const apiResponse = (await response.json()) as RegistryResponse<RawSchemaData>

    return (apiResponse.data || []).map(transformSchema)
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
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new HorizonError(`Failed to fetch attestation ${uid}`, response.status, endpoint)
    }

    const apiResponse = (await response.json()) as RegistrySingleResponse<RawAttestationData>

    return transformAttestation(apiResponse.data)
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
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new HorizonError(`Failed to fetch schema ${uid}`, response.status, endpoint)
    }

    const apiResponse = (await response.json()) as RegistrySingleResponse<RawSchemaData>

    return transformSchema(apiResponse.data)
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
export async function fetchRegistryDump(network: 'testnet' | 'mainnet' = 'testnet'): Promise<RegistryDump> {
  try {
    // Fetch both schemas and attestations in parallel since no single dump endpoint exists
    const [schemasResponse, attestationsResponse] = await Promise.all([
      fetch(`${REGISTRY_ENDPOINTS[network]}/schemas?limit=1000`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }),
      fetch(`${REGISTRY_ENDPOINTS[network]}/attestations?limit=1000`, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }),
    ])

    if (!schemasResponse.ok || !attestationsResponse.ok) {
      throw new HorizonError(
        'Failed to fetch registry dump',
        schemasResponse.status || attestationsResponse.status,
        `${REGISTRY_ENDPOINTS[network]}/schemas and /attestations`
      )
    }

    const [schemasApiResponse, attestationsApiResponse] = await Promise.all([
      schemasResponse.json() as Promise<RegistryResponse<RawSchemaData>>,
      attestationsResponse.json() as Promise<RegistryResponse<RawAttestationData>>,
    ])

    return {
      schemas: (schemasApiResponse.data || []).map(transformSchema),
      attestations: (attestationsApiResponse.data || []).map(transformAttestation),
      timestamp: Date.now(),
      ledger: Math.max(...(attestationsApiResponse.data || []).map((a) => a.ledger || 0), 0),
    }
  } catch (error: any) {
    if (error instanceof HorizonError) {
      throw error
    }
    throw new NetworkError(`Failed to fetch registry dump: ${error.message}`, error)
  }
}
