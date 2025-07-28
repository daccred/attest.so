import { logger } from '../logger'
import { red, green, cyan } from 'picocolors'

export interface HandlerArgs {
  action: string
  type: string
  chain: string
  uid?: string
  content?: any
  jsonFile?: string
  signerKey?: string
  keypair?: string
  accountAddress?: string
  privateKey?: string
  [key: string]: any
}

export abstract class BaseHandler {
  protected initialized = false

  abstract initialize(keyData: string, url?: string): Promise<boolean>
  abstract check(action: string, args: HandlerArgs): Promise<boolean>

  protected logAction(action: string, type: string, chain: string) {
    logger.log(cyan(`Executing ${action} ${type} on ${chain} chain...`))
  }

  protected logSuccess(message: string) {
    logger.log(green(`✓ ${message}`))
  }

  protected logError(message: string) {
    logger.log(red(`✗ ${message}`))
  }

  protected logResult(label: string, result: any) {
    logger.log(`${label}:`, JSON.stringify(result, null, 2))
  }
}