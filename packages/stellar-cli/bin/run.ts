import yargs, { CommandModule } from 'yargs'
import { config } from 'dotenv'
import { commands } from '../src'
import { bold, yellow } from 'picocolors'
import { logger } from '../src/logger'

config()

const run = yargs(process.argv.slice(2))

logger.log(
  `
  █████╗ ████████╗████████╗███████╗███████╗████████╗  ███████╗ ██████╗ 
 ██╔══██╗╚══██╔══╝╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝  ██╔════╝██╔═══██╗
 ███████║   ██║      ██║   █████╗  ███████╗   ██║     ███████╗██║   ██║
 ██╔══██║   ██║      ██║   ██╔══╝  ╚════██║   ██║     ╚════██║██║   ██║
 ██║  ██║   ██║      ██║   ███████╗███████║   ██║  ██╗███████║╚██████╔╝
 ╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚══════╝╚══════╝   ╚═╝  ╚═╝╚══════╝ ╚═════╝ 
 `
)
logger.log(bold('Welcome to the ATTEST.SO Stellar CLI\n\n'))

for (const command of commands) {
  run.command(command as unknown as CommandModule)
}

run
  .demandCommand(
    1,
    'You need at least one command before moving on\n\nSuggested Command: ' +
      yellow(
        bold(
          'attest-stellar schema --action=create --json-file=sample.json --signer-key=<signer-key>'
        )
      )
  )
  .help().argv
