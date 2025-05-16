import { logger } from '../logger'
import { green, red } from 'picocolors'
import { handleJsonFile } from '../utils'
import AttestSDK from '../../../sdk/dist'

export abstract class BaseHandler {
  protected secretKey: any
  protected client!: AttestSDK

  constructor() {}

  async initialize(signerKeyPath: string, url?: string): Promise<boolean> {
    try {
      this.secretKey = await handleJsonFile(signerKeyPath)
      await this.initializeClient(this.secretKey, url)
      return true
    } catch (error: any) {
      logger.log(red(`Error initializing client: ${error.message}`))
      return false
    }
  }

  abstract initializeClient(secretKey: any, url?: string): Promise<any>
  abstract check(action: string, args: any): Promise<boolean>

  protected logAction(action: string, uid?: string, isSchema?: boolean): void {
    const entity = isSchema ? 'schema' : 'attestation'

    if (action === 'fetch' && uid) {
      logger.log(green(`Fetching ${entity} with UID: ${uid}`))
    } else if (action === 'create') {
      logger.log(green(`Creating new ${entity}`))
    } else if (action === 'revoke' && uid) {
      logger.log(green(`Revoking ${entity} with UID: ${uid}`))
    } else if (action === 'register') {
      logger.log(green('Registering new authority'))
    }
  }
}
