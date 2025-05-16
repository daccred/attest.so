# Attest Solana CLI

This is a command-line interface for interacting with the Attest protocol on the Solana blockchain.

## Features

- Create and fetch schemas
- Create, fetch, and revoke attestations
- Register and fetch attestation authorities

## Installation

```bash
npm install -g @attest/solana-cli
```

## Usage

### Schema Operations

Create a schema:

```bash
attest-solana schema --action=create --json-file=sample.json --keypair=<keypair>
```

Fetch a schema:

```bash
attest-solana schema --action=fetch --uid=<schema-uid> --keypair=<keypair>
```

### Attestation Operations

Create an attestation:

```bash
attest-solana attestation --action=create --schema-uid=<schema-uid> --json-file=<attestation-data.json> --keypair=<keypair>
```

Fetch an attestation:

```bash
attest-solana attestation --action=fetch --uid=<attestation-uid> --keypair=<keypair>
```

Revoke an attestation:

```bash
attest-solana attestation --action=revoke --uid=<attestation-uid> --keypair=<keypair>
```

### Authority Operations

Register an authority:

```bash
attest-solana authority --register --keypair=<keypair> [--url=<custom-url>]
```

Fetch an authority:

```bash
attest-solana authority --fetch --keypair=<keypair> [--url=<custom-url>]
```

## License

MIT
