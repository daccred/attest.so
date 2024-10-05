import { Argv } from 'yargs'
import { logger } from '../../logger'
import { bold, green, red, yellow } from 'picocolors'
import { checkValidJSONContent, handleJsonFile } from './utils'
import { runSerializeSchema } from './temp/serialize-schema'
import { sendSchemaToSolana } from './temp/send-schema-to-solana'

interface PublishArgv {
  jsonFile?: string
}

export const command = 'publish'
export const describe = 'Displays interactive prompts to demonstrate user input handling.'
export const aliases = ['g']

export function builder(yargs: Argv<PublishArgv>): Argv {
  return yargs.option('json-file', {
    type: 'string',
    describe: 'Path to JSON configuration file',
    normalize: true,
    demandOption: true,
  })
}

export async function handler(argv: PublishArgv) {
  // Handle JSON file if provided
  if (argv.jsonFile) {
    const content = await handleJsonFile(argv.jsonFile)

    logger.log(green('Loaded JSON data:\n'))
    logger.log(content)

    const error = checkValidJSONContent(content)

    if (error) {
      logger.log('\n\n')
      logger.log(red(error))
      logger.log(`see sample reference below:\n
${yellow(`{
  title: "UserSchema",
  type: "object",
  properties: {
    uid: { type: "string", maxLength: 32 },
    name: { type: "string", maxLength: 50 },
    age: { type: "integer", minimum: 0 },
    email: { type: "string", format: "email" },
  },
  required: ["uid", "name", "age", "email"],
}
`)}
        `)

      return
    }

    logger.log('\n\n')
    logger.log(green('JSON data is valid!'))

    logger.log('\n\n')
    logger.log(green('Running Schema Serialization'))
    const { schemaUID, serializedSchema } = runSerializeSchema(content)

    logger.log(green('Schema Serialization Result'))
    console.log({ schemaUID, serializedSchema })

    const res = await sendSchemaToSolana({
      schemaUID,
      serializedSchema,
    })

    console.log(res)
  }

  //   const username = await logger.prompt('What is your name?', {
  //     type: 'text',
  //   })

  //   logger.log(`Hello, ${green(bold(username))}!`)

  //   const mood = await logger.prompt('How are you?', {
  //     type: 'select',
  //     options: [
  //       '👌',
  //       '👍',
  //       '👎',
  //       {
  //         label: '🤬f',
  //         value: '🤬s',
  //         hint: 'take care',
  //       },
  //     ],
  //   })
  //   logger.log(`${green(bold(username))} ${mood}, Ciao!`)
  logger.log(`${green(bold('username'))} Ciao!`)
}
