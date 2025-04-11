import { Argv } from 'yargs'
import { logger } from '../logger'
import { red } from 'picocolors'
import { getHandler } from '../handlers'

interface AuthorityArgv {
  register: boolean
  r: boolean
  fetch: boolean
  f: boolean
  keypair: string
  _: string[]
  url: string
}

export const command = 'authority'
export const describe = `Manage attestation authorities (register, fetch)
 
See -> ./run authority [solana|stellar] --[register|fetch] --keypair=./keys/sol-auth.json [--url="http://localhost:8899"]

`

export function builder(yargs: Argv<AuthorityArgv>): Argv {
  return yargs
    .positional('chain', {
      type: 'string',
      describe: 'Blockchain to use (solana or stellar)',
      choices: ['solana', 'stellar'],
      demandOption: true,
    })
    .option('register', {
      alias: 'r',
      type: 'boolean',
      describe: 'Register authority',
    })
    .option('fetch', {
      alias: 'f',
      type: 'boolean',
      describe: 'Fetch authority',
    })
    .option('keypair', {
      type: 'string',
      describe: 'Path to keypair file',
      normalize: true,
      demandOption: true,
    })
    .option('url', {
      type: 'string',
      describe: 'Blockchain node URL',
    })
    .check((argv) => {
      if (!argv.register && !argv.fetch) {
        throw new Error('You must specify either --register (-r) or --fetch (-f)')
      }
      if (argv.register && argv.fetch) {
        throw new Error('You cannot specify both --register (-r) and --fetch (-f)')
      }
      return true
    })
}

export async function handler(argv: AuthorityArgv) {
  try {
    const chain = argv._[1]

    if (!chain) {
      logger.log(red('Chain not specified'))
      return
    }
    if (!['solana', 'stellar'].includes(chain)) {
      logger.log(red('Invalid chain specified'))
      return
    }
    if (!argv.keypair) {
      logger.log(red('Keypair not specified'))
      return
    }

    const chainHandler = await getHandler(chain, argv.keypair, argv.url)

    if (!chainHandler) {
      logger.log(red(`Failed to initialize ${chain} handler`))
      return
    }

    const action = argv.register ? 'register' : 'fetch'

    const args = {
      ...argv,
      type: 'authority',
    }

    const success = await chainHandler.check(action, args)

    if (success) {
      logger.log('Done ✨')
    }
  } catch (error: any) {
    logger.log(red(`Error: ${error.message}`))
  }
}
