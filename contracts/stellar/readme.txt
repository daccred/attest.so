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

#### Available Options:
--authority        Deploy the Authority Resolver contract
--protocol        Deploy the Attestation Protocol contract  
--network         Target network (default: testnet)
--source          Source account identity (default: drew)
--mode            Deployment mode (default: default, options: default|clean)
--help            Show usage information