import { logger } from '../logger'
import { green, red, yellow } from 'picocolors'
import AttestSDK, {
  AttestationConfig,
  SchemaConfig,
  SolanaAttestSDK,
  SolanaRevokeAttestationConfig,
} from '../../../sdk/dist'
import { BaseHandler } from './base'
import * as anchor from '@coral-xyz/anchor'
import { validateSolanaSchema, validateSolanaAttestation } from '../utils'

export class SolanaHandler extends BaseHandler {
  declare protected client: SolanaAttestSDK
  private network: string = 'devnet' // Default to devnet

  async initializeClient(secretKey: number[], url?: string): Promise<void> {
    try {
      // Initialize with proper wallet format
      this.client = await AttestSDK.initializeSolana({
        url: url || 'https://api.devnet.solana.com',
        walletOrSecretKey: secretKey,
      })
    } catch (error: any) {
      logger.log(red(`Failed to initialize Solana client: ${error.message}`))
      throw error
    }
  }

  async check(action: string, args: any): Promise<boolean> {
    this.logAction(action, args.uid)

    // Validate content based on action and type
    if (args.content && typeof args.content === 'object') {
      let validationError: string | null = null

      if (args.type === 'schema') {
        validationError = validateSolanaSchema(args.content)
      } else if (args.type === 'attestation') {
        validationError = validateSolanaAttestation(args.content, args.schemaUid)
      }

      if (validationError) {
        logger.log(red(`Validation error: ${validationError}`))
        return false
      }
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
      return true
    }

    if (action === 'create' && args.content) {
      // Set up the create schema configuration
      const schemaConfig: SchemaConfig = {
        schemaName: args.content.schemaName,
        schemaContent: args.content.schemaContent,
        revocable: args.content.revocable ?? true,
      }

      // Add levy if provided
      if (args.content.levy) {
        schemaConfig.levy = {
          amount: new anchor.BN(args.content.levy.amount),
          asset: args.content.levy.asset,
          recipient: args.content.levy.recipient,
        }
      }

      const result = await this.client.createSchema(schemaConfig)

      if (result.error) {
        logger.log(red(`Error: ${result.error}`))
        return false
      }

      const uid = result.data?.toBase58()
      logger.log(`Schema UID: ${uid}`)
      logger.log(`URL Link: https://solscan.io/account/${uid}?cluster=${this.network}`)
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
      logger.log(`URL Link: https://solscan.io/account/${args.uid}?cluster=${this.network}`)
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
      const attestationConfig: AttestationConfig = {
        schemaData: args.schemaUid,
        data: args.content.data,
        revocable: args.content.revocable ?? true,
        accounts: {
          recipient: args.schemaUid,
          levyReceipent: args.schemaUid,
          mintAccount: args.schemaUid,
        },
      }

      // Add accounts if provided
      if (args.content.accounts) {
        attestationConfig.accounts = {
          recipient: args.content.accounts.recipient,
          levyReceipent: args.content.accounts.levyReceipent,
          mintAccount: args.content.accounts.mintAccount,
        }
      }

      const result = await this.client.attest(attestationConfig)

      if (result.error) {
        logger.log(red(`Error: ${result.error}`))
        return false
      }

      const uid = result.data?.toBase58()
      logger.log(`Attestation UID: ${uid}`)
      logger.log(`URL Link: https://solscan.io/account/${uid}?cluster=${this.network}`)
      return true
    }

    if (action === 'revoke' && args.uid) {
      // Parse the schema UID and recipient from args
      const attestationUID = args.attestationUID || args.content?.attestationUID
      const recipient = args.recipient || args.content?.recipient

      if (!attestationUID) {
        logger.log(red('Schema UID is required for revocation'))
        return false
      }

      // Set up revocation configuration
      const revocationConfig: SolanaRevokeAttestationConfig = {
        attestationUID,
        recipient,
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
      if (args.uid) {
        logger.log(`URL Link: https://solscan.io/account/${args.uid}?cluster=${this.network}`)
      }
      return true
    }

    return false
  }

  private async handleAuthority(action: string): Promise<boolean> {
    if (action === 'register') {
      console.log(await this.client.getWalletBalance());
      const result = await this.client.registerAuthority()

      if (result.error) {
        logger.log(red(`Error: ${result.error}`))
        return false
      }

      const authorityId = result.data?.toBase58()
      logger.log(`Authority registered successfully`)
      logger.log(`Authority ID: ${authorityId}`)
      logger.log(`URL Link: https://solscan.io/account/${authorityId}?cluster=${this.network}`)
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
            id: result.data.authority.toBase58(),
          },
          null,
          2,
        ),
      )
      logger.log(`URL Link: https://solscan.io/account/${result.data.authority.toBase58()}?cluster=${this.network}`)
      return true
    }

    return false
  }
}