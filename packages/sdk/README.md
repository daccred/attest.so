# AttestSDK

AttestSDK is a JavaScript library for interacting with the Attest API, enabling easy management of schemas within the Solana blockchain.

## Installation

You can install the package via npm:

```bash
npm install @peke65/attest-sdk
```



## Usage

To use the SDK, you need to import it and create an instance of the `AttestSDK` class:

```ts
import AttestSDK from '@peke65/attest-sdk';

async function run() {
  const secretKey = [/* your secret key here */];

  const client = new AttestSDK({
    secretKey,
  });

  const res = await client.schema.register({
    schemaName: 'schema-name',
    schemaContent: '{"name": "example", "type": "object"}',
  });

  console.log({ res });

  const res2 = await client.schema.fetch(res.data!.toBase58());

  console.log({ res2 });
}

run();

```

## Features
- **Register Schema:** Register a new schema with a name and content.
- **Fetch Schema:** Retrieve an existing schema by its ID.


