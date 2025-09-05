/**
 * Payment repository for blockchain payment tracking.
 *
 * Manages payment operations including transfers between accounts,
 * with support for various asset types and comprehensive payment
 * metadata storage for financial tracking and analysis.
 *
 * @module repository/payments
 * @requires common/constants
 * @requires common/db
 */

import { getHorizonBaseUrl } from '../common/constants'
import { getDB } from '../common/db'

/**
 * Fetches payment records from Stellar Horizon API.
 *
 * Retrieves payment operations with support for account filtering
 * and pagination. Includes asset details, amounts, and transaction
 * associations for comprehensive payment tracking.
 *
 * @async
 * @function fetchPaymentsFromHorizon
 * @param {Object} params - Query parameters
 * @param {string} [params.accountId] - Filter by account (sender or receiver)
 * @param {string} [params.cursor] - Pagination cursor
 * @param {number} [params.limit=100] - Maximum results to fetch
 * @returns {Promise<Array>} Payment records from Horizon
 */
export async function fetchPaymentsFromHorizon(params: {
  accountId?: string
  cursor?: string
  limit?: number
}): Promise<any[]> {
  const { accountId, cursor, limit = 100 } = params

  try {
    const baseParams: any = {
      limit,
      order: 'desc',
    }

    if (cursor) baseParams.cursor = cursor
    if (accountId) baseParams.for_account = accountId

    console.log('Fetching payments from Horizon with params:', baseParams)

    // Use Stellar Horizon API for payments (not Soroban RPC)
    const horizonUrl = getHorizonBaseUrl()
    const queryString = new URLSearchParams(baseParams).toString()
    const url = `${horizonUrl}/payments?${queryString}`

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`Payments request failed: ${response.status}`)
    }

    const data = await response.json()
    return data._embedded?.records || []
  } catch (error: any) {
    console.error('Error fetching payments:', error.message)
    return []
  }
}

/**
 * Stores payment records in database with transaction association.
 *
 * Persists payment data including sender, receiver, asset details,
 * amounts, and timestamps. Links payments to parent transactions
 * and operations for comprehensive financial record keeping.
 *
 * @async
 * @function storePaymentsInDB
 * @param {Array} payments - Payment records to store
 * @returns {Promise<void>} Completes when storage is done
 */
export async function storePaymentsInDB(payments: any[]): Promise<void> {
  const db = await getDB()
  if (!db || payments.length === 0) return

  try {
    const results = await db.$transaction(async (prismaTx) => {
      const pymnts = payments.map(async (payment) => {
        const paymentData = {
          paymentId: payment.id,
          transactionHash: payment.transaction_hash,
          operationId: payment.operation_id,
          from: payment.from,
          to: payment.to,
          asset: {
            type: payment.asset_type,
            code: payment.asset_code,
            issuer: payment.asset_issuer,
          },
          amount: payment.amount,
          timestamp: payment.created_at ? new Date(payment.created_at) : new Date(),
        }

        return prismaTx.horizonPayment.upsert({
          where: { paymentId: payment.id },
          update: paymentData,
          create: paymentData,
        })
      })

      return Promise.all(pymnts)
    })

    console.log(`Stored ${results.length} payments.`)
  } catch (error) {
    console.error('Error storing payments:', error)
  }
}
