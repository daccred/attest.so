import { BaseHandler } from './base'
import { SolanaHandler } from './solana'
import { StellarHandler } from './stellar'

export const getHandler = async (chain: string, keypair: string, url?: string): Promise<BaseHandler | null> => {
  let handler: BaseHandler

  console.log(`Initializing handler for chain: ${chain}`)
  console.log(`Using keypair: ${keypair}`)
  if (chain === 'solana') {
    handler = new SolanaHandler()
  } else if (chain === 'stellar') {
    handler = new StellarHandler()
  } else {
    return null
  }

  const initialized = await handler.initialize(keypair, url)

  if (!initialized) {
    return null
  }

  return handler
}

export { BaseHandler, SolanaHandler, StellarHandler }
