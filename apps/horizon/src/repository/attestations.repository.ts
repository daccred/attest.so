/**
 * Attestations repository for blockchain attestation management.
 *
 * Provides data access layer for storing and retrieving attestations from
 * the database. Handles attestation upsertion, querying with filtering
 * options, and maintains relationships with schemas.
 *
 * @module repository/attestations
 * @requires common/db
 */

import { getDB } from '../common/db'

// TypeScript interface for attestation API response (source of truth)
export interface Attestation {
  attestation_uid: string
  ledger: number
  schema_uid: string
  attesterAddress: string
  subjectAddress?: string
  transaction_hash: string
  schema_encoding: string
  message: string
  value?: Record<string, any>
  createdAt: string
  revokedAt?: string
  revoked: boolean
}

export interface AttestationFilters {
  ledger?: number
  schemaUid?: string
  attesterAddress?: string
  subjectAddress?: string
  revoked?: boolean
  limit?: number
  offset?: number
}

export interface AttestationData {
  attestationUid: string
  ledger: number
  schemaUid: string
  attesterAddress: string
  subjectAddress?: string
  transactionHash: string
  schemaEncoding: string
  message: string
  value?: Record<string, any>
  revoked?: boolean
  revokedAt?: Date
}

/**
 * Upserts a single attestation in the database.
 *
 * Creates or updates attestation data with proper validation and relationship 
 * linking to schemas. Handles duplicate detection and maintains data integrity.
 */
export async function singleUpsertAttestation(attestationData: AttestationData) {
  const db = await getDB()
  if (!db) {
    console.error('Database not available for singleUpsertAttestation')
    return null
  }

  try {
    const attestation = await db.attestation.upsert({
      where: { attestationUid: attestationData.attestationUid },
      update: {
        revoked: attestationData.revoked || false,
        revokedAt: attestationData.revokedAt,
        lastUpdated: new Date(),
      },
      create: {
        attestationUid: attestationData.attestationUid,
        ledger: attestationData.ledger,
        schemaUid: attestationData.schemaUid,
        attesterAddress: attestationData.attesterAddress,
        subjectAddress: attestationData.subjectAddress,
        transactionHash: attestationData.transactionHash,
        schemaEncoding: attestationData.schemaEncoding,
        message: attestationData.message,
        value: attestationData.value,
        revoked: attestationData.revoked || false,
        revokedAt: attestationData.revokedAt,
      },
      // Removed schema include due to removed foreign key constraint
    })

    console.log(`✅ Upserted attestation: ${attestation.attestationUid}`)
    return attestation
  } catch (error: any) {
    console.error('Error upserting attestation:', error.message)
    return null
  }
}

/**
 * Retrieves attestations with filtering and pagination.
 *
 * Queries attestations with support for multiple filter criteria and
 * pagination. Includes related schema data and proper ordering.
 */
export async function getAttestations(filters: AttestationFilters = {}) {
  const db = await getDB()
  if (!db) {
    console.error('Database not available for getAttestations')
    return { attestations: [], total: 0 }
  }

  try {
    const {
      ledger,
      schemaUid,
      attesterAddress,
      subjectAddress,
      revoked,
      limit = 50,
      offset = 0,
    } = filters

    // Build where clause
    const where: any = {}
    
    if (ledger !== undefined) where.ledger = ledger
    if (schemaUid) where.schemaUid = schemaUid
    if (attesterAddress) where.attesterAddress = attesterAddress
    if (subjectAddress) where.subjectAddress = subjectAddress
    if (revoked !== undefined) where.revoked = revoked

    // Execute queries in parallel
    const [attestations, total] = await Promise.all([
      db.attestation.findMany({
        where,
        // Removed schema include due to removed foreign key constraint
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200), // Enforce max limit
        skip: offset,
      }),
      db.attestation.count({ where }),
    ])

    console.log(`📋 Retrieved ${attestations.length} attestations (${total} total)`)
    return { attestations, total }
  } catch (error: any) {
    console.error('Error retrieving attestations:', error.message)
    return { attestations: [], total: 0 }
  }
}

/**
 * Retrieves a single attestation by UID.
 *
 * Fetches specific attestation with related schema data and full metadata.
 */
export async function getAttestationByUid(attestationUid: string) {
  const db = await getDB()
  if (!db) {
    console.error('Database not available for getAttestationByUid')
    return null
  }

  try {
    const attestation = await db.attestation.findUnique({
      where: { attestationUid },
      // Removed schema include due to removed foreign key constraint
    })

    if (attestation) {
      console.log(`📋 Retrieved attestation: ${attestationUid}`)
    } else {
      console.log(`❌ Attestation not found: ${attestationUid}`)
    }

    return attestation
  } catch (error: any) {
    console.error(`Error retrieving attestation ${attestationUid}:`, error.message)
    return null
  }
}

/**
 * Bulk upsert attestations from blockchain events.
 *
 * Processes multiple attestations for efficient database insertion
 * with duplicate handling. Used by ingestion processes.
 */
export async function bulkUpsertAttestations(attestations: AttestationData[]) {
  const db = await getDB()
  if (!db || attestations.length === 0) {
    return 0
  }

  try {
    let processedCount = 0

    await db.$transaction(async (tx) => {
      for (const attestationData of attestations) {
        try {
          await tx.attestation.upsert({
            where: { attestationUid: attestationData.attestationUid },
            update: {
              revoked: attestationData.revoked || false,
              revokedAt: attestationData.revokedAt,
              lastUpdated: new Date(),
            },
            create: {
              attestationUid: attestationData.attestationUid,
              ledger: attestationData.ledger,
              schemaUid: attestationData.schemaUid,
              attesterAddress: attestationData.attesterAddress,
              subjectAddress: attestationData.subjectAddress,
              transactionHash: attestationData.transactionHash,
              schemaEncoding: attestationData.schemaEncoding,
              message: attestationData.message,
              value: attestationData.value,
              revoked: attestationData.revoked || false,
              revokedAt: attestationData.revokedAt,
            },
          })
          processedCount++
        } catch (error: any) {
          console.error(`Error processing attestation ${attestationData.attestationUid}:`, error.message)
        }
      }
    })

    console.log(`✅ Bulk processed ${processedCount} attestations`)
    return processedCount
  } catch (error: any) {
    console.error('Error in bulk upsert attestations:', error.message)
    return 0
  }
}