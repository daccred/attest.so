import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { SolanaAttestationService } from '../target/types/solana_attestation_service'

describe('anchor', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env())

  const program = anchor.workspace.SolanaAttestationService as Program<SolanaAttestationService>

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc()
    console.log('Your transaction signature', tx)
  })
})
