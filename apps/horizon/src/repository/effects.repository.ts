import { getHorizonBaseUrl } from '../common/constants'
import { getDB } from '../common/db'

export async function fetchEffectsFromHorizon(params: {
  operationId?: string
  transactionHash?: string
  accountId?: string
  cursor?: string
  limit?: number
}): Promise<any[]> {
  const { operationId, transactionHash, accountId, cursor, limit = 100 } = params

  try {
    const baseParams: any = {
      limit,
      order: 'desc',
    }

    if (cursor) baseParams.cursor = cursor
    if (operationId) baseParams.for_operation = operationId
    if (transactionHash) baseParams.for_transaction = transactionHash
    if (accountId) baseParams.for_account = accountId

    console.log('Fetching effects from Horizon with params:', baseParams)

    // Use Stellar Horizon API for effects (not Soroban RPC)
    const horizonUrl = getHorizonBaseUrl()
    const queryString = new URLSearchParams(baseParams).toString()
    const url = `${horizonUrl}/effects?${queryString}`

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`Effects request failed: ${response.status}`)
    }

    const data = await response.json()
    return data._embedded?.records || []
  } catch (error: any) {
    console.error('Error fetching effects:', error.message)
    return []
  }
}

export async function storeEffectsInDB(effects: any[]) {
  const db = await getDB()
  if (!db || effects.length === 0) return

  try {
    const results = await db.$transaction(async (prismaTx) => {
      const effs = effects.map(async (effect) => {
        const effectData = {
          effectId: effect.id,
          operationId: effect.operation_id,
          transactionHash: effect.transaction_hash,
          type: effect.type,
          typeI: effect.type_i || 0,
          details: effect,
          account: effect.account,
        }

        return prismaTx.horizonEffect.upsert({
          where: { effectId: effect.id },
          update: effectData,
          create: effectData,
        })
      })

      return Promise.all(effs)
    })

    console.log(`Stored ${results.length} effects.`)
  } catch (error) {
    console.error('Error storing effects:', error)
  }
}
