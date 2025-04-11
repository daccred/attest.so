import { logger } from '../logger'
import { green, red, yellow } from 'picocolors'
import AttestSDK, { SchemaConfig, StellarAttestationConfig, StellarAttestSDK } from '../../../sdk/dist'
import { BaseHandler } from './base'
import { validateStellarSchema, validateStellarAttestation } from '../utils'

export class StellarHandler extends BaseHandler {
  declare protected client: StellarAttestSDK
  private network: string = 'testnet' // Default to testnet

  async initializeClient(secretKey: string): Promise<StellarAttestSDK> {
    try {
      // Initialize Stellar SDK
      this.client = await AttestSDK.initializeStellar({
        secretKey,
        networkPassphrase: this.getNetworkPassphrase(),
      })

      return this.client
    } catch (error: any) {
      logger.log(red(`Failed to initialize Stellar client: ${error.message}`))
      throw error
    }
  }

  // Get the network passphrase based on the network configuration
  private getNetworkPassphrase(): string {
    // switch (this.network) {
    //   case 'public':
    //   case 'mainnet':
    //     return StellarSdk.Networks.PUBLIC
    //   case 'testnet':
    //   default:
    //     return StellarSdk.Networks.TESTNET
    // }
    return ''
  }

  async check(action: string, args: any): Promise<boolean> {
    this.logAction(action, args.uid)

    // Validate content based on action and type
    if (args.content && typeof args.content === 'object') {
      let validationError: string | null = null

      if (args.type === 'schema') {
        validationError = validateStellarSchema(args.content)
      } else if (args.type === 'attestation') {
        validationError = validateStellarAttestation(args.content, args.schemaUid)
      }

      if (validationError) {
        logger.log(red(`Validation error: ${validationError}`))
        return false
      }
    }

    const initialized = await this.initialize(this.secretKey)
    if (!initialized) {
      logger.log(red('Failed to initialize client'))
      return false
    }

    switch (args.type) {
      case 'schema':
        return this.handleSchema(action, args)
      case 'attestation':
        return this.handleAttestation(action, args)
      case 'authority':
        return this.handleAuthority(action)
      default:
        logger.log(red(`Unknown type: ${args.type}`))
        return false
    }
  }

  private async handleSchema(action: string, args: any): Promise<boolean> {
    if (action === 'fetch' && args.uid) {
      const result = await this.client.fetchSchema(args.uid)

      if (result.error) {
        logger.log(red(`Error: ${result.error}`))
        return false
      }

      if (!result.data) {
        logger.log(yellow('No schema found with the given UID'))
        return false
      }

      logger.log('Retrieved Schema:')
      logger.log(JSON.stringify(result.data, null, 2))

      // Add Stellar explorer link if available
      if (this.network === 'testnet') {
        logger.log(`URL Link: https://stellar.expert/explorer/testnet/tx/${args.uid}`)
      } else {
        logger.log(`URL Link: https://stellar.expert/explorer/public/tx/${args.uid}`)
      }

      return true
    }

    if (action === 'create' && args.content) {
      // Set up the create schema configuration
      const schemaConfig: SchemaConfig = {
        schemaName: args.content.schemaName || args.content.name,
        schemaContent: args.content.schemaContent || args.content.schema,
        revocable: args.content.revocable ?? true,
      }

      // Add levy if provided
      if (args.content.levy) {
        schemaConfig.levy = {
          amount: args.content.levy.amount,
          asset: args.content.levy.asset,
          recipient: args.content.levy.recipient,
        }
      }

      const result = await this.client.createSchema(schemaConfig)

      if (result.error) {
        logger.log(red(`Error: ${result.error}`))
        return false
      }

      logger.log(`Schema UID: ${result.data}`)

      // Add Stellar explorer link if available
      if (this.network === 'testnet') {
        logger.log(`URL Link: https://stellar.expert/explorer/testnet/tx/${result.data}`)
      } else {
        logger.log(`URL Link: https://stellar.expert/explorer/public/tx/${result.data}`)
      }

      return true
    }

    return false
  }

  private async handleAttestation(action: string, args: any): Promise<boolean> {
    if (action === 'fetch' && args.uid) {
      const result = await this.client.fetchAttestation(args.uid)

      if (result.error) {
        logger.log(red(`Error: ${result.error}`))
        return false
      }

      if (!result.data) {
        logger.log(yellow('No attestation found with the given UID'))
        return false
      }

      logger.log('Retrieved Attestation:')
      logger.log(JSON.stringify(result.data, null, 2))

      // Add Stellar explorer link if available
      if (this.network === 'testnet') {
        logger.log(`URL Link: https://stellar.expert/explorer/testnet/tx/${args.uid}`)
      } else {
        logger.log(`URL Link: https://stellar.expert/explorer/public/tx/${args.uid}`)
      }

      return true
    }

    if (action === 'create' && args.schemaUid && args.content) {
      // Verify the schema exists first
      const schemaResult = await this.client.fetchSchema(args.schemaUid)

      if (schemaResult.error) {
        logger.log(red(`Error fetching schema: ${schemaResult.error}`))
        return false
      }

      if (!schemaResult.data) {
        logger.log(red(`Schema with UID ${args.schemaUid} not found`))
        return false
      }

      // Prepare the attestation configuration
      const attestationConfig: StellarAttestationConfig = {
        schemaData: args.schemaUid,
        data: args.content.data,
        revocable: args.content.revocable ?? true,
        accounts: {
          recipient: args.content.recipient,
          levyReceipent: args.schemaUid,
          mintAccount: args.schemaUid,
        },
      }

      const result = await this.client.attest(attestationConfig)

      if (result.error) {
        logger.log(red(`Error: ${result.error}`))
        return false
      }

      logger.log(`Attestation UID: ${result.data}`)

      // Add Stellar explorer link if available
      if (this.network === 'testnet') {
        logger.log(`URL Link: https://stellar.expert/explorer/testnet/tx/${result.data}`)
      } else {
        logger.log(`URL Link: https://stellar.expert/explorer/public/tx/${result.data}`)
      }

      return true
    }

    if (action === 'revoke' && args.uid) {
      // Parse the schema UID and recipient from args
      const schemaUID = args.schemaUid || args.content?.schemaUID
      const recipient = args.content?.recipient

      if (!schemaUID) {
        logger.log(red('Schema UID is required for revocation'))
        return false
      }

      // Set up revocation configuration
      const revocationConfig: any = {
        schemaUID: schemaUID,
      }

      // Add recipient if provided
      if (recipient) {
        revocationConfig.recipient = recipient
      } else if (args.uid) {
        // If a specific attestation UID is provided
        revocationConfig.attestationUID = args.uid
      }

      const result = await this.client.revokeAttestation(revocationConfig)

      if (result.error) {
        logger.log(red(`Error: ${result.error}`))
        return false
      }

      logger.log(green('Attestation revoked successfully'))

      // Add Stellar explorer link if available for the transaction
      if (result.data && typeof result.data === 'string') {
        if (this.network === 'testnet') {
          logger.log(`URL Link: https://stellar.expert/explorer/testnet/tx/${result.data}`)
        } else {
          logger.log(`URL Link: https://stellar.expert/explorer/public/tx/${result.data}`)
        }
      }

      return true
    }

    return false
  }

  private async handleAuthority(action: string): Promise<boolean> {
    if (action === 'register') {
      const result = await this.client.registerAuthority()

      if (result.error) {
        logger.log(red(`Error: ${result.error}`))
        return false
      }

      logger.log(`Authority registered successfully`)
      logger.log(`Authority ID: ${result.data}`)

      // Add Stellar explorer link if this returns a transaction ID
      if (typeof result.data === 'string') {
        if (this.network === 'testnet') {
          logger.log(`URL Link: https://stellar.expert/explorer/testnet/tx/${result.data}`)
        } else {
          logger.log(`URL Link: https://stellar.expert/explorer/public/tx/${result.data}`)
        }
      }

      return true
    }

    if (action === 'fetch') {
      const result = await this.client.fetchAuthority()

      if (result.error) {
        logger.log(red(`Error: ${result.error}`))
        return false
      }

      if (!result.data) {
        logger.log(yellow('No authority found for the current wallet'))
        return false
      }

      logger.log('Authority Info:')
      logger.log(
        JSON.stringify(
          {
            id: result.data,
          },
          null,
          2,
        ),
      )

      // Add Stellar account explorer link if applicable
      if (typeof result.data.address === 'string' && result.data.address.startsWith('G')) {
        if (this.network === 'testnet') {
          logger.log(`URL Link: https://stellar.expert/explorer/testnet/account/${result.data}`)
        } else {
          logger.log(`URL Link: https://stellar.expert/explorer/public/account/${result.data}`)
        }
      }

      return true
    }

    return false
  }
}
