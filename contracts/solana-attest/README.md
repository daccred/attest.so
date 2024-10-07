## Solana Attestation Service

This is a Solana program that allows users to attest to the authenticity of a Solana transaction.

### Setup

1. Install Rust and Anchor CLI

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install --git https://github.com/coral-xyz/anchor --tag v0.25.0 anchor-cli --locked
```

2. Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.14.13/install)"
```

3. Add Solana to PATH

```bash
export PATH="/home/0x/.local/share/solana/install/active_release/bin:$PATH"
```

4. Create a new Solana keypair

```bash
solana-keygen new
```

5. Add the new keypair to the Solana config

```bash
solana config set --keypair ~/.config/solana/id.json
```

6.

6. Initialize the program 

```bash
anchor idl init
anchor idl seed
anchor idl generate
anchor build
anchor deploy
```

## Program Methods

#### `Register a new authority`

```bash
solana airdrop 10 <AUTHORITY_PUBKEY>
anchor invoke --program-id <PROGRAM_ID> register --accounts <AUTHORITY_PUBKEY>
```

#### `Verify the authority`

```bash
anchor invoke --program-id <PROGRAM_ID> update-authority --accounts <AUTHORITY_PUBKEY>
```

#### `Register a new schema`

```bash
anchor invoke --program-id <PROGRAM_ID> register-schema --accounts <AUTHORITY_PUBKEY> --args <SCHEMA_NAME> <SCHEMA_CONTENT> <RESOLVER_ADDRESS> <REVOCABLE>
```

#### `Fetch an existing schema`

```bash
anchor idl seed <SCHEMA_NAME>
anchor idl generate
anchor build
anchor idl verify
anchor idl decode --filepath target/idl/attestso.json --uid <SCHEMA_UID>
```
