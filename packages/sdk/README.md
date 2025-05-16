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
- **Create Attestation:** Create an attestation based on a schema.
- **Revoke Attestation:** Revoke an attestation.

## Running Tests

### Solana Tests
```bash
yarn test-solana
```

### Stellar Tests
Stellar tests require funded accounts on the Stellar Testnet and access to deployed Soroban contracts. Before running the tests:

1. Fund the test accounts using the Stellar Friendbot:
   - Authority Account: https://friendbot.stellar.org/?addr=GBULAMIEKTTBKNV44XSC3SQZ7P2YU5BTBZI3WG3ZDYBPIH7N74D3SXAA
   - Recipient Account: https://friendbot.stellar.org/?addr=GCBG6NXX3TNAYFSJMJ6XZWJOZHIUSEHIXTTZ3HHRVPWLBIH427OYGZ4C

2. Verify contract deployment:
   - The default Protocol Contract ID is: CBPL7XR7NNPTNSIIFWQMWLSCX3B3MM36UYX4TW3QXJKTIEA6KDLRYAQP
   - The default Authority Contract ID is: CDQREK6BTPEVD4O56XR6TKLEEMNYTRJUG466J2ERNE5POIEKN2N6O7EL
   - You can override these addresses using command-line arguments (see below)

3. Run the tests:
```bash
yarn test-stellar
```

Command-line options:
- `--force-continue`: Bypass the funding check (test will likely fail with unfunded accounts)
- `--protocol=<address>`: Override the protocol contract address
- `--authority=<address>`: Override the authority contract address
- `--token=<address>`: Set a token contract address for authority initialization
- `--testnet`: Specify that you're using the Stellar testnet

```bash
# Example with custom contracts
yarn test-stellar -- --protocol=CBFL7XR7NNPTNSIIFWQMWLSCX3B3MM36UYX4TW3QXJKTIEA6KDLRYAQZ --authority=CDQR4K6BTPEVD4O56XR6TKLEEMNYTRJUG466J2ERNE5POIEKN2N6O7EM
```


