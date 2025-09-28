# STRIDE Threat Model - Protocol Contract

## What are we working on?

### System Overview
The Protocol contract is the core attestation engine that handles schema registration, attestation creation/revocation, and delegated signature operations. It provides a flexible foundation for building trust systems while maintaining security, gas efficiency, and resolver integration.

### Data Flow Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Attester      │    │   Protocol       │    │   Resolver      │
│   (External)    │    │   Contract       │    │   (External)    │
│                 │    │                  │    │                 │
│ 1. Register BLS │───▶│ 2. Store Key     │    │                 │
│    Public Key   │    │                  │    │                 │
│                 │    │                  │    │                 │
│ 3. Create Schema│───▶│ 4. Store Schema  │    │                 │
│                 │    │                  │    │                 │
│ 5. Direct       │───▶│ 6. Validate      │───▶│ 7. Business     │
│    Attestation  │    │    & Store       │    │    Logic        │
│                 │    │                  │    │                 │
│ 8. Delegated    │───▶│ 9. Verify BLS    │    │                 │
│    Attestation  │    │    Signature     │    │                 │
│                 │    │                  │    │                 │
│ 10. Revoke      │───▶│ 11. Mark         │───▶│ 12. Cleanup     │
│     Attestation │    │     Revoked      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Trust Boundaries
- **High Trust**: Protocol contract (immutable core logic)
- **Medium Trust**: Resolver contracts (custom business logic)
- **Low Trust**: External attesters and submitters

### External Entities
- **Attesters**: Entities creating attestations (wallet addresses)
- **Submitters**: Entities submitting delegated attestations (wallet addresses)
- **Resolvers**: External contracts providing business logic validation
- **Schema Authorities**: Entities creating and controlling schemas

### Data Storage
- **Schema Definitions**: Immutable schema structures with authority and resolver info
- **Attestation Records**: Core attestation data with nonce-based keys
- **BLS Public Keys**: Cryptographic keys for delegated signatures
- **Nonce Counters**: Per-attester nonce tracking for replay protection

### Critical Processes
1. **Schema Registration**: Creating attestation schemas with validation rules
2. **Direct Attestation**: Creating attestations with full authorization
3. **Delegated Attestation**: Creating attestations using pre-signed requests
4. **BLS Key Management**: Registering cryptographic keys for delegation
5. **Attestation Revocation**: Controlled invalidation of attestations

## What can go wrong? (STRIDE Analysis)

### S - Spoofing Identity

| Threat | Description | Example | Impact |
|--------|-------------|---------|---------|
| **Unauthorized Attestation Creation** | Attacker creates attestations without proper authorization | Malicious actor calls `attest()` with stolen private key | False attestations created, trust system compromised |
| **BLS Key Impersonation** | Attacker registers BLS key for another's address | Attacker registers their BLS key for victim's address | Can create delegated attestations as victim |
| **Schema Authority Impersonation** | Attacker creates schemas claiming to be legitimate authority | Malicious actor creates "government-issued" schema | False authority schemas in system |
| **Resolver Impersonation** | Attacker points schema to malicious resolver | Schema points to attacker's contract instead of legitimate resolver | Business logic bypassed, unauthorized attestations |

### T - Tampering with Data

| Threat | Description | Example | Impact |
|--------|-------------|---------|---------|
| **Attestation Data Manipulation** | Attacker modifies stored attestation data | Changing attestation value or expiration after creation | False information in attestation records |
| **Nonce Manipulation** | Attacker reuses or skips nonces | Reusing nonce to replay delegated attestation | Signature replay attacks, duplicate attestations |
| **Schema Definition Tampering** | Attacker modifies schema after registration | Changing resolver address or revocation policy | Unauthorized business logic changes |
| **BLS Key Tampering** | Attacker modifies registered BLS public keys | Changing BLS key after registration | Delegated signature validation bypassed |

### R - Repudiation

| Threat | Description | Example | Impact |
|--------|-------------|---------|---------|
| **Attestation Creation Denial** | Attester denies creating attestation they signed | Attester claims they never created specific attestation | Disputes over attestation authenticity |
| **Schema Registration Denial** | Schema authority denies creating schema | Authority claims schema was created by someone else | Disputes over schema ownership |
| **Revocation Denial** | Revoker denies revoking attestation | Revoker claims revocation was unauthorized | Disputes over attestation status |
| **BLS Key Registration Denial** | Attester denies registering BLS key | Attester claims key registration was unauthorized | Disputes over delegated signature authority |

### I - Information Disclosure

| Threat | Description | Example | Impact |
|--------|-------------|---------|---------|
| **Attestation Data Exposure** | Sensitive attestation data exposed publicly | Personal information in attestation values visible to all | Privacy violations, data breaches |
| **Schema Definition Exposure** | Internal schema structures exposed | Business logic details revealed through schema definitions | Competitive intelligence, attack surface exposure |
| **Nonce Pattern Analysis** | Attestation patterns revealed through nonce analysis | Tracking attestation frequency and timing | Privacy violations, behavioral analysis |
| **BLS Key Exposure** | Public keys exposed for analysis | Cryptographic key analysis for potential attacks | Potential signature forgery attempts |

### D - Denial of Service

| Threat | Description | Example | Impact |
|--------|-------------|---------|---------|
| **Resolver DoS Attack** | Malicious resolver consumes excessive gas | Resolver reverts or consumes all available gas | Attestation operations blocked |
| **Schema Registration Spam** | Attacker creates many schemas to consume storage | Creating thousands of schemas with minimal data | Storage exhaustion, gas cost increases |
| **Nonce Exhaustion** | Attacker exhausts nonce space for attester | Creating maximum possible nonces for an attester | Prevents future attestations from that attester |
| **BLS Key Registration Spam** | Attacker registers many BLS keys | Registering keys for many addresses to consume storage | Storage exhaustion, system resource depletion |

### E - Elevation of Privilege

| Threat | Description | Example | Impact |
|--------|-------------|---------|---------|
| **Unauthorized Schema Control** | Attacker gains control over schema they didn't create | Modifying schema resolver or revocation policy | Unauthorized business logic changes |
| **Resolver Bypass** | Attacker circumvents resolver validation | Creating attestations without proper resolver checks | Unauthorized attestations created |
| **Admin Privilege Escalation** | Attacker gains admin access to protocol | Unauthorized access to admin functions | Full system compromise |
| **Nonce Authority Bypass** | Attacker controls nonce generation | Manipulating nonce counters to bypass replay protection | Signature replay attacks possible |

## What are we going to do about it?

### S - Spoofing Identity Mitigations

| Threat | Mitigation | Implementation |
|--------|------------|----------------|
| **Unauthorized Attestation Creation** | Strict authorization validation | Require `require_auth()` for all attestation operations |
| **BLS Key Impersonation** | One-time key registration with authorization | Only allow attester to register their own BLS key |
| **Schema Authority Impersonation** | Content-based schema UIDs | Schema UID derived from content, not creator identity |
| **Resolver Impersonation** | Schema authority controls resolver | Only schema authority can set resolver address |

### T - Tampering with Data Mitigations

| Threat | Mitigation | Implementation |
|--------|------------|----------------|
| **Attestation Data Manipulation** | Immutable attestation storage | Once stored, attestation data cannot be modified |
| **Nonce Manipulation** | Protocol-managed nonce incrementation | Contract controls nonce generation and validation |
| **Schema Definition Tampering** | Immutable schema storage | Schemas cannot be modified after registration |
| **BLS Key Tampering** | Immutable key storage | BLS keys cannot be changed after registration |

### R - Repudiation Mitigations

| Threat | Mitigation | Implementation |
|--------|------------|----------------|
| **Attestation Creation Denial** | Cryptographic signature verification | BLS signatures provide cryptographic proof of creation |
| **Schema Registration Denial** | Event logging with timestamps | All schema registrations logged with creator and timestamp |
| **Revocation Denial** | Event logging with revoker identity | All revocations logged with revoker and timestamp |
| **BLS Key Registration Denial** | Event logging with attester identity | All key registrations logged with attester and timestamp |

### I - Information Disclosure Mitigations

| Threat | Mitigation | Implementation |
|--------|------------|----------------|
| **Attestation Data Exposure** | Encryption for sensitive data | Encourage encryption of sensitive attestation values |
| **Schema Definition Exposure** | Public schema registry | Schemas are public by design for transparency |
| **Nonce Pattern Analysis** | Nonce privacy considerations | Nonces are public but don't reveal sensitive patterns |
| **BLS Key Exposure** | Public key cryptography | BLS public keys are meant to be public |

### D - Denial of Service Mitigations

| Threat | Mitigation | Implementation |
|--------|------------|----------------|
| **Resolver DoS Attack** | Gas limits on resolver calls | Implement gas bounds for resolver operations |
| **Schema Registration Spam** | Economic barriers | Require payment or stake for schema registration |
| **Nonce Exhaustion** | Large nonce space | Use u64 for nonces (18 quintillion possible values) |
| **BLS Key Registration Spam** | Economic barriers | Require payment or stake for BLS key registration |

### E - Elevation of Privilege Mitigations

| Threat | Mitigation | Implementation |
|--------|------------|----------------|
| **Unauthorized Schema Control** | Immutable schema authority | Schema authority cannot be changed after creation |
| **Resolver Bypass** | Mandatory resolver validation | Protocol enforces resolver calls in critical path |
| **Admin Privilege Escalation** | Strong access control | Admin functions require explicit authorization |
| **Nonce Authority Bypass** | Contract-controlled nonce management | Only contract can modify nonce counters |

## Did we do a good job?

### Data Flow Diagram Usage
✅ **Yes** - The data flow diagram clearly shows all external entities, processes, and data flows. It identifies trust boundaries and critical integration points with resolvers.

### STRIDE Model Coverage
✅ **Yes** - Each STRIDE category has been thoroughly analyzed with specific threats, examples, and impacts relevant to the protocol contract.

### Threat Treatments
✅ **Yes** - Each identified threat has a specific mitigation strategy with implementation details. The mitigations address the root causes of the threats.

### Additional Issues Found
✅ **Yes** - The analysis revealed several important security considerations:
- **Resolver Integration Security**: The protocol's dependency on external resolvers creates significant attack surface
- **BLS Signature Security**: The delegated attestation system relies heavily on BLS signature verification
- **Nonce Management**: The nonce system is critical for preventing replay attacks
- **Schema Authority Model**: The immutable schema authority model has both benefits and risks

### Living Document
✅ **Yes** - This threat model should be updated when:
- New functionality is added to the protocol
- Resolver interface changes
- New attack vectors are discovered
- Security best practices evolve

### Areas Requiring Ongoing Attention
1. **Resolver Security**: Monitor resolver implementations for security issues
2. **BLS Implementation**: Ensure BLS signature verification is cryptographically sound
3. **Gas Optimization**: Balance security with gas efficiency
4. **Schema Governance**: Consider mechanisms for schema authority management
5. **Event Monitoring**: Implement comprehensive monitoring for all security events

### Integration with Development Process
This threat model should be:
- Reviewed before any protocol changes
- Updated when new features are added
- Referenced during code reviews
- Used to guide security testing priorities
- Shared with resolver developers for integration security
