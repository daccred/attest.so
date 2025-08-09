import { BaseHandler } from './base'
import { StellarHandler } from './stellar'
import { SolanaHandler } from './solana'
import { StarknetHandler } from './starknet'
import { handleKeyFile, validateChain, SupportedChain } from '../utils'
import { logger } from '../logger'
import { red } from 'picocolors'

export const getHandler = async (
  chain: string,
  keyFile: string,
  url?: string
): Promise<BaseHandler | null> => {
  if (!validateChain(chain)) {
    logger.log(red(`Unsupported chain: ${chain}. Supported chains: stellar, solana, starknet`))
    return null
  }

  let handler: BaseHandler

  switch (chain as SupportedChain) {
    case 'stellar':
      handler = new StellarHandler()
      break
    case 'solana':
      handler = new SolanaHandler()
      break
    case 'starknet':
      handler = new StarknetHandler()
      break
    default:
      logger.log(red(`Unsupported chain: ${chain}`))
      return null
  }

  try {
    const keyData = await handleKeyFile(keyFile)
    const initialized = await handler.initialize(keyData, url)

    if (!initialized) {
      return null
    }

    return handler
  } catch (error: any) {
    logger.log(red(`Failed to initialize ${chain} handler: ${error.message}`))
    return null
  }
}

export { BaseHandler, StellarHandler, SolanaHandler, StarknetHandler }