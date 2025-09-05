import { PrismaClient } from '@prisma/client'
import { getPrismaInstance, connectToPostgreSQL } from './prisma'

export async function getDB(): Promise<PrismaClient | undefined> {
  let prisma = getPrismaInstance()
  if (!prisma) {
    console.warn(
      'getDB called before DB connection was established or connection failed. Attempting to reconnect...'
    )
    await connectToPostgreSQL()
    prisma = getPrismaInstance()
  }
  return prisma
}

export async function getLastProcessedLedgerFromDB(): Promise<number> {
  const db = await getDB()
  if (!db) {
    console.error('Failed to get database instance.')
    return 0
  }

  try {
    const state = await db.horizonIndexerState.findFirst({
      orderBy: { updatedAt: 'desc' },
    })
    return state?.lastProcessedLedger || 0
  } catch (error) {
    console.error('Error fetching last processed ledger from DB:', error)
    return 0
  }
}

export async function updateLastProcessedLedgerInDB(ledgerSequence: number) {
  const db = await getDB()
  if (!db) {
    console.error('Cannot update last processed ledger, database not initialized.')
    return
  }

  try {
    const existingState = await db.horizonIndexerState.findFirst()
    
    if (existingState) {
      await db.horizonIndexerState.update({
        where: { id: existingState.id },
        data: {
          lastProcessedLedger: ledgerSequence,
          lastProcessedAt: new Date(),
          syncStatus: 'syncing',
        },
      })
    } else {
      await db.horizonIndexerState.create({
        data: {
          lastProcessedLedger: ledgerSequence,
          lastProcessedAt: new Date(),
          syncStatus: 'syncing',
        },
      })
    }
    console.log(`Updated lastProcessedLedger in DB to: ${ledgerSequence}`)
  } catch (error) {
    console.error('Error updating last processed ledger in DB:', error)
  }
}
