# Stellar Contract Scripts

This directory contains scripts for interacting with Stellar smart contracts in the Attest Protocol.

## Integration Testing

The integration test script (`integration-test.mjs`) performs a full lifecycle test of the Protocol contract, including:

1. Schema registration
2. Attestation creation
3. Attestation verification
4. Attestation revocation
5. Verification of the revoked status

### Prerequisites

- Node.js v16+ 
- Environment variables set with the proper credentials:
  - `ADMIN_SECRET_KEY`: Secret key of an account with admin privileges
  - `SOROBAN_RPC_URL` (optional): RPC URL for the Soroban API (defaults to Testnet)
  - `SOROBAN_NETWORK_PASSPHRASE` (optional): Network passphrase (defaults to Testnet)

### Running the Test

You can run the integration test using the provided shell script:

```bash
./run-integration-test.sh
```

Alternatively, you can run it directly with Node:

```bash
node integration-test.mjs
```

Make sure your environment variables are properly set before running the test.

### Implementation Details

The test uses the existing `protocol.mjs` script to interact with the deployed Protocol contract. It executes a series of commands:

1. **Schema Registration**: Registers a new schema with the format `name(string),age(u32),verified(bool)`
2. **Attestation Creation**: Creates an attestation for a test address using the registered schema
3. **Attestation Verification**: Retrieves and verifies the attestation data
4. **Attestation Revocation**: Revokes the attestation
5. **Revocation Verification**: Verifies that the attestation has been successfully revoked

The test validates each step and will fail if any part of the process doesn't work as expected.

## Troubleshooting

If the test fails, check:

1. That your `ADMIN_SECRET_KEY` has sufficient funds on the network
2. That the Protocol contract ID in `deployments.json` is correct
3. The console output for specific error messages from the Soroban RPC 