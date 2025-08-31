/**
 * Horizon Integration Utilities
 * 
 * Functions for interacting with the Horizon API to fetch
 * attestations and schemas from the blockchain.
 */

import { ContractSchema, ContractAttestation } from '../types'
import { HorizonError, NetworkError } from '../errors'

/**
 * Horizon API configuration
 */
export interface HorizonConfig {
  baseUrl: string
  network: 'testnet' | 'mainnet'
}

/**
 * Default Horizon configurations
 */
export const HORIZON_CONFIGS: Record<string, HorizonConfig> = {
  testnet: {
    baseUrl: 'https://horizon-testnet.stellar.org',
    network: 'testnet'
  },
  mainnet: {
    baseUrl: 'https://horizon.stellar.org', 
    network: 'mainnet'
  }
}

/**
 * Registry API endpoints (from apps/horizon)
 */
export const REGISTRY_ENDPOINTS = {
  testnet: 'https://api.testnet.attest.so/registry',
  mainnet: 'https://api.attest.so/registry'
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
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/attestations/ledger/${ledger}?limit=${limit}`
    
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
    
    // Transform the response to match our ContractAttestation type
    return (data.attestations || []).map((item: any) => ({
      uid: Buffer.from(item.uid, 'hex'),
      schemaUid: Buffer.from(item.schemaUid, 'hex'),
      subject: item.subject,
      attester: item.attester,
      value: item.value,
      timestamp: item.timestamp,
      expirationTime: item.expirationTime,
      revocationTime: item.revocationTime,
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
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/schemas/ledger/${ledger}?limit=${limit}`
    
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
    
    // Transform the response to match our ContractSchema type
    return (data.schemas || []).map((item: any) => ({
      uid: Buffer.from(item.uid, 'hex'),
      definition: item.definition,
      authority: item.authority,
      resolver: item.resolver,
      revocable: item.revocable ?? true,
      timestamp: item.timestamp || Date.now()
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
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/attestations/wallet/${walletAddress}?limit=${limit}&offset=${offset}`
    
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
      attestations: (data.attestations || []).map((item: any) => ({
        uid: Buffer.from(item.uid, 'hex'),
        schemaUid: Buffer.from(item.schemaUid, 'hex'),
        subject: item.subject,
        attester: item.attester,
        value: item.value,
        timestamp: item.timestamp,
        expirationTime: item.expirationTime,
        revocationTime: item.revocationTime,
        revoked: item.revoked || false
      })),
      total: data.total || 0,
      hasMore: data.hasMore || false
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
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/schemas/wallet/${walletAddress}?limit=${limit}&offset=${offset}`
    
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
      schemas: (data.schemas || []).map((item: any) => ({
        uid: Buffer.from(item.uid, 'hex'),
        definition: item.definition,
        authority: item.authority,
        resolver: item.resolver,
        revocable: item.revocable ?? true,
        timestamp: item.timestamp || Date.now()
      })),
      total: data.total || 0,
      hasMore: data.hasMore || false
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
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/attestations?limit=${limit}&sort=desc`
    
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
    
    return (data.attestations || []).map((item: any) => ({
      uid: Buffer.from(item.uid, 'hex'),
      schemaUid: Buffer.from(item.schemaUid, 'hex'),
      subject: item.subject,
      attester: item.attester,
      value: item.value,
      timestamp: item.timestamp,
      expirationTime: item.expirationTime,
      revocationTime: item.revocationTime,
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
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/schemas?limit=${limit}&sort=desc`
    
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
    
    return (data.schemas || []).map((item: any) => ({
      uid: Buffer.from(item.uid, 'hex'),
      definition: item.definition,
      authority: item.authority,
      resolver: item.resolver,
      revocable: item.revocable ?? true,
      timestamp: item.timestamp || Date.now()
    }))
  } catch (error: any) {
    if (error instanceof HorizonError) {
      throw error
    }
    throw new NetworkError(`Failed to fetch latest schemas: ${error.message}`, error)
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
    const endpoint = `${REGISTRY_ENDPOINTS[network]}/dump`
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new HorizonError(
        'Failed to fetch registry dump',
        response.status,
        endpoint
      )
    }

    const data = await response.json()
    
    return {
      schemas: (data.schemas || []).map((item: any) => ({
        uid: Buffer.from(item.uid, 'hex'),
        definition: item.definition,
        authority: item.authority,
        resolver: item.resolver,
        revocable: item.revocable ?? true,
        timestamp: item.timestamp || Date.now()
      })),
      attestations: (data.attestations || []).map((item: any) => ({
        uid: Buffer.from(item.uid, 'hex'),
        schemaUid: Buffer.from(item.schemaUid, 'hex'),
        subject: item.subject,
        attester: item.attester,
        value: item.value,
        timestamp: item.timestamp,
        expirationTime: item.expirationTime,
        revocationTime: item.revocationTime,
        revoked: item.revoked || false
      })),
      timestamp: data.timestamp || Date.now(),
      ledger: data.ledger || 0
    }
  } catch (error: any) {
    if (error instanceof HorizonError) {
      throw error
    }
    throw new NetworkError(`Failed to fetch registry dump: ${error.message}`, error)
  }
}