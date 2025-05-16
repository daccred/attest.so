import { AttestSDKBase } from './base'
import {
  AttestSDKResponse,
  StellarConfig,
  StellarFetchAuthorityResult,
  StellarFetchSchemaResult,
  StellarFetchAttestationResult,
  StellarAttestationConfig,
  StellarSchemaConfig,
  StellarAttestationConfigWithValue,
  StellarCreateSchemaResult,
} from './types'
import {
  Address,
  Contract,
  TransactionBuilder,
  Keypair,
  Networks,
  xdr,
  SorobanRpc,
  BASE_FEE,
  TimeoutInfinite,
  scValToNative,
  Account,
  Transaction,
} from '@stellar/stellar-sdk'

import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'

// Default contract addresses
const PROTOCOL_CONTRACT_ID = 'CBPL7XR7NNPTNSIIFWQMWLSCX3B3MM36UYX4TW3QXJKTIEA6KDLRYAQP'
const AUTHORITY_CONTRACT_ID = 'CDQREK6BTPEVD4O56XR6TKLEEMNYTRJUG466J2ERNE5POIEKN2N6O7EL'

/**
 * Stellar implementation of the Attest SDK
 */
export class StellarAttestSDK extends AttestSDKBase {
  private server: SorobanRpc.Server
  // private keypair: Keypair
  private publicKey: string = ''
  private networkPassphrase: string
  private protocolContractId: string
  private authorityContractId: string
  private contract: Contract
  private signer: Keypair | StellarWalletsKit

  /**
   * Creates a new instance of the Stellar Attest SDK
   * @param config SDK configuration options
   */
  constructor(config: StellarConfig) {
    super()

    // Initialize Stellar SDK
    const defaultUrl = 'https://soroban-testnet.stellar.org'
    this.server = new SorobanRpc.Server(config.url ?? defaultUrl, {
      allowHttp: (config.url ?? defaultUrl).startsWith('http://'),
    })

    // Initialize connection type based on config
    if (typeof config.secretKeyOrWalletKit === 'string') {
      // Direct secret key provided
      this.signer = Keypair.fromSecret(config.secretKeyOrWalletKit)
    } else {
      this.signer = config.secretKeyOrWalletKit
    }

    this.publicKey = config.publicKey

    this.networkPassphrase = Networks.TESTNET
    this.protocolContractId = PROTOCOL_CONTRACT_ID
    this.authorityContractId = AUTHORITY_CONTRACT_ID
    this.contract = new Contract(this.protocolContractId)
  }

  /**
   * Initialize the protocol contract by setting the admin
   * Maps to initialize(env: Env, admin: Address) in the Stellar contract
   */
  async initialize(): Promise<AttestSDKResponse<void>> {
    try {
      // Convert the address to ScVal for the contract call
      const adminScVal = new Address(this.publicKey).toScVal()

      // Call the contract method
      const result = await this.invoke({
        func: 'initialize',
        args: [adminScVal],
      })

      return { data: undefined }
    } catch (error) {
      console.error(error)
      return { error }
    }
  }

  /**
   * Initialize the authority resolver contract
   * @param tokenContractId The token contract ID to use for the authority
   */
  async initializeAuthority(tokenContractId: string): Promise<AttestSDKResponse<void>> {
    try {
      // Create contract instance for the authority contract
      const authorityContract = new Contract(this.authorityContractId)

      // Convert parameters to ScVal
      const adminAddr = new Address(this.publicKey).toScVal()
      const tokenAddr = new Address(tokenContractId).toScVal()

      // Build and execute the operation
      const operation = authorityContract.call('initialize', adminAddr, tokenAddr)

      // Submit the transaction
      await this.buildAndSubmitTransaction([operation])

      return { data: undefined }
    } catch (error) {
      return { error }
    }
  }

  /**
   * Retrieves the authority record for the current wallet
   * Note: The Stellar contract doesn't have a direct method for this
   * @returns The authority record or null if not found
   */
  async fetchAuthority(): Promise<AttestSDKResponse<StellarFetchAuthorityResult | null>> {
    try {
      // In Stellar contract, authority is implicit with the caller's address
      // There's no separate authority record storage
      // We return the current keypair information
      return {
        data: {
          address: this.publicKey,
          metadata: 'Default authority metadata',
        },
      }
    } catch (error) {
      return { error }
    }
  }

  /**
   * Registers the current wallet as an authority
   * Note: In Stellar, there's no explicit registration needed beyond initialization
   * @returns The authority address
   */
  async registerAuthority(): Promise<AttestSDKResponse<string>> {
    try {
      // In Stellar's contract, there's no separate registration needed
      // The initialize method sets the admin, and all other operations work based on caller address
      return { data: this.publicKey }
    } catch (error) {
      return { error }
    }
  }

  /**
   * Fetches a schema by its UID
   * This requires implementation in the Stellar contract
   * @param schemaUID The schema UID to fetch (64-character hex string)
   * @returns The schema or null if not found
   */
  async fetchSchema(
    schemaUID: string
  ): Promise<AttestSDKResponse<StellarFetchSchemaResult | null>> {
    try {
      // Check if the schemaUID is a valid transaction hash (should be 64-char hex)
      if (!/^[0-9a-fA-F]{64}$/.test(schemaUID)) {
        throw new Error('Invalid schema UID format. Expected a 64-character hex string.')
      }

      // Attempt to retrieve the transaction
      const txResponse = await this.server.getTransaction(schemaUID)

      // Verify we got a proper response
      if (!txResponse || txResponse.status !== SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return { data: null }
      }

      // First try to get schema info directly from the contract
      try {
        // Convert the schemaUID from hex string to bytes for the contract call
        const schemaUidScVal = xdr.ScVal.scvBytes(Buffer.from(schemaUID, 'hex'))

        // Call the contract read method
        const schemaResult = await this.readContract({
          func: 'get_schema',
          args: [schemaUidScVal],
        })

        if (schemaResult) {
          const schemaData = {
            uid: schemaUID,
            definition: typeof schemaResult.definition === 'string' ? schemaResult.definition : '',
            authority:
              typeof schemaResult.authority === 'string' ? schemaResult.authority : this.publicKey,
            revocable: typeof schemaResult.revocable === 'boolean' ? schemaResult.revocable : true,
            resolver: schemaResult.resolver || null,
          }

          return { data: schemaData }
        }
      } catch (contractReadError) {
        console.error('Could not read schema directly from contract:', contractReadError)
      }

      // If contract read failed, try to extract data from transaction metadata
      let schemaData: StellarFetchSchemaResult | null = null

      // If we still don't have schema data, create a minimal response
      if (!schemaData) {
        schemaData = {
          uid: schemaUID,
          definition: '', // We don't have the actual definition
          authority: this.publicKey,
          revocable: true, // Default to true
          resolver: null, // Default to null
        }
      }

      return { data: schemaData }
    } catch (error) {
      console.error('Error fetching schema:', error)
      return { error }
    }
  }
  /**
   * Creates a new schema
   * Maps to register(env, caller, schema_definition, resolver, revocable) in the Stellar contract
   * @param config Schema configuration
   * @returns The UID of the created schema
   */
  async createSchema(
    config: StellarSchemaConfig
  ): Promise<AttestSDKResponse<StellarCreateSchemaResult>> {
    try {
      // Prepare parameters
      const caller = new Address(this.publicKey).toScVal()
      const schemaDefinition = xdr.ScVal.scvString(config.schemaContent)
      // Use scvVoid to represent null for resolver instead of passing null directly
      const resolver = config.resolverAddress
        ? new Address(config.resolverAddress).toScVal()
        : xdr.ScVal.scvVoid()
      const revocable = xdr.ScVal.scvBool(config.revocable ?? true)

      // Call contract to register schema
      const result = await this.invoke({
        func: 'register',
        args: [caller, schemaDefinition, resolver, revocable],
      })

      return {
        data: {
          schemaUID: scValToNative((result.transactionResponse as any).returnValue).toString('hex'),
          hash: result.transaction.hash,
        },
      }
    } catch (error) {
      return { error }
    }
  }

  /**
   * Fetches an attestation by its identifiers
   * Maps to get_attestation(env, schema_uid, subject, reference) in the Stellar contract
   * @param attestation The attestation ID or components needed to look it up
   * @returns The attestation or null if not found
   */

  async fetchAttestation(
    options: StellarAttestationConfig
  ): Promise<AttestSDKResponse<StellarFetchAttestationResult | null>> {
    try {
      if (options.schemaUID.length !== 64 || !/^[0-9a-fA-F]+$/.test(options.schemaUID)) {
        throw new Error('Invalid schema-uid format. Must be a 64-character hex string.')
      }
      const schemaUid = xdr.ScVal.scvBytes(Buffer.from(options.schemaUID, 'hex'))
      const subject = Address.fromString(options.subject).toScVal()
      const reference = options.reference ? xdr.ScVal.scvString(options.reference) : null

      // Call the get_attestation method
      const result = await this.readContract({
        func: 'get_attestation',
        args: [schemaUid, subject, reference],
      })

      // Parse the result
      if (result) {
        return {
          data: result,
        }
      } else {
        return { data: null } // No attestation found
      }
    } catch (error) {
      console.error('Error fetching attestation:', error)
      return { error }
    }
  }

  /**
   * Creates a new attestation
   * Maps to attest(env, caller, schema_uid, subject, value, reference) in the Stellar contract
   * @param config Attestation configuration
   * @returns The ID of the created attestation
   */
  async attest(options: StellarAttestationConfigWithValue): Promise<AttestSDKResponse<string>> {
    try {
      if (options.schemaUID.length !== 64 || !/^[0-9a-fA-F]+$/.test(options.schemaUID)) {
        throw new Error('Invalid schema-uid format. Must be a 64-character hex string.')
      }
      // Prepare parameters
      const caller = Address.fromString(this.publicKey).toScVal()

      const schemaUid = xdr.ScVal.scvBytes(Buffer.from(options.schemaUID, 'hex'))
      const subject = Address.fromString(options.subject).toScVal()
      const value = xdr.ScVal.scvString(options.value)
      const reference = xdr.ScVal.scvString(options.reference)

      // Try to call contract to create attestation
      const result = await this.invoke({
        func: 'attest',
        args: [caller, schemaUid, subject, value, reference],
      })

      return {
        data: `${result.transaction.hash}`,
      }
    } catch (error) {
      console.error('Fatal error in attest:', error)
      return { error }
    }
  }

  /**
   * Revokes an attestation
   * Maps to revoke_attestation(env, caller, schema_uid, subject, reference) in the Stellar contract
   * @param props Revocation configuration
   * @returns The ID of the revoked attestation
   */
  async revokeAttestation(options: StellarAttestationConfig): Promise<AttestSDKResponse<string>> {
    try {
      // Parse the attestation UID to extract schema UID if needed
      if (options.schemaUID.length !== 64 || !/^[0-9a-fA-F]+$/.test(options.schemaUID)) {
        throw new Error('Invalid schema-uid format. Must be a 64-character hex string.')
      }
      const caller = Address.fromString(this.publicKey).toScVal()

      const schemaUid = xdr.ScVal.scvBytes(Buffer.from(options.schemaUID, 'hex'))
      const subject = Address.fromString(options.subject).toScVal()
      const reference = options.reference ? xdr.ScVal.scvString(options.reference) : null

      // Try to call contract to revoke attestation
      const result = await this.invoke({
        func: 'revoke_attestation',
        args: [caller, schemaUid, subject, reference],
      })

      // Process the result

      return {
        data: result.transaction.hash,
      }
    } catch (error) {
      console.error('Fatal error in revokeAttestation:', error)
      return { error }
    }
  }

  /**
   * Helper method for invoking contract methods that modify state
   * @param options Options for the contract call
   * @returns Result of the contract call
   */
  /**
   * Helper method to verify account exists and is funded
   * @returns true if account exists and appears funded
   */
  private async verifyAccountStatus(): Promise<boolean> {
    try {
      const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${this.publicKey}`)

      const accountResponse = await res.json()

      // Check if the account has a minimum balance
      // Note: The type definition might not be accurate - account response includes balances
      const balances = (accountResponse as any).balances || []
      const nativeBalance = balances.find((balance: any) => balance.asset_type === 'native')

      if (!nativeBalance || parseFloat(nativeBalance.balance) < 5) {
        console.warn(`
          WARNING: Account ${this.publicKey} has a low balance (${nativeBalance?.balance || '0'} XLM).
          Transactions may fail due to insufficient funds.
          Please fund this account with XLM before proceeding.
        `)
        return false
      }

      return true
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        console.error(`
          ERROR: Account ${this.publicKey} does not exist on the Stellar network.
          Please create and fund this account before proceeding.
        `)
      } else {
        console.error('Error checking account status:', error.message || error)
      }
      return false
    }
  }

  private async invoke({
    func,
    args,
    fee = BASE_FEE, // 0.01 XLM - a bit higher than BASE_FEE to ensure transaction success
  }: {
    func: string
    args: any[]
    fee?: string
  }): Promise<{
    transaction: SorobanRpc.Api.SendTransactionResponse
    transactionResponse: SorobanRpc.Api.GetTransactionResponse
  }> {
    try {
      // Verify account exists and has funds
      await this.verifyAccountStatus()

      // Get account to use as transaction source
      const account = await this.server.getAccount(this.publicKey)
      const source = new Account(account.accountId(), account.sequenceNumber())

      // Build the operation
      const operation = this.contract.call(func, ...args)

      // Build the transaction with proper configuration
      const tx = new TransactionBuilder(source, {
        fee: fee.toString(),
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(operation)
        .setTimeout(TimeoutInfinite)
        .build()

      // Simulate the transaction first
      const simulateResponse = await this.server.simulateTransaction(tx)

      // Check for simulation errors
      if (SorobanRpc.Api.isSimulationError(simulateResponse)) {
        console.error('Simulation returned an error:', simulateResponse.error)
        throw new Error(`Simulation error: ${simulateResponse.error}`)
      }

      // Store the simulation result for later
      let simulationNativeValue = null
      let simulationRawValue = null

      if (simulateResponse.result?.retval) {
        simulationRawValue = simulateResponse.result.retval
        try {
          simulationNativeValue = scValToNative(simulateResponse.result.retval)
        } catch (e) {
          console.warn('Could not convert simulation result to native:', e)
        }
      } else {
      }

      // Prepare the transaction with simulation results
      let preparedTx = tx

      // This step is crucial for Soroban - we need to prepare the transaction with the simulation results
      if (simulateResponse.result) {
        try {
          // Use the SorobanRpc API to properly assemble the transaction
          preparedTx = SorobanRpc.assembleTransaction(tx, simulateResponse).build()
        } catch (e) {
          console.error('Error assembling transaction:', e)
          // Continue with original tx if assembly fails
        }
      }

      try {
        let sendResponse

        if (this.signer instanceof Keypair) {
          preparedTx.sign(this.signer)
          sendResponse = await this.server.sendTransaction(preparedTx)
        } else {
          const signRes = await this.signer.signTransaction(preparedTx.toXDR())

          const trxn = xdr.TransactionEnvelope.fromXDR(signRes.signedTxXdr, 'base64')
          sendResponse = await this.server.sendTransaction(
            new Transaction(trxn, this.networkPassphrase)
          )
        }

        // Type cast to make TypeScript happy
        const status = sendResponse.status as string
        if (status === 'PENDING') {
          let txResponse = await this.server.getTransaction(sendResponse.hash)
          const start = new Date().getTime()
          const TIMEOUT_MS = 60000 // 60 seconds timeout

          while (
            txResponse.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND &&
            new Date().getTime() - start < TIMEOUT_MS
          ) {
            // Wait a bit before polling again
            await new Promise((resolve) => setTimeout(resolve, 2000)) // 2 seconds delay
            console.log('Polling for status...')
            txResponse = await this.server.getTransaction(sendResponse.hash)
          }

          if (txResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
            return {
              transaction: sendResponse,
              transactionResponse: txResponse,
            }
          } else {
            console.error('Transaction failed or status unknown.')

            throw new Error(`Transaction failed with status: ${txResponse.status}`)
          }
        } else if (sendResponse.status === 'TRY_AGAIN_LATER') {
          console.error('Network congestion or rate limiting in effect:', sendResponse.status)
          console.error(
            'This often happens when accounts are not properly funded or the network is busy'
          )
          throw new Error(
            `Transaction submission returned status: ${sendResponse.status}. Please ensure accounts are funded and try again later.`
          )
        } else if (sendResponse.status === 'ERROR') {
          console.error('Transaction submission error:', sendResponse.status)
          console.error('Error details:', JSON.stringify(sendResponse, null, 2))
          throw new Error(
            `Transaction submission failed with status: ${sendResponse.status}. Please check account funding and contract address.`
          )
        } else {
          console.error('Unexpected submission status:', sendResponse.status)
          throw new Error(
            `Transaction submission returned unexpected status: ${sendResponse.status}`
          )
        }
      } catch (error) {
        console.error(`Error invoking ${func}:`, error)
        throw error
      }
    } catch (error: any) {
      console.error('Error sending transaction or processing response:', error)

      // Attempt to decode Soroban diagnostic events if available
      if (error.getSorobanDiagnostics) {
        try {
          const diagnostics = await error.getSorobanDiagnostics(this.server)
          console.error('Soroban Diagnostics:', JSON.stringify(diagnostics, null, 2))
        } catch (diagError) {
          console.error('Failed to get Soroban diagnostics:', diagError)
        }
      }

      // Try to extract useful error information
      if (error.response && error.response.data) {
        console.error('Response data:', JSON.stringify(error.response.data, null, 2))
      } else if (error.result) {
        console.error('Error result:', JSON.stringify(error.result, null, 2))
      } else {
        try {
          console.error('Raw error object:', JSON.stringify(error, null, 2))
        } catch (e) {
          console.error('Raw error (non-serializable):', Object.keys(error))
        }
      }

      // If it's related to insufficient funds, provide a helpful message
      if (
        error.message &&
        (error.message.includes('insufficient') ||
          error.message.includes('balance') ||
          error.message.includes('fee'))
      ) {
        console.error(`
          This appears to be an insufficient funds error. 
          Please ensure the account ${this.publicKey} has:
          1. Been funded with XLM
          2. Has enough balance to cover transaction fees
          3. Has a trustline for any required assets
        `)
      }

      throw error
    }
  }

  /**
   * Helper for read-only contract calls
   * @param options Options for the contract call
   * @returns Result of the contract call
   */
  private async readContract({ func, args }: { func: string; args: any[] }): Promise<any> {
    try {
      // Create a contract instance
      const contract = new Contract(this.protocolContractId)

      // Create the operation for the contract call
      const operation = contract.call(func, ...args)

      // Build a temporary transaction for simulation
      const account = await this.server.getAccount(this.publicKey)
      const source = new Account(account.accountId(), account.sequenceNumber())

      const tx = new TransactionBuilder(source, {
        fee: '100000', // Use higher fee for better chances of success
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(operation)
        .setTimeout(600) // Set a reasonable timeout of 600 seconds
        .build()

      // Simulate the transaction
      const simulateResponse = await this.server.simulateTransaction(tx)

      // Check for simulation errors
      if (SorobanRpc.Api.isSimulationError(simulateResponse)) {
        console.warn(`Simulation error for read: ${JSON.stringify(simulateResponse)}`)
        throw new Error(`Contract read operation failed: ${func}. Error: ${simulateResponse.error}`)
      }

      // Extract the result
      const resultScVal = simulateResponse.result?.retval

      if (!resultScVal) {
        throw new Error(`No result returned from contract read operation: ${func}`)
      }

      // Convert the result to a native JS value
      try {
        return scValToNative(resultScVal)
      } catch (error) {
        console.warn(`Could not convert return value to native: ${error}`)
        return resultScVal
      }
    } catch (error) {
      console.error(`Error reading ${func}:`, error)
      throw error
    }
  }

  /**
   * Helper method to build and submit a transaction
   * @param operations Transaction operations
   * @returns Transaction result
   */
  private async buildAndSubmitTransaction(operations: any[]): Promise<any> {
    try {
      // Load the account
      const account = await this.server.getAccount(this.publicKey)

      // Build the transaction
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE.toString(),
        networkPassphrase: this.networkPassphrase,
      })

      // Add operations
      operations.forEach((operation) => {
        transaction.addOperation(operation)
      })

      // Finalize but don't sign yet
      const builtTx = transaction.setTimeout(60).build()

      // Simulate first
      const simulation = await this.server.simulateTransaction(builtTx)

      // Check for simulation errors
      if (SorobanRpc.Api.isSimulationError(simulation)) {
        throw new Error(`Simulation error: ${JSON.stringify(simulation)}`)
      }

      // Prepare the transaction with simulation results
      let preparedTx = builtTx

      // This step is crucial for Soroban - we need to prepare the transaction with the simulation results
      if (simulation.result) {
        try {
          // Use the SorobanRpc API to properly assemble the transaction
          preparedTx = SorobanRpc.assembleTransaction(builtTx, simulation).build()
        } catch (e) {
          console.error('Error assembling transaction:', e)
          // Continue with original tx if assembly fails
        }
      }

      let sendResponse

      if (this.signer instanceof Keypair) {
        preparedTx.sign(this.signer)
        sendResponse = await this.server.sendTransaction(preparedTx)
      } else {
        const signRes = await this.signer.signTransaction(preparedTx.toXDR())

        const trxn = xdr.TransactionEnvelope.fromXDR(signRes.signedTxXdr, 'base64')
        sendResponse = await this.server.sendTransaction(
          new Transaction(trxn, this.networkPassphrase)
        )
      }

      // Type cast for TypeScript compatibility
      const status = sendResponse.status as string
      if (status === 'PENDING') {
        // Wait for transaction to complete with timeout
        const start = new Date().getTime()
        const TIMEOUT_MS = 60000 // 60 seconds timeout

        let txResponse = await this.server.getTransaction(sendResponse.hash)

        while (
          (txResponse.status as string) === 'PENDING' &&
          new Date().getTime() - start < TIMEOUT_MS
        ) {
          // Wait before polling again
          await new Promise((resolve) => setTimeout(resolve, 2000))
          txResponse = await this.server.getTransaction(sendResponse.hash)
        }

        if ((txResponse.status as string) === 'SUCCESS') {
          return txResponse
        } else if ((txResponse.status as string) === 'PENDING') {
          throw new Error(`Transaction ${sendResponse.hash} timed out.`)
        } else {
          // Access resultXdr safely with type checking
          const failedResponse = txResponse as any
          if (failedResponse.resultXdr) {
            try {
              const resultXdr = xdr.TransactionResult.fromXDR(failedResponse.resultXdr, 'base64')
              console.error(
                'Transaction Result XDR:',
                JSON.stringify(resultXdr.result().results()[0], null, 2)
              )
            } catch (err) {
              console.error('Could not parse result XDR:', err)
            }
          }
          throw new Error(`Transaction failed with status: ${txResponse.status}`)
        }
      } else if (sendResponse.status === 'TRY_AGAIN_LATER') {
        console.error('Network congestion or rate limiting in effect:', sendResponse.status)
        console.error(
          'This often happens when accounts are not properly funded or the network is busy'
        )
        throw new Error(
          `Transaction submission returned status: ${sendResponse.status}. Please ensure accounts are funded and try again later.`
        )
      } else if (sendResponse.status === 'ERROR') {
        console.error('Transaction submission error:', sendResponse.status)
        console.error('Error details:', JSON.stringify(sendResponse, null, 2))
        throw new Error(
          `Transaction submission failed with status: ${sendResponse.status}. Please check account funding and contract address.`
        )
      } else {
        console.error('Unexpected submission status:', sendResponse.status)
        throw new Error(`Transaction submission returned unexpected status: ${sendResponse.status}`)
      }
    } catch (error) {
      throw error
    }
  }
}
