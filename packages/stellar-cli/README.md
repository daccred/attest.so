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
attest-stellar schema --action=create --json-file=sample.json --signer-key=<signer-key>
```

Fetch a schema:

```bash
attest-stellar schema --action=fetch --uid=<schema-uid> --signer-key=<signer-key>
```

### Attestation Operations

Create an attestation:

```bash
attest-stellar attestation --action=create --schema-uid=<schema-uid> --json-file=<attestation-data.json> --signer-key=<signer-key>
```

Fetch an attestation:

```bash
attest-stellar attestation --action=fetch --uid=<attestation-uid> --signer-key=<signer-key>
```

Revoke an attestation:

```bash
attest-stellar attestation --action=revoke --uid=<attestation-uid> --signer-key=<signer-key>
```

### Authority Operations

Register an authority:

```bash
attest-stellar authority --register --signer-key=<signer-key> [--url=<custom-url>]
```

Fetch an authority:

```bash
attest-stellar authority --fetch --signer-key=<signer-key> [--url=<custom-url>]
```

## License

MIT
