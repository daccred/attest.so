import { Argv } from 'yargs';
import { logger } from '../logger';
import { red } from 'picocolors';
import { handleJsonFile } from '../utils';
import { getHandler } from '../handlers';

interface AttestationArgv {
  action: string;
  uid?: string;
  schemaUid?: string;
  jsonFile?: string;
  keypair: string;
  content?: any;
}

export const command = 'attestation';
export const describe = 'Manage attestations (create, fetch, revoke)';
export const aliases = ['attest'];

export function builder(yargs: Argv<AttestationArgv>): Argv {
  return yargs
    .option('action', {
      type: 'string',
      describe: 'Action to perform',
      choices: ['create', 'fetch', 'revoke'],
      demandOption: true,
    })
    .option('uid', {
      type: 'string',
      describe: 'Attestation UID (required for fetch and revoke)',
      normalize: true,
    })
    .option('schema-uid', {
      type: 'string',
      describe: 'Schema UID (required for create)',
      normalize: true,
    })
    .option('json-file', {
      type: 'string',
      describe: 'Path to JSON data file for attestation (required for create)',
      normalize: true,
    })
    .option('keypair', {
      type: 'string',
      describe: 'Path to keypair file',
      normalize: true,
      demandOption: true,
    })
    .check((argv) => {
      if ((argv.action === 'fetch' || argv.action === 'revoke') && !argv.uid) {
        throw new Error('UID is required for fetch and revoke actions');
      }
      if (argv.action === 'create' && (!argv.schemaUid || !argv.jsonFile)) {
        throw new Error('Schema UID and JSON file are required for create action');
      }
      return true;
    });
}

export async function handler(argv: AttestationArgv) {
  try {
    // Load JSON content for create action
    if (argv.action === 'create' && argv.jsonFile) {
      argv.content = await handleJsonFile(argv.jsonFile);
    }
    
    const chainHandler = await getHandler(argv.keypair);
    
    if (!chainHandler) {
      logger.log(red(`Failed to initialize StarkNet handler`));
      return;
    }
    
    const args = {
      ...argv,
      type: 'attestation'
    };
    
    const success = await chainHandler.check(argv.action, args);
    
    if (success) {
      logger.log('Done ✨');
    }
  } catch (error: any) {
    logger.log(red(`Error: ${error.message}`));
  }
}