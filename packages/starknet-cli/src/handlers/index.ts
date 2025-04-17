import { BaseHandler } from './base'
import { StarkNetHandler } from './starknet'

export const getHandler = async (keypair: string, url?: string): Promise<BaseHandler | null> => {
  let handler: BaseHandler

  console.log(`Using keypair: ${keypair}`)
  handler = new StarkNetHandler()

  const initialized = await handler.initialize(keypair, url)

  if (!initialized) {
    return null
  }

  return handler
}

export { BaseHandler, StarkNetHandler }
