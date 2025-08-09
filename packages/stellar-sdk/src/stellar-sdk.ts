/**
 * Stellar implementation of the Attest Protocol SDK
 */

import {
  AttestProtocolBase,
  AttestProtocolResponse,
  Authority,
  Schema,
  Attestation,
  SchemaDefinition,
  AttestationDefinition,
  RevocationDefinition,
  DelegatedAttestationDefinition,
  DelegatedRevocationDefinition,
  ListAttestationsByWalletParams,
  ListAttestationsBySchemaParams,
  ListSchemasByIssuerParams,
  PaginatedResponse,
  AttestProtocolErrorType,
  createSuccessResponse,
  createErrorResponse,
  createAttestProtocolError,
} from '@attestprotocol/core'

import {
  StellarConfig,
  StellarCustomSigner,
  StellarSchemaConfig,
  StellarAttestationConfig,
  StellarAttestationConfigWithValue,
  StellarFetchAuthorityResult,
  StellarFetchSchemaResult,
  StellarCreateSchemaResult,
  StellarFetchAttestationResult,
  StellarRevokeAttestationConfig,
} from './types'

import {
  Address,
  Contract,
  TransactionBuilder,
  Keypair,
  Networks,
  xdr,
  BASE_FEE,
  TimeoutInfinite,
  scValToNative,
  Account,
  Transaction,
  rpc,
} from '@stellar/stellar-sdk'

// Default contract addresses
const PROTOCOL_CONTRACT_ID = 'CDUHCKCAQWWWGNPNPBV5KOQP2WIIRIEJHJVPYRFGZ2FGJQLBN557LBDH'
const AUTHORITY_CONTRACT_ID = 'CD2AGNVUJD7AGGJ7GDUET4YZOVFBGT4SQJ6PMHV3T7V2MN5UCT7IABOI'

/**
 * Stellar implementation of the Attest SDK
 */
export class StellarAttestProtocol extends AttestProtocolBase {
  private server: rpc.Server
  private publicKey: string = ''
  private networkPassphrase: string
  private protocolContractId: string
  private authorityContractId: string
  private contract: Contract
  private signer: Keypair | StellarCustomSigner

  /**
   * Creates a new instance of the Stellar Attest SDK
   * @param config SDK configuration options
   */
  constructor(config: StellarConfig) {
    super(config)

    // Initialize Stellar SDK
    const defaultUrl = 'https://soroban-testnet.stellar.org'
    this.server = new rpc.Server(config.url ?? defaultUrl, {
      allowHttp: config.allowHttp ?? (config.url ?? defaultUrl).startsWith('http://'),
    })

    // Initialize connection type based on config
    if (typeof config.secretKeyOrCustomSigner === 'string') {
      this.signer = Keypair.fromSecret(config.secretKeyOrCustomSigner)
    } else {
      this.signer = config.secretKeyOrCustomSigner
    }

    this.publicKey = config.publicKey
    this.networkPassphrase = config.networkPassphrase ?? Networks.TESTNET
    this.protocolContractId = config.contractAddresses?.protocol ?? PROTOCOL_CONTRACT_ID
    this.authorityContractId = config.contractAddresses?.authority ?? AUTHORITY_CONTRACT_ID
    this.contract = new Contract(this.protocolContractId)
  }

  protected getDefaultNetworkUrl(): string {
    return 'https://soroban-testnet.stellar.org'
  }

  /**
   * Initialize the protocol contract by setting the admin
   */
  async initialize(): Promise<AttestProtocolResponse<void>> {
    return this.safeExecute(
      async () => {
        const adminScVal = new Address(this.publicKey).toScVal()

        await this.invoke({
          func: 'initialize',
          args: [adminScVal],
        })
      },
      () => {
        this.initialized = true
      }
    )
  }

  // Authority Management

  async registerAuthority(): Promise<AttestProtocolResponse<string>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return createSuccessResponse(this.publicKey)
  }

  async fetchAuthority(id: string): Promise<AttestProtocolResponse<Authority | null>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // In Stellar, authority is implicit with the address
      if (id === this.publicKey) {
        return {
          id: this.publicKey,
          isVerified: true,
          metadata: 'Default authority metadata',
        }
      }
      return null
    })
  }

  async isIssuerAnAuthority(issuer: string): Promise<AttestProtocolResponse<boolean>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return createSuccessResponse(true) // In Stellar, any address can be an authority
  }

  // Schema Management

  async createSchema(config: SchemaDefinition): Promise<AttestProtocolResponse<Schema>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    const validationError = this.validateSchemaDefinition(config)
    if (validationError) return createErrorResponse(validationError)

    return this.safeExecute(async () => {
      const caller = new Address(this.publicKey).toScVal()
      const schemaDefinition = xdr.ScVal.scvString(config.content)
      const resolver = config.resolver
        ? new Address(config.resolver).toScVal()
        : xdr.ScVal.scvVoid()
      const revocable = xdr.ScVal.scvBool(config.revocable ?? true)

      const result = await this.invoke({
        func: 'register',
        args: [caller, schemaDefinition, resolver, revocable],
      })

      const uid = scValToNative((result.transactionResponse as any).returnValue).toString('hex')

      return {
        uid,
        definition: config.content,
        authority: this.publicKey,
        revocable: config.revocable ?? true,
        resolver: config.resolver ?? null,
        levy: config.levy ?? null,
      }
    })
  }

  async fetchSchemaById(id: string): Promise<AttestProtocolResponse<Schema | null>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      if (!/^[0-9a-fA-F]{64}$/.test(id)) {
        throw createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          'Invalid schema UID format. Expected a 64-character hex string.'
        )
      }

      const schemaUidScVal = xdr.ScVal.scvBytes(Buffer.from(id, 'hex'))

      try {
        const schemaResult = await this.readContract({
          func: 'get_schema',
          args: [schemaUidScVal],
        })

        if (schemaResult) {
          return {
            uid: id,
            definition: schemaResult.definition || '',
            authority: schemaResult.authority || this.publicKey,
            revocable: schemaResult.revocable ?? true,
            resolver: schemaResult.resolver || null,
            levy: null,
          }
        }
      } catch (error) {
        console.error('Could not read schema from contract:', error)
      }

      return null
    })
  }

  async generateIdFromSchema(schema: SchemaDefinition): Promise<AttestProtocolResponse<string>> {
    return this.safeExecute(async () => {
      // Generate a deterministic ID based on schema content and authority
      const content = `${this.publicKey}:${schema.name}:${schema.content}`
      const encoder = new TextEncoder()
      const data = encoder.encode(content)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    })
  }

  async listSchemasByIssuer(
    params: ListSchemasByIssuerParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Schema>>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // This would require indexing or event querying in a real implementation
      // For now, return empty results
      return this.createPaginatedResponse([], 0, params.limit ?? 10, params.offset ?? 0)
    })
  }

  // Attestation Management

  async issueAttestation(
    config: AttestationDefinition
  ): Promise<AttestProtocolResponse<Attestation>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    const validationError = this.validateAttestationDefinition(config)
    if (validationError) return createErrorResponse(validationError)

    return this.safeExecute(async () => {
      if (!/^[0-9a-fA-F]{64}$/.test(config.schemaUid)) {
        throw createAttestProtocolError(
          AttestProtocolErrorType.VALIDATION_ERROR,
          'Invalid schema UID format. Must be a 64-character hex string.'
        )
      }

      const caller = Address.fromString(this.publicKey).toScVal()
      const schemaUid = xdr.ScVal.scvBytes(Buffer.from(config.schemaUid, 'hex'))
      const subject = Address.fromString(config.subject).toScVal()
      const value = xdr.ScVal.scvString(config.data)
      const reference = xdr.ScVal.scvString(config.reference || '')

      const result = await this.invoke({
        func: 'attest',
        args: [caller, schemaUid, subject, value, reference],
      })

      const timestamp = Date.now()

      return {
        uid: result.transaction.hash,
        schemaUid: config.schemaUid,
        subject: config.subject,
        attester: this.publicKey,
        data: config.data,
        timestamp,
        expirationTime: config.expirationTime || null,
        revocationTime: null,
        revoked: false,
        reference: config.reference || null,
      }
    })
  }

  async fetchAttestationById(id: string): Promise<AttestProtocolResponse<Attestation | null>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // In Stellar implementation, we'd need to parse the transaction or query by components
      // This is a simplified implementation
      return null
    })
  }

  async listAttestationsByWallet(
    params: ListAttestationsByWalletParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // This would require indexing or event querying in a real implementation
      return this.createPaginatedResponse([], 0, params.limit ?? 10, params.offset ?? 0)
    })
  }

  async listAttestationsBySchema(
    params: ListAttestationsBySchemaParams
  ): Promise<AttestProtocolResponse<PaginatedResponse<Attestation>>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    return this.safeExecute(async () => {
      // This would require indexing or event querying in a real implementation
      return this.createPaginatedResponse([], 0, params.limit ?? 10, params.offset ?? 0)
    })
  }

  async revokeAttestation(config: RevocationDefinition): Promise<AttestProtocolResponse<void>> {
    const initError = this.ensureInitialized()
    if (initError) return createErrorResponse(initError)

    const validationError = this.validateRevocationDefinition(config)
    if (validationError) return createErrorResponse(validationError)

    return this.safeExecute(async () => {
      // Implementation would depend on how revocation works in Stellar contracts
      // This is a placeholder
    })
  }

  // Delegation (not implemented in current Stellar contracts)

  async attestByDelegation(
    config: DelegatedAttestationDefinition
  ): Promise<AttestProtocolResponse<Attestation>> {
    return createErrorResponse(
      createAttestProtocolError(
        AttestProtocolErrorType.NOT_FOUND_ERROR,
        'Delegation not implemented in Stellar contracts'
      )
    )
  }

  async revokeByDelegation(
    config: DelegatedRevocationDefinition
  ): Promise<AttestProtocolResponse<void>> {
    return createErrorResponse(
      createAttestProtocolError(
        AttestProtocolErrorType.NOT_FOUND_ERROR,
        'Delegation not implemented in Stellar contracts'
      )
    )
  }

  // Stellar-specific helper methods

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
    transaction: rpc.Api.SendTransactionResponse
    transactionResponse: rpc.Api.GetTransactionResponse
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
      if (rpc.Api.isSimulationError(simulateResponse)) {
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
          preparedTx = rpc.assembleTransaction(tx, simulateResponse).build()
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
            txResponse.status === rpc.Api.GetTransactionStatus.NOT_FOUND &&
            new Date().getTime() - start < TIMEOUT_MS
          ) {
            // Wait a bit before polling again
            await new Promise((resolve) => setTimeout(resolve, 2000)) // 2 seconds delay
            console.log('Polling for status...')
            txResponse = await this.server.getTransaction(sendResponse.hash)
          }

          if (txResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
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
  private async readContract(options: { func: string; args: xdr.ScVal[] }): Promise<any> {
    const operation = this.contract.call(options.func, ...options.args)

    const account = await this.server.getAccount(this.publicKey)
    const builder = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })

    const transaction = builder.addOperation(operation).setTimeout(TimeoutInfinite).build()

    const response = await this.server.simulateTransaction(transaction)

    if (rpc.Api.isSimulationSuccess(response)) {
      return scValToNative(response.result!.retval)
    }

    throw new Error(`Contract read failed: ${response}`)
  }

  private async buildAndSubmitTransaction(operations: any[]): Promise<any> {
    const account = await this.server.getAccount(this.publicKey)
    const builder = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })

    operations.forEach((op) => builder.addOperation(op))

    let transaction = builder.setTimeout(TimeoutInfinite).build()

    // Prepare transaction for simulation
    const preparedTransaction = await this.server.prepareTransaction(transaction)

    // Sign the transaction
    let signedTransaction: Transaction
    if (this.signer instanceof Keypair) {
      preparedTransaction.sign(this.signer)
      signedTransaction = preparedTransaction
    } else {
      const signedResult = await this.signer.signTransaction(preparedTransaction.toXDR())
      signedTransaction = new Transaction(signedResult.signedTxXdr, this.networkPassphrase)
    }

    // Submit the transaction
    const response = await this.server.sendTransaction(signedTransaction)

    if (response.status === 'PENDING') {
      // Wait for confirmation
      let confirmedResponse
      let attempts = 0
      const maxAttempts = 30

      while (attempts < maxAttempts) {
        try {
          confirmedResponse = await this.server.getTransaction(response.hash)
          if (confirmedResponse.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
            break
          }
        } catch (error) {
          // Transaction not found yet, continue waiting
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))
        attempts++
      }

      if (!confirmedResponse || confirmedResponse.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
        throw new Error(`Transaction failed or timed out: ${response.hash}`)
      }

      return {
        transaction: signedTransaction,
        transactionResponse: confirmedResponse,
      }
    }

    throw new Error(`Transaction submission failed: ${response.status}`)
  }
}
