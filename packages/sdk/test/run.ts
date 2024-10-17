import { Keypair } from '@solana/web3.js'
import AttestSDK from '../src'
import * as anchor from '@coral-xyz/anchor'
import { WalletNetwork } from '../src/core/types'

async function run() {
  // const secretKey = [
  //   114, 196, 179, 104, 127, 64, 39, 59, 139, 102, 15, 159, 174, 148, 220, 126, 53, 58, 254, 166,
  //   162, 119, 252, 77, 119, 61, 64, 44, 131, 150, 23, 36, 220, 229, 29, 142, 145, 8, 143, 3, 124,
  //   35, 111, 115, 224, 191, 68, 64, 198, 202, 179, 60, 250, 89, 214, 140, 3, 234, 169, 159, 235, 42,
  //   26, 42,
  // ]

  const authorityPair = [
    113, 7, 155, 214, 148, 126, 181, 107, 120, 44, 193, 72, 169, 185, 218, 216, 104, 3, 106, 237,
    40, 195, 35, 191, 40, 51, 61, 70, 37, 168, 34, 68, 182, 64, 112, 205, 55, 248, 241, 213, 45,
    191, 199, 3, 183, 58, 48, 133, 131, 2, 110, 253, 146, 222, 31, 123, 18, 73, 114, 55, 78, 185,
    101, 68,
  ]

  const authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(authorityPair))

  const wallet = new anchor.Wallet(authorityKeypair)

  const client = new AttestSDK({
    network: WalletNetwork.DEVNET,
    wallet: wallet,
    heliusAPIKey: 'helius-api-key',
  })

  const res = await client.schema.generate({
    schemaName: 'schema-bean',
    schemaContent: '{"name": "example", "type": "object"}',
  })

  console.log({ res })

  const res2 = await client.schema.fetch(res.data!.uid.toBase58())

  console.log({ res2 })

  client.schema
    .getAllSchemaRecords()
    .then((res) => {
      console.log(res)
    })
    .catch((err) => {
      console.log(err)
    })

  client.schema
    .getAllSchemaForWallet()
    .then((res) => {
      console.log(res)
    })
    .catch((err) => {
      console.log(err)
    })
}

run()
