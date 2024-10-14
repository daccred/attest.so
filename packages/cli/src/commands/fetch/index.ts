import { Argv } from 'yargs'
import { logger } from '../../logger'
import { green } from 'picocolors'
import { handleJsonFile } from '../publish/utils'

const AttestSDK = require('@peke65/attest-sdk')

interface FetchArgv {
  uid?: string
  keypair?: string
}

export const command = 'fetch'
export const describe = 'Displays interactive prompts to demonstrate user input handling.'
export const aliases = ['f']

export function builder(yargs: Argv<FetchArgv>): Argv {
  return yargs
    .option('uid', {
      type: 'string',
      describe: 'Schema UID',
      normalize: true,
      demandOption: true,
    })
    .option('keypair', {
      type: 'string',
      describe: 'Path to keypair file',
      normalize: true,
      demandOption: true,
    })
}

export async function handler(argv: FetchArgv) {
  // Handle JSON file if provided
  if (argv.keypair) {
    const secretKey = await handleJsonFile(argv.keypair)

    logger.log('\n\n')

    logger.log(green('Fetching Schema'))
    const client = new AttestSDK({
      secretKey,
    })

    const res2 = await client.schema.fetch(argv.uid)

    logger.log('Retrieved Schema:')
    logger.log(JSON.stringify(JSON.parse(res2.data), null, 2))

    logger.log(`URL Link: https://solscan.io/account/${argv.uid}?cluster=devnet`)

  }

  logger.log('Done ✨')
}
