# AttestSDK

AttestSDK is a JavaScript library for interacting with the Attest API, enabling easy management of schemas within the Solana blockchain.

## Installation

You can install the package via npm:

```bash
npm install @attestprotocol/sdk
```

## Usage

To use the SDK, you need to import it and create an instance of the `AttestSDK` class:

```ts
import AttestSDK from '@attestprotocol/sdk'

async function run() {
  const secretKey = [
    /* your secret key here */
  ]

  const client = await AttestSDK.initializeSolana({
    url,
    walletOrSecretKey: secretKey,
  })

  const { data: schema, error: schemaError } = await client.createSchema({
    schemaName: 'test-schema',
    schemaContent: 'string name, string email, uint8 verification_level',
    revocable: true,
    levy: {
      amount: new anchor.BN(10),
      asset: mintAcount,
      recipient: authorityKeypair.publicKey,
    },
  })

  console.log({ schema })

  const fetchSchema = await client.fetchSchema(schema!)

  console.log({ fetchSchema })
}

run()
```

## Features

- **Register Schema:** Register a new schema with a name and content.
- **Fetch Schema:** Retrieve an existing schema by its ID.
