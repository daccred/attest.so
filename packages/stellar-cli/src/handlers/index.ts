import { BaseHandler } from './base'
import { StellarHandler } from './stellar'

export const getHandler = async (signerKey: string, url?: string): Promise<BaseHandler | null> => {
  let handler: BaseHandler

  console.log(`Using signer key: ${signerKey}`)
  handler = new StellarHandler()

  const initialized = await handler.initialize(signerKey, url)

  if (!initialized) {
    return null
  }

  return handler
}

export { BaseHandler, StellarHandler }
