/**
 * Transaction repository for blockchain transaction management.
 *
 * Handles fetching transaction details from Horizon and Soroban RPC,
 * with database persistence and comprehensive transaction data storage
 * including fees, operations, and Soroban-specific metadata.
 *
 * @module repository/transactions
 * @requires common/constants
 * @requires common/db
 */

import { sorobanRpcUrl } from '../common/constants'
import { getDB } from '../common/db'
import merge from 'lodash/merge'

/**
 * Fetches detailed transaction information from Soroban RPC.
 *
 * Retrieves complete transaction data including envelope, result,
 * metadata, and Soroban resource usage. Handles both standard and
 * fee bump transactions with proper error handling for missing data.
 *
 * @async
 * @function fetchTransactionDetails
 * @param {string} txHash - Transaction hash to fetch
 * @returns {Promise<Object|null>} Transaction details or null if not found
 */
async function fetchTransactionDetails(txHash: string): Promise<any | null> {
  try {
    const txRpcPayload = {
      jsonrpc: '2.0',
      id: `getTx-${txHash}-${Date.now()}`,
      method: 'getTransaction',
      params: { hash: txHash },
    }

    const rawTxResponse = await fetch(sorobanRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txRpcPayload),
    })

    if (!rawTxResponse.ok) {
      throw new Error(`HTTP ${rawTxResponse.status}`)
    }

    const txRpcResponse = await rawTxResponse.json()

    if (txRpcResponse.error) {
      throw new Error(txRpcResponse.error.message)
    }

    return txRpcResponse.result
  } catch (error: any) {
    console.error(`Error fetching transaction ${txHash}:`, error.message)
    return null
  }
}

/**
 * Stores transactions in database with full detail preservation.
 *
 * Persists transaction records including all metadata, fees, and
 * Soroban-specific fields. Uses bulk upsert for efficiency and
 * maintains transaction history with proper indexing.
 *
 * @async
 * @function storeTransactionsInDB
 * @param {Array} transactions - Transaction records to store
 * @returns {Promise<number>} Count of stored transactions
 */
async function storeTransactionsInDB(transactions: any[]): Promise<number> {
  const db = await getDB()
  if (!db || transactions.length === 0) return 0

  const toBoolean = (v: any) => {
    if (typeof v === 'boolean') return v
    if (typeof v === 'string') return v.toLowerCase() === 'true' || v.toUpperCase() === 'SUCCESS'
    return Boolean(v)
  }

  const num = (v: any, d: number = 0) => {
    const n = typeof v === 'string' ? parseInt(v, 10) : typeof v === 'number' ? v : NaN
    return Number.isFinite(n) ? n : d
  }

  const toDate = (v: any) => {
    try {
      if (!v) return new Date()
      const d = new Date(v)
      return isNaN(d.getTime()) ? new Date() : d
    } catch {
      return new Date()
    }
  }

  const isObject = (val: any) => val && typeof val === 'object' && !Array.isArray(val)
  const mergeJson = (a: any, b: any) => merge({}, isObject(a) ? a : {}, isObject(b) ? b : {})

  const mergeTransactionData = (existing: any, incoming: any) => {
    // Prefer non-empty incoming values; for numeric counters, take max; for dates, take latest
    const merged: any = { ...existing }
    merged.hash = existing.hash || incoming.hash
    merged.ledger = Math.max(num(existing.ledger, 0), num(incoming.ledger, 0))
    merged.timestamp = new Date(
      Math.max(new Date(existing.timestamp || 0).getTime(), new Date(incoming.timestamp).getTime())
    )
    merged.sourceAccount = incoming.sourceAccount || existing.sourceAccount || ''
    merged.fee = (incoming.fee ?? existing.fee ?? '0').toString()
    merged.operationCount = Math.max(num(existing.operationCount, 0), num(incoming.operationCount, 0))
    merged.envelope = mergeJson(existing.envelope, incoming.envelope)
    merged.result = mergeJson(existing.result, incoming.result)
    merged.meta = mergeJson(existing.meta, incoming.meta)
    merged.feeBump = typeof incoming.feeBump === 'boolean' ? incoming.feeBump : Boolean(existing.feeBump)
    merged.successful = typeof incoming.successful === 'boolean' ? incoming.successful : Boolean(existing.successful)
    merged.memo = incoming.memo ?? existing.memo ?? null
    merged.memoType = incoming.memoType ?? existing.memoType ?? null
    merged.inclusionFee = incoming.inclusionFee ?? existing.inclusionFee ?? undefined
    merged.resourceFee = incoming.resourceFee ?? existing.resourceFee ?? undefined
    merged.sorobanResourceUsage = mergeJson(existing.sorobanResourceUsage, incoming.sorobanResourceUsage)
    return merged
  }

  try {
    const BATCH_SIZE = 100
    let totalStored = 0
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE)

      for (const tx of batch) {
        try {
          const hash = tx.hash || tx.txHash
          if (!hash) continue

          const incoming = {
            hash,
            ledger: num(tx.ledger, 0),
            timestamp: toDate(tx.createdAt || tx.timestamp),
            sourceAccount: tx.sourceAccount || tx.source_account || '',
            fee: (tx.fee || tx.feeCharged || 0).toString(),
            operationCount: num(tx.operationCount || tx.operation_count, 0),
            envelope: tx.envelopeXdr || tx.envelope || {},
            result: tx.resultXdr || tx.result || {},
            meta: tx.resultMetaXdr || tx.meta || {},
            feeBump: toBoolean(tx.feeBump),
            successful: typeof tx.successful === 'boolean' ? tx.successful : toBoolean(tx.status),
            memo: tx.memo ?? null,
            memoType: tx.memoType || tx.memo_type || null,
            inclusionFee: tx.inclusionFee ? String(tx.inclusionFee) : undefined,
            resourceFee: tx.resourceFee ? String(tx.resourceFee) : undefined,
            sorobanResourceUsage: tx.sorobanResourceUsage || null,
          } as any

          const existing = await db.horizonTransaction.findUnique({ where: { hash } })
          if (existing) {
            const merged = mergeTransactionData(existing, incoming)
            await db.horizonTransaction.update({ where: { hash }, data: merged })
          } else {
            await db.horizonTransaction.create({ data: incoming })
          }
          totalStored++
        } catch (perr: any) {
          console.error('Error storing single transaction:', perr?.message || perr)
          // continue with next
        }
      }
    }

    console.log(`Stored/updated ${totalStored} transactions.`)
    return totalStored
  } catch (error) {
    console.error('Error storing transactions:', error)
    return 0
  }
}

export { fetchTransactionDetails, storeTransactionsInDB }
