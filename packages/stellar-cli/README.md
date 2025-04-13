# Attest Stellar CLI

This is a command-line interface for interacting with the Attest protocol on the Stellar blockchain.

## Features

- Create and fetch schemas
- Create, fetch, and revoke attestations
- Register and fetch attestation authorities

## Installation

```bash
npm install -g @attestprotocol/stellar-cli
```

## Usage

### Schema Operations

Create a schema:
```bash
attest-stellar schema --action=create --json-file=sample.json --keypair=<keypair>
```

Fetch a schema:
```bash
attest-stellar schema --action=fetch --uid=<schema-uid> --keypair=<keypair>
```

### Attestation Operations

Create an attestation:
```bash
attest-stellar attestation --action=create --schema-uid=<schema-uid> --json-file=<attestation-data.json> --keypair=<keypair>
```

Fetch an attestation:
```bash
attest-stellar attestation --action=fetch --uid=<attestation-uid> --keypair=<keypair>
```

Revoke an attestation:
```bash
attest-stellar attestation --action=revoke --uid=<attestation-uid> --keypair=<keypair>
```

### Authority Operations

Register an authority:
```bash
attest-stellar authority --register --keypair=<keypair> [--url=<custom-url>]
```

Fetch an authority:
```bash
attest-stellar authority --fetch --keypair=<keypair> [--url=<custom-url>]
```

## License

MIT
