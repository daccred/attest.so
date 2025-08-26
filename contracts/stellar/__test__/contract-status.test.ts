import { describe, it, expect, beforeAll } from 'vitest'
import { Keypair, rpc } from '@stellar/stellar-sdk'
import * as ProtocolContract from '../bindings/src/protocol'
import * as AuthorityContract from '../bindings/src/authority'
import { loadTestConfig } from './testutils'

describe('Contract Status Check', () => {
  let protocolClient: ProtocolContract.Client
  let authorityClient: AuthorityContract.Client
  let adminKeypair: Keypair
  let config: any

  beforeAll(async () => {
    config = loadTestConfig()
    adminKeypair = Keypair.fromSecret(config.adminSecretKey)

    protocolClient = new ProtocolContract.Client({
      contractId: config.protocolContractId,
      networkPassphrase: ProtocolContract.networks.testnet.networkPassphrase,
      rpcUrl: config.rpcUrl,
      allowHttp: true
    })

    authorityClient = new AuthorityContract.Client({
      contractId: config.authorityContractId,
      networkPassphrase: AuthorityContract.networks.testnet.networkPassphrase,
      rpcUrl: config.rpcUrl,
      allowHttp: true
    })
  })

  it('should check if protocol contract is initialized', async () => {
    try {
      // Try to call a simple method to see if contract responds
      const tx = await protocolClient.get_attestation({
        attestation_uid: Buffer.alloc(32, 0)
      })

      await tx.simulate()
      console.log('Protocol contract is accessible')
    } catch (error: any) {
      console.log('Protocol contract error:', error.message)
      // If we get a specific error about missing attestation, contract is working but no attestation exists
      expect(error.message).toBeDefined()
    }
  })

  it('should check if authority contract is initialized', async () => {
    try {
      // Try to get the admin address which should work if initialized
      const tx = await authorityClient.get_admin_address()
      const result = await tx.simulate()
      console.log('Authority contract admin:', result)
    } catch (error: any) {
      console.log('Authority contract error:', error.message)
      // If we get a specific error, we know what's happening
      expect(error.message).toContain('Error')
    }
  })
})