# Stellar Authority Contract Integration Tests

This directory contains integration tests for the Stellar Authority contract.

## Account Setup Strategy

The tests use a hierarchical account model with the admin from the environment:

1. The admin keypair MUST come from the environment (ADMIN_SECRET_KEY in env.sh)
   - This is loaded **directly** in the integration test file
   - Not passed to the account setup function
2. A random parent account is created and funded with Friendbot (10,000 XLM)
3. The parent account creates test accounts for specific roles:
   - **authority** (3 XLM) - The account to be registered as an authority
   - **levy-recipient** (2 XLM) - The account that receives levy payments
   - **attestation-subject** (1 XLM) - The subject of attestations
   - **general-user** (1 XLM) - Additional account for general testing

This approach provides a good balance:

- The admin keypair is controlled via environment variables
- Test accounts are created automatically for each test run
- Only one Friendbot call is needed for the auxiliary accounts

### How It Works

The implementation is split across two files:

1. **authority.integration.test.mjs**:

   - Loads ADMIN_SECRET_KEY from env.sh
   - Creates Keypair from the secret key
   - Verifies it matches ADMIN_ADDRESS

2. **setup.mjs**:
   - Creates a random parent account and funds it using Friendbot
   - Creates role-specific test accounts using this parent
   - Does NOT create or manage the admin account

### Usage

To use this approach in your tests:

```javascript
// In your test file
import { setupTestAccounts } from './setup.mjs'

// 1. Load admin keypair directly from environment
const adminKeypair = Keypair.fromSecret(env.ADMIN_SECRET_KEY)
const adminAddress = adminKeypair.publicKey()

// 2. Setup the other test accounts (doesn't include admin)
const accounts = await setupTestAccounts(server)

// 3. Extract test accounts (but not admin - that comes from env)
const { parentKeypair, authorityToRegisterKp, levyRecipientKp, subjectKp, userKp } = accounts

// 4. Use adminKeypair and test accounts in your tests
```

### Manual Account Creation

If you need to create specific accounts manually:

```javascript
import { fundAccountWithFriendbot, createAccount } from './account-setup.mjs'

// Create and fund a parent account
const parentKeypair = Keypair.random()
await fundAccountWithFriendbot(parentKeypair.publicKey())

// Create a new named account using the parent account
const newAccount = await createAccount(server, parentKeypair, 'authority', '3')
```

## Running Tests

To run the tests:

```bash
npm install
npm test
```

## Environment Setup

Your `env.sh` file must include:

```
ADMIN_SECRET_KEY=your_admin_secret_key
ADMIN_ADDRESS=your_admin_address
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
TOKEN_CONTRACT_ID=your_token_contract_id
```

The admin account is sourced directly from the environment in the test file.
