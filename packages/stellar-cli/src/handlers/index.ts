import { BaseHandler } from './base'
import { StellarHandler } from './stellar'

export const getHandler = async (keypair: string, url?: string): Promise<BaseHandler | null> => {
  let handler: BaseHandler

  console.log(`Using keypair: ${keypair}`)
  handler = new StellarHandler()

  const initialized = await handler.initialize(keypair, url)

  if (!initialized) {
    return null
  }

  return handler
}

export { BaseHandler, StellarHandler }
