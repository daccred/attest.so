import { BaseHandler, HandlerArgs } from './base'
import { AttestProtocol } from '@attestprotocol/sdk'
import { logger } from '../logger'
import { red, green } from 'picocolors'

export class SolanaHandler extends BaseHandler {
  private sdk: any = null

  async initialize(keyData: string, url?: string): Promise<boolean> {
    try {
      // Parse key data - should be JSON array for Solana keypair
      let walletOrSecretKey: number[]
      try {
        const parsed = JSON.parse(keyData)
        if (Array.isArray(parsed)) {
          walletOrSecretKey = parsed
        } else {
          throw new Error('Solana keypair must be an array of numbers')
        }
      } catch (error) {
        throw new Error('Invalid Solana keypair format. Expected JSON array of numbers.')
      }

      this.sdk = await AttestProtocol.initializeSolana({
        walletOrSecretKey,
        url: url || 'https://api.devnet.solana.com',
        programId: process.env.SOLANA_PROGRAM_ID
      })

      this.initialized = true
      logger.log(green(`✓ Solana SDK initialized`))
      return true
    } catch (error: any) {
      logger.log(red(`Failed to initialize Solana SDK: ${error.message}`))
      return false
    }
  }

  async check(action: string, args: HandlerArgs): Promise<boolean> {
    if (!this.initialized || !this.sdk) {
      this.logError('SDK not initialized')
      return false
    }

    this.logAction(action, args.type, 'solana')

    try {
      switch (args.type) {
        case 'schema':
          return await this.handleSchema(action, args)
        case 'authority':
          return await this.handleAuthority(action, args)
        case 'attestation':
          return await this.handleAttestation(action, args)
        default:
          this.logError(`Unknown type: ${args.type}`)
          return false
      }
    } catch (error: any) {
      this.logError(`${action} ${args.type} failed: ${error.message}`)
      return false
    }
  }

  private async handleSchema(action: string, args: HandlerArgs): Promise<boolean> {
    switch (action) {
      case 'create':
        if (!args.content) {
          this.logError('Schema content is required for create action')
          return false
        }
        
        const schemaResult = await this.sdk.createSchema({
          name: args.content.name || 'schema',
          content: args.content.content || args.content.schema,
          revocable: args.content.revocable ?? true,
          resolver: args.content.resolver || null,
          levy: args.content.levy || null
        })

        if (schemaResult.error) {
          this.logError(`Schema creation failed: ${schemaResult.error}`)
          return false
        }

        this.logSuccess('Schema created successfully')
        this.logResult('Schema', schemaResult.data)
        return true

      case 'fetch':
        if (!args.uid) {
          this.logError('Schema UID is required for fetch action')
          return false
        }

        const fetchResult = await this.sdk.fetchSchemaById(args.uid)
        
        if (fetchResult.error) {
          this.logError(`Schema fetch failed: ${fetchResult.error}`)
          return false
        }

        if (!fetchResult.data) {
          this.logError('Schema not found')
          return false
        }

        this.logSuccess('Schema fetched successfully')
        this.logResult('Schema', fetchResult.data)
        return true

      default:
        this.logError(`Unknown schema action: ${action}`)
        return false
    }
  }

  private async handleAuthority(action: string, args: HandlerArgs): Promise<boolean> {
    switch (action) {
      case 'register':
        const registerResult = await this.sdk.registerAuthority()
        
        if (registerResult.error) {
          this.logError(`Authority registration failed: ${registerResult.error}`)
          return false
        }

        this.logSuccess('Authority registered successfully')
        this.logResult('Authority ID', registerResult.data)
        return true

      case 'fetch':
        if (!args.uid) {
          this.logError('Authority ID is required for fetch action')
          return false
        }

        const fetchResult = await this.sdk.fetchAuthority(args.uid)
        
        if (fetchResult.error) {
          this.logError(`Authority fetch failed: ${fetchResult.error}`)
          return false
        }

        if (!fetchResult.data) {
          this.logError('Authority not found')
          return false
        }

        this.logSuccess('Authority fetched successfully')
        this.logResult('Authority', fetchResult.data)
        return true

      default:
        this.logError(`Unknown authority action: ${action}`)
        return false
    }
  }

  private async handleAttestation(action: string, args: HandlerArgs): Promise<boolean> {
    switch (action) {
      case 'create':
        if (!args.content) {
          this.logError('Attestation content is required for create action')
          return false
        }

        const attestResult = await this.sdk.issueAttestation({
          schemaUid: args.content.schemaUid || args.content.schemaUID,
          subject: args.content.subject,
          data: args.content.data || JSON.stringify(args.content.value || {}),
          reference: args.content.reference || null,
          expirationTime: args.content.expirationTime || null
        })

        if (attestResult.error) {
          this.logError(`Attestation creation failed: ${attestResult.error}`)
          return false
        }

        this.logSuccess('Attestation created successfully')
        this.logResult('Attestation', attestResult.data)
        return true

      case 'fetch':
        if (!args.uid) {
          this.logError('Attestation UID is required for fetch action')
          return false
        }

        const fetchResult = await this.sdk.fetchAttestationById(args.uid)
        
        if (fetchResult.error) {
          this.logError(`Attestation fetch failed: ${fetchResult.error}`)
          return false
        }

        if (!fetchResult.data) {
          this.logError('Attestation not found')
          return false
        }

        this.logSuccess('Attestation fetched successfully')
        this.logResult('Attestation', fetchResult.data)
        return true

      case 'revoke':
        if (!args.uid) {
          this.logError('Attestation UID is required for revoke action')
          return false
        }

        const revokeResult = await this.sdk.revokeAttestation({
          attestationUid: args.uid,
          reference: args.content?.reference || null
        })

        if (revokeResult.error) {
          this.logError(`Attestation revocation failed: ${revokeResult.error}`)
          return false
        }

        this.logSuccess('Attestation revoked successfully')
        return true

      default:
        this.logError(`Unknown attestation action: ${action}`)
        return false
    }
  }
}