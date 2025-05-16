# Attest StarkNet CLI

This is a command-line interface for interacting with the Attest protocol on the StarkNet blockchain.

## Features

- Create and fetch schemas
- Create, fetch, and revoke attestations
- Register and fetch attestation authorities

## Installation

```bash
npm install -g @attest/starknet-cli
```

## Usage

### Schema Operations

Create a schema:

```bash
attest-starknet schema --action=create --json-file=sample.json --keypair=<keypair>
```

Fetch a schema:

```bash
attest-starknet schema --action=fetch --uid=<schema-uid> --keypair=<keypair>
```

### Attestation Operations

Create an attestation:

```bash
attest-starknet attestation --action=create --schema-uid=<schema-uid> --json-file=<attestation-data.json> --keypair=<keypair>
```

Fetch an attestation:

```bash
attest-starknet attestation --action=fetch --uid=<attestation-uid> --keypair=<keypair>
```

Revoke an attestation:

```bash
attest-starknet attestation --action=revoke --uid=<attestation-uid> --keypair=<keypair>
```

### Authority Operations

Register an authority:

```bash
attest-starknet authority --register --keypair=<keypair> [--url=<custom-url>]
```

Fetch an authority:

```bash
attest-starknet authority --fetch --keypair=<keypair> [--url=<custom-url>]
```

## License

MIT
