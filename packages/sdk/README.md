# AttestSDK

AttestSDK is a JavaScript library for creating and managing attestations across multiple blockchains, currently supporting Solana and Stellar networks.

## Installation

```bash
npm install @attestprotocol/sdk
```

## Supported Chains

The SDK currently supports:

- **Solana** - Full support for creating schemas and attestations
- **Stellar** - Support for Soroban smart contracts

## Usage

### Solana Usage

```ts
import { AttestSDK } from '@attestprotocol/sdk'
import * as anchor from '@coral-xyz/anchor'

async function run() {
  // Initialize with secret key or wallet
  const secretKey = [ /* your secret key here */ ]
  
  const client = await AttestSDK.initializeSolana({
    url: 'https://api.devnet.solana.com', // or your RPC endpoint
    walletOrSecretKey: secretKey, // or a wallet adapter
  })

  // Register as an authority (if needed)
  const { data: authority } = await client.registerAuthority()
  
  // Create a schema
  const { data: schema } = await client.createSchema({
    schemaName: 'user-verification',
    schemaContent: 'string name, string email, uint8 verification_level',
    revocable: true,
    levy: {
      amount: new anchor.BN(10),
      asset: mintAccount, // SPL token mint account
      recipient: authorityPublicKey,
    },
  })

  // Fetch schema details
  const { data: schemaDetails } = await client.fetchSchema(schema)
  
  // Create an attestation
  const { data: attestation } = await client.attest({
    schemaData: schema,
    data: 'User attestation data',
    revocable: true,
    accounts: {
      recipient: recipientPublicKey,
      levyReceipent: levyRecipientPublicKey,
      mintAccount: mintAccount,
    },
  })
  
  // Fetch attestation details
  const { data: attestationDetails } = await client.fetchAttestation(attestation)
  
  // Revoke an attestation
  const { data: revokedAttestation } = await client.revokeAttestation({
    attestationUID: attestation,
    recipient: recipientPublicKey,
  })
}
```

### Stellar Usage

```ts
import { AttestSDK } from '@attestprotocol/sdk'
import * as StellarSdk from '@stellar/stellar-sdk'

async function run() {
  // Create a keypair or use an existing one
  const keypair = StellarSdk.Keypair.fromSecret('YOUR_STELLAR_SECRET_KEY')
  
  const client = await AttestSDK.initializeStellar({
    secretKeyOrCustomSigner: keypair.secret(), // or a custom signer
    publicKey: keypair.publicKey(),
  })
  
  // Create a schema
  const { data: schema } = await client.createSchema({
    schemaName: 'identity-schema',
    schemaContent: 'IdentitySchema(Name=string, Age=u32, Address=string)',
    revocable: true,
  })
  
  // Create an attestation
  const attestData = {
    schemaUID: schema.schemaUID,
    subject: recipientPublicKey,
    value: JSON.stringify({
      Name: 'John Doe',
      Age: 30,
      Address: '123 Main St'
    }),
    reference: 'reference-id-12345'
  }
  
  const { data: attestation } = await client.attest(attestData)
  
  // Fetch the attestation
  const { data: fetchedAttestation } = await client.fetchAttestation(attestData)
  
  // Revoke the attestation
  const { data: revokedAttestation } = await client.revokeAttestation(attestData)
}
```

## API Reference

### Common Methods

All chains implement these core methods:

- `fetchAuthority()` - Get the authority record
- `registerAuthority()` - Register as an authority
- `createSchema()` - Create a new schema
- `fetchSchema()` - Fetch schema details
- `attest()` - Create a new attestation
- `fetchAttestation()` - Fetch attestation details
- `revokeAttestation()` - Revoke an attestation

### Solana-specific Methods

- `getWalletBalance()` - Get the balance of the connected wallet

### Stellar-specific Methods

- `initialize()` - Initialize the protocol contract
- `initializeAuthority()` - Initialize the authority resolver contract

## License

MIT