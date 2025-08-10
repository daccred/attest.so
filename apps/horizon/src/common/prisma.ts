/**
 * Database connection management module for PostgreSQL via Prisma ORM.
 * 
 * This module provides centralized database connection management with automatic
 * connection pooling, debug logging, and graceful shutdown handling. It ensures
 * a singleton pattern for the Prisma client instance across the application.
 * 
 * @module common/prisma
 * @requires @prisma/client
 */

import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient | undefined

/**
 * Establishes and manages the PostgreSQL database connection.
 * 
 * Creates a new Prisma client instance with environment-specific configuration,
 * including optional debug logging for development environments. Handles connection
 * testing and provides appropriate error messages for missing configuration.
 * 
 * @async
 * @function connectToPostgreSQL
 * @returns {Promise<boolean>} Returns true if connection successful, false otherwise
 * @throws {Error} Logs error to console but doesn't throw for graceful degradation
 */
export async function connectToPostgreSQL(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error('DATABASE_URL is not defined. Please set DATABASE_URL environment variable.')
    if (process.env.NODE_ENV !== 'test') {
      console.error('CRITICAL: DATABASE_URL not set, indexer will not function.')
    }
    prisma = undefined
    return false
  }

  try {
    const enablePrismaDebug =
      process.env.PRISMA_DEBUG === '1' ||
      process.env.PRISMA_DEBUG === 'true' ||
      process.env.NODE_ENV === 'development'

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: enablePrismaDebug ? [{ emit: 'event', level: 'query' }, 'warn', 'error'] : ['error'],
    })

    if (enablePrismaDebug) {
      ;(prisma as any).$on('query', (e: any) => {
        console.debug(`[prisma] ${e.duration}ms ${e.query}`, e.params)
      })
    }

    // Test the connection
    await prisma.$connect()
    console.log('Successfully connected to PostgreSQL.')

    return true
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error)
    prisma = undefined
    return false
  }
}

// Connect to DB when module is loaded
connectToPostgreSQL()

/**
 * Retrieves the singleton Prisma client instance.
 * 
 * Returns the active Prisma client instance if connected, or undefined if the
 * database connection has not been established or has failed. This ensures
 * safe access to the database throughout the application.
 * 
 * @function getPrismaInstance
 * @returns {PrismaClient | undefined} The active Prisma client or undefined
 */
export function getPrismaInstance(): PrismaClient | undefined {
  return prisma
}

// Clean up on process exit
process.on('beforeExit', async () => {
  if (prisma) {
    await prisma.$disconnect()
  }
})
