## Stellar Smart Contracts Overview

This project contains two main Soroban (Stellar) smart contracts:

### 1. Attestation Protocol Contract (`protocol/src/lib.rs`)

The Attestation Protocol contract manages the core attestation functionality:

- **Initialization**: Sets up the contract with an admin address
- **Schema Registration**: Allows users to register attestation schemas with optional resolver and revocability settings
- **Attestation Management**:
  - Create attestations linking subjects to schemas with values
  - Revoke attestations when needed
  - Query attestation records

Key functions:
- `initialize(env, admin)`: Initialize the contract with an admin
- `register(env, caller, schema_definition, resolver, revocable)`: Register a new schema
- `attest(env, caller, schema_uid, subject, value, reference)`: Create an attestation
- `revoke_attestation(env, caller, schema_uid, subject, reference)`: Revoke an attestation
- `get_attestation(env, schema_uid, subject, reference)`: Retrieve attestation data

### 2. Authority Resolver Contract (`authority/src/lib.rs`)

The Authority Resolver contract manages authorities and schema rules:

- **Initialization**: Sets up the contract with admin and token contract
- **Admin Functions**:
  - Register authorities
  - Register schemas with rules
  - Set schema levies and registration fees
- **Public Functions**:
  - Register authorities (with payment)
  - Verify authority status
  - Process attestations and revocations
  - Withdraw collected levies
- **Getter Functions**: Access contract state information

Key functions:
- `initialize(env, admin, token_contract_id)`: Initialize the contract
- `admin_register_authority(env, admin, auth_to_reg, metadata)`: Admin registers an authority
- `register_authority(env, caller, authority_to_reg, metadata)`: Public authority registration
- `attest(env, attestation)`: Process an attestation through the authority
- `revoke(env, attestation)`: Process a revocation through the authority
- `withdraw_levies(env, caller)`: Allow authorities to withdraw collected fees

The contracts work together to provide a complete attestation system with authority management and economic incentives.

---

### Resources and Toolkits
- Developer Tools: https://developers.stellar.org/docs/tools/developer-tools
- XDR-JSON Visualizer: https://lab.stellar.org/xdr/view
- Account Generator: https://lab.stellar.org/account/create


### Deployment
The `deploy.sh` script provides flexible options for deploying the Attestation Protocol and Authority Resolver contracts. Remember to ensure jq is installed (brew install jq or similar).

#### Basic Usage Examples:
# Default mode (build, deploy) - deploys both contracts to testnet
./deploy.sh --authority --protocol

# Clean mode (clean, test, build, deploy) - full deployment cycle
./deploy.sh --authority --protocol --mode clean

# Deploy only authority in clean mode to mainnet
./deploy.sh --authority --mode clean --network mainnet --source your_mainnet_key

# Deploy both and initialize them on testnet (requires TOKEN_CONTRACT_ID in env.sh or --token-id flag)
./deploy.sh --authority --protocol --initialize --source your_testnet_key --token-id <YOUR_TOKEN_CONTRACT_ID>

#### Available Options:
--authority        Deploy the Authority Resolver contract
--protocol        Deploy the Attestation Protocol contract
--network         Target network (default: testnet, or from SOROBAN_NETWORK in env.sh)
--source          Source account identity (Can be set via SOURCE_IDENTITY in env.sh)
--mode            Deployment mode (default: default, options: default|clean)
--initialize      Initialize deployed contracts using the source identity as admin (default: false)
--token-id <id>   Token contract ID for authority initialization (required if --initialize and --authority). (Can be set via TOKEN_CONTRACT_ID in env.sh)
--help            Show usage information




========================================
STEP: Deploying authority Contract
========================================
Deploying target/wasm32-unknown-unknown/release/authority.wasm...
ℹ️  Skipping install because wasm already installed
ℹ️  Using wasm hash 2b08d2cafae3367418070c75715f1e18d3682b071e7d84f151add56fb5881d67
ℹ️  Simulating deploy transaction…
ℹ️  Transaction hash is 747ebf120b708418bfce5749b4dba87fafcfaac310e6c1af12d257de4b48fef8
🔗 https://stellar.expert/explorer/testnet/tx/747ebf120b708418bfce5749b4dba87fafcfaac310e6c1af12d257de4b48fef8
ℹ️  Signing transaction: 747ebf120b708418bfce5749b4dba87fafcfaac310e6c1af12d257de4b48fef8
🌎 Submitting deploy transaction…
🔗 https://stellar.expert/explorer/testnet/contract/CCSLTCC55GHW7XSZIWQ6OZVH262J2EHIRCYGXBB5G7IQZ5LR3SAJZDCE
✅ Deployed!
CCSLTCC55GHW7XSZIWQ6OZVH262J2EHIRCYGXBB5G7IQZ5LR3SAJZDCE
authority Contract ID: CCSLTCC55GHW7XSZIWQ6OZVH262J2EHIRCYGXBB5G7IQZ5LR3SAJZDCE
authority Tx Hash: 747ebf120b708418bfce5749b4dba87fafcfaac310e6c1af12d257de4b48fef8
authority Timestamp: 2025-05-17T21:32:02Z
Updating deployments.json for network 'testnet' with authority details...
deployments.json updated successfully.

========================================
STEP: Deploying protocol Contract
========================================
Deploying target/wasm32-unknown-unknown/release/protocol.wasm...
ℹ️  Simulating install transaction…
ℹ️  Signing transaction: 09f20429b075ebfb90920de126d855efe88c493290c85bc5c1b3b6f7c9be3439
🌎 Submitting install transaction…
ℹ️  Using wasm hash 51bb734c0c9477836bedf9c3f310142296ca80e17d15bfa5cc507957d7d619e9
ℹ️  Simulating deploy transaction…
ℹ️  Transaction hash is 17eaaa236086bffb82fd63d131f48453794f81aed76ba21fdb0fcb121a01973a
🔗 https://stellar.expert/explorer/testnet/tx/17eaaa236086bffb82fd63d131f48453794f81aed76ba21fdb0fcb121a01973a
ℹ️  Signing transaction: 17eaaa236086bffb82fd63d131f48453794f81aed76ba21fdb0fcb121a01973a
🌎 Submitting deploy transaction…
🔗 https://stellar.expert/explorer/testnet/contract/CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO
✅ Deployed!
CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO
protocol Contract ID: CDDRYX6CX4DLYTKXJFHX5BPHSQUCIPUFTEN74XJNK5YFFENYUBKYCITO
protocol Tx Hash: 17eaaa236086bffb82fd63d131f48453794f81aed76ba21fdb0fcb121a01973a
protocol Timestamp: 2025-05-17T21:32:22Z
Updating deployments.json for network 'testnet' with protocol details...
deployments.json updated successfully.

========================================
STEP: Stellar CLI Contract Interactions
========================================
# Generate Authority Typescript Contract bindings
# Generate Authority Typescript Contract bindings
stellar contract bindings typescript \
  --network testnet \
  --contract-id CC673T4LKURVLKJFRECXAEILKLXX74FQQTFIR5FLKZJJDDZ5Y5NLWF7O \
  --output-dir ./bindings/protocol

# Generate Protocol Typescript Contract bindings
stellar contract bindings typescript \
  --network testnet \
  --contract-id CCJDGGA754NBRTV63VBNEON6NKDJ3H7TRVELR6WX5KEJY7S7UANRT22H \
  --output-dir ./bindings/protocol


### invoke the initialize function on the Authority Resolver Contract
stellar contract invoke \
    --id CCJDGGA754NBRTV63VBNEON6NKDJ3H7TRVELR6WX5KEJY7S7UANRT22H \
    --source SDRNJOIMKSA6N4MZ5PQJ6GDBZZSLBFGU65D6435SMTCQFMKRSPSWFI5S \
    --network testnet \
    -- \
    initialize \
    --admin GDATIARGDERUBYRHBOLXFKFWXXTJ4EF7LL4FJTB3R7JBGA275MC5VRHW \
    --token_contract_id CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC


#### invoke the initialize function on the Protocol Contract
stellar contract invoke \
    --id CCJDGGA754NBRTV63VBNEON6NKDJ3H7TRVELR6WX5KEJY7S7UANRT22H \
    --source SDRNJOIMKSA6N4MZ5PQJ6GDBZZSLBFGU65D6435SMTCQFMKRSPSWFI5S \
    --network testnet \
    -- \
    initialize \
    --admin GDATIARGDERUBYRHBOLXFKFWXXTJ4EF7LL4FJTB3R7JBGA275MC5VRHW