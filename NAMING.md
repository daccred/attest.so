# Naming Convention

This document outlines the standardized naming conventions for structuring a multi-platform monorepo that supports various blockchain platforms, including Solana, Starknet, Cosmos, Stellar, and Aptos. These naming conventions are designed to ensure clarity, modularity, and scalability while avoiding redundancy and verbosity in file paths.

### 1. **Root Directory Structure**

The root directory structure of the monorepo organizes the different components of the project into logical sections. This includes the `apps/`, `contracts/`, `packages/`, and `examples/` directories.

- **`apps/`**: Contains front-end or application-level projects for interacting with the blockchain protocols.
- **`contracts/`**: Contains the smart contract implementations, divided by blockchain platforms.
- **`packages/`**: Contains reusable libraries, utilities, and shared logic across platforms.
- **`examples/`**: Contains example applications, integrations, and testing scenarios.

```bash
ROOT/
├── apps/
├── contracts/
├── examples/
├── packages/
├── README.md
├── pnpm-workspace.yaml
├── package.json
└── LICENSE
```

### 2. **Contracts Directory Structure**

Within the `contracts/` directory, each blockchain platform has its own subdirectory. Each platform-specific directory contains the implementations for the protocols (e.g., attestation service, resolver, and schema registry) relevant to that platform.

The general structure within each blockchain directory will include:
- **`attestation-service/`**: Handles attestation-related functionality.
- **`resolver/`**: Manages schema resolution logic.
- **`schema-registry/`**: Handles schema registration and management.

To avoid **redundant naming patterns**, **do not** repeat the platform name inside the subdirectory names. Since the blockchain platform is already defined by the parent directory, prefixing subdirectory names with the platform (e.g., `solana-attestation-service`) is unnecessary and creates redundancy.

#### Contracts Structure Example

```bash
contracts/
├── solana/
│   ├── programs/
│   │   ├── attestation-service/
│   │   ├── resolver/
│   │   └── schema-registry/
│   ├── README.md
│   ├── Cargo.toml
│   └── Anchor.toml
├── starknet/
│   ├── programs/
│   │   ├── attestation-service/
│   │   ├── resolver/
│   │   └── schema-registry/
│   ├── README.md
│   ├── Cairo.toml
│   └── starknet-config.toml
├── cosmos/
│   ├── programs/
│   │   ├── attestation-service/
│   │   ├── resolver/
│   │   └── schema-registry/
│   ├── README.md
│   └── cosmos-config.toml
```

### 3. **Naming Conventions**

#### a. **Platform-Specific Directory Names**

Each blockchain platform (e.g., Solana, Starknet, Cosmos) will have its own subdirectory inside the `contracts/` directory. The name of this subdirectory will be the platform's name in lowercase (e.g., `solana/`, `starknet/`, `cosmos/`). This ensures that the monorepo remains organized by platform.

#### b. **Protocol-Specific Directory Names**

Inside each platform-specific directory, use **concise protocol names** without repeating the platform name. The directory names should describe the protocol functionality:
- `attestation-service/`
- `resolver/`
- `schema-registry/`

This avoids redundancy. For example, instead of `solana-attestation-service/`, just use `attestation-service/` since it's already inside the `solana/` directory.

#### Example (Solana):
```bash
contracts/solana/programs/
├── attestation-service/
├── resolver/
└── schema-registry/
```

By eliminating platform prefixes inside platform-specific directories, we reduce file path verbosity and avoid redundancy.

### 4. **Packages for Shared Logic**

The `packages/` directory is used for shared logic and reusable modules across multiple platforms. These could include common logic for attestation services, resolvers, or schema registries, which can be imported into the platform-specific implementations.

Each package should be named clearly to indicate its purpose, with no reference to a specific platform (e.g., `attestation-common/`, `resolver-common/`).

#### Packages Structure Example:
```bash
packages/
├── attestation-common/
├── resolver-common/
└── schema-registry-common/
```

### 5. **Redundant Naming: Pitfall & Solution**

#### **Pitfall:**
Redundant naming patterns can occur when platform-specific prefixes (e.g., `solana-`, `starknet-`) are used in both the directory and subdirectory names. For example, having `solana/solana-attestation-service/` repeats the platform name unnecessarily, leading to longer and more verbose file paths.

#### **Solution:**
To avoid redundant naming:
- **Do not prefix subdirectories** inside platform-specific directories with the platform name. 
- **Use concise, protocol-specific names** (e.g., `attestation-service/`, `resolver/`, `schema-registry/`) inside the platform directory. The platform context is already provided by the parent folder.

#### Example of Avoiding Redundancy:
Instead of this redundant structure:
```bash
contracts/
├── solana/
│   ├── programs/
│   │   ├── solana-attestation-service/
│   │   ├── solana-resolver/
│   │   └── solana-schema-registry/
```

Use this simplified, non-redundant structure:
```bash
contracts/
├── solana/
│   ├── programs/
│   │   ├── attestation-service/
│   │   ├── resolver/
│   │   └── schema-registry/
```

### 6. **Cross-Platform Consistency**

While each blockchain platform may have unique requirements, it is important to maintain consistency across all platforms in terms of directory structure and naming conventions. This ensures that developers can quickly navigate the monorepo, regardless of the platform they are working on.

- **Use the same protocol names across platforms**: For example, always use `attestation-service/`, `resolver/`, and `schema-registry/` for those protocols, regardless of the blockchain platform.

#### Example:
```bash
contracts/
├── solana/
│   ├── programs/
│   │   ├── attestation-service/
│   │   ├── resolver/
│   │   └── schema-registry/
├── starknet/
│   ├── programs/
│   │   ├── attestation-service/
│   │   ├── resolver/
│   │   └── schema-registry/
├── cosmos/
│   ├── programs/
│   │   ├── attestation-service/
│   │   ├── resolver/
│   │   └── schema-registry/
```

### 7. **Versioning and Package Management**

For version control, ensure that changes in shared packages (inside `packages/`) are properly versioned. Use **semantic versioning** and **automated versioning tools** like **Lerna** or **changesets** to manage dependency updates across platform-specific directories and protocols.

- **Use semantic versioning**: Follow the format `major.minor.patch` for updates.
- **Selective builds**: Set up CI pipelines to handle selective builds and tests, ensuring that platform-specific updates are isolated where necessary.

### Conclusion

This naming convention is designed to reduce redundancy, enhance clarity, and ensure scalability across multiple blockchain platforms. By following these guidelines, contributors can maintain consistency, avoid verbose file paths, and create a modular, maintainable structure as the project grows.

#### Key Points:
- **Avoid platform-specific prefixes** inside platform directories to reduce redundancy.
- **Keep protocol-specific directory names concise** and consistent across platforms.
- Use the `packages/` directory for shared logic and utilities.
- Maintain version consistency and set up selective builds for platform-specific changes.

Contributors should adhere to these conventions to ensure a well-organized and scalable project structure.