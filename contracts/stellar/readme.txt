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


ℹ️  Signing transaction: 98280fe8f2e2d843f319c95ed1568902a2cfd860e6217b9a0d491fe6f59b53b7
🌎 Submitting deploy transaction…
🔗 https://stellar.expert/explorer/testnet/contract/CAISGXYBRUUORH4BAWWQTUS3CWUEOUB7GK5NFLA3KXQ3AVGGJJIDQKD4
CAISGXYBRUUORH4BAWWQTUS3CWUEOUB7GK5NFLA3KXQ3AVGGJJIDQKD4
 