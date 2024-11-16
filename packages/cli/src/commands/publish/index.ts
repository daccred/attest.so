import { Argv } from 'yargs'
import { logger } from '../../logger'
import { green } from 'picocolors'
import { checkValidJSONContent, handleJsonFile } from './utils'

import AttestSDK from '@peke65/attest-sdk'

interface PublishArgv {
  jsonFile?: string
  keypair?: string
}

export const command = 'publish'
export const describe = 'Displays interactive prompts to demonstrate user input handling.'
export const aliases = ['g']

export function builder(yargs: Argv<PublishArgv>): Argv {
  return yargs
    .option('json-file', {
      type: 'string',
      describe: 'Path to JSON configuration file',
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

export async function handler(argv: PublishArgv) {
  // Handle JSON file if provided
  if (argv.jsonFile) {
    const content = await handleJsonFile(argv.jsonFile)
    const secretKey = await handleJsonFile(argv.keypair)

    logger.log(green('Loaded JSON data:\n'))
    logger.log(content)

    const error = checkValidJSONContent(content)

    if (error) {
      // logger.log('\n\n')
      // logger.log(red(error))
      // logger.log(`see sample reference below:\n
      // ${yellow(`{
      //   name: "UserSchema",
      //   type: "object",
      //   properties: {
      //     uid: { type: "string", maxLength: 32 },
      //     name: { type: "string", maxLength: 50 },
      //     age: { type: "integer", minimum: 0 },
      //     email: { type: "string", format: "email" },
      //   },
      //   required: ["uid", "name", "age", "email"],
      // }
      // `)}
      //   `)

      // return
    }

    logger.log('\n\n')
    logger.log(green('Registering Schema'))
    const client = new AttestSDK({
      secretKey,
    })


    const res = await client.schema.register({
      schemaName: content.name,
      schemaContent: JSON.stringify(content),
    })

    console.log({ res })
    const uid = res.data!.toBase58()
    logger.log(`Schema UID: ${uid}`)

    logger.log(`URL Link: https://solscan.io/account/${uid}?cluster=devnet`)
  }

  logger.log('Done ✨')
}
