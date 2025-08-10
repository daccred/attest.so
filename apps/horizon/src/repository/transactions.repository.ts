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

  try {
    const results = await db.$transaction(async (prismaTx) => {
      const ops = transactions.map(async (tx: any) => {
        const hash = tx.hash || tx.txHash
        if (!hash) return null

        const transactionData = {
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
          memo: tx.memo,
          memoType: tx.memoType || tx.memo_type,
          inclusionFee: tx.inclusionFee ? String(tx.inclusionFee) : undefined,
          resourceFee: tx.resourceFee ? String(tx.resourceFee) : undefined,
          sorobanResourceUsage: tx.sorobanResourceUsage || null,
        } as any

        return prismaTx.horizonTransaction.upsert({
          where: { hash },
          update: transactionData,
          create: transactionData,
        })
      })

      const stored = await Promise.all(ops)
      return stored.filter(Boolean).length
    })

    console.log(`Stored/ensured ${results} transactions.`)
    return results
  } catch (error) {
    console.error('Error storing transactions:', error)
    return 0
  }
}

export { fetchTransactionDetails, storeTransactionsInDB }
