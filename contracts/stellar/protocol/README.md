# Protocol Contract - Core Attestation Engine

## Overview

The Protocol contract is the core attestation engine that handles schema registration, attestation creation/revocation, and delegated signature operations. It provides a flexible foundation for building trust systems while maintaining security, gas efficiency, and resolver integration.

## Architecture Philosophy

### Core Design Principles

1. **Immutable Core Logic**: Protocol contract provides stable, immutable attestation primitives
2. **Extensible Business Logic**: Complex logic delegated to resolver contracts
3. **Multi-Attestation Support**: Nonce-based system allows multiple attestations per schema/subject pair
4. **Cryptographic Delegation**: BLS signatures enable off-chain signing with on-chain submission
5. **Schema-Driven Validation**: Structured attestation data following predefined schemas
6. **Gas Optimization**: Efficient storage patterns and minimal on-chain computation

### Why This Architecture

**Problem**: Attestation systems need to balance flexibility, security, and efficiency:
- Hard-coded business logic limits use cases
- Multiple attestations per subject are often needed
- Gas costs can make frequent attestations prohibitive
- Trust assumptions must be minimized

**Solution**: Layered architecture provides:
- Core immutable primitives for trust
- Pluggable business logic through resolvers
- Nonce-based multi-attestation support
- Delegated signatures for gas efficiency
- Schema validation for data integrity

## Core Data Structures

### Attestation

```rust
pub struct Attestation {
    pub schema_uid: BytesN<32>,      // Schema this follows
    pub subject: Address,            // Who this is about
    pub attester: Address,           // Who created this
    pub value: String,               // Attestation data
    pub nonce: u64,                  // Unique per attester
    pub timestamp: u64,              // Creation time
    pub expiration_time: Option<u64>, // Optional expiry
    pub revoked: bool,               // Revocation status
    pub revocation_time: Option<u64>, // Revocation timestamp
}
```

**Design Rationale**:
- **Nonce-based Identity**: `(schema_uid, subject, nonce)` creates unique attestation identity
- **Immutable Core Data**: Once created, core fields cannot be changed
- **Optional Expiration**: Allows time-bounded attestations
- **Explicit Revocation**: Clear revocation status and timestamp

**Security Implications**:
- Nonce prevents replay attacks in delegated attestations
- Immutable fields prevent post-creation manipulation
- Explicit revocation prevents ambiguity about attestation status

### Schema

```rust
pub struct Schema {
    pub authority: Address,          // Who created this schema
    pub definition: String,          // Schema definition (JSON/XDR)
    pub resolver: Option<Address>,   // Validation contract
    pub revocable: bool,            // Can attestations be revoked
}
```

**Design Rationale**:
- **Authority-Owned**: Each schema belongs to a specific authority
- **Flexible Definition**: Supports multiple data formats (JSON, XDR)
- **Optional Resolver**: Business logic can be attached or omitted
- **Revocation Policy**: Set at schema level for consistency

**Security Implications**:
- Authority controls schema behavior
- Resolver integration point for business logic validation
- Revocation policy prevents unauthorized revocations

### DelegatedAttestationRequest

```rust
pub struct DelegatedAttestationRequest {
    pub schema_uid: BytesN<32>,
    pub subject: Address,
    pub attester: Address,           // Original signer
    pub value: String,
    pub nonce: u64,                  // Anti-replay protection
    pub deadline: u64,               // Request expiration
    pub expiration_time: Option<u64>,
    pub signature: BytesN<96>,       // BLS12-381 signature
}
```

**Design Rationale**:
- **Cryptographic Delegation**: BLS signatures enable trustless delegation
- **Nonce Protection**: Prevents signature replay attacks
- **Deadline Protection**: Limits signature validity window
- **Gas Cost Shifting**: Submitter pays gas, not original attester

**Security Implications**:
- Strong cryptographic guarantees through BLS signatures
- Multiple layers of replay protection (nonce + deadline)
- Signature verification prevents unauthorized submissions

## Core Functionality

### Schema Management

#### `register(caller, schema_definition, resolver, revocable)`

**Purpose**: Creates a new attestation schema with optional resolver integration.

**Access Control**: Any authorized address can create schemas (no restrictions).

**Critical Security Function**: This defines the structure and validation rules for attestations.

**Parameters**:
- `caller`: Address creating the schema (becomes schema authority)
- `schema_definition`: Schema structure (JSON/XDR format)
- `resolver`: Optional contract address for business logic validation
- `revocable`: Whether attestations using this schema can be revoked

**Process Flow**:
1. Validate caller authorization
2. Generate unique schema UID (deterministic hash)
3. Store schema with caller as authority
4. Emit schema creation event

**Design Considerations**:
- **Deterministic UIDs**: Schema content determines UID (prevents duplicates)
- **Immutable After Creation**: Schema cannot be modified after registration
- **Authority Model**: Creator becomes permanent authority for the schema

**Security Implications**:
- No restrictions on schema creation (anyone can create schemas)
- Schema authority has permanent control over resolver and revocation policy
- Malicious schemas can only affect attestations that explicitly use them

**Attack Vectors & Mitigations**:
- **Schema Squatting**: Attackers creating popular schema names first
  - *Mitigation*: Content-based UIDs prevent namespace conflicts
- **Malicious Resolvers**: Schemas pointing to malicious resolver contracts
  - *Mitigation*: Attestors choose which schemas to use; resolver behavior is explicit

### Direct Attestation

#### `attest(attester, schema_uid, subject, value, expiration_time)`

**Purpose**: Creates an attestation directly from the attester.

**Access Control**: Requires authorization from the attester address.

**Critical Security Function**: Core attestation creation with full validation chain.

**Process Flow**:
1. Verify attester authorization
2. Validate schema exists
3. Generate next nonce for attester
4. **Call resolver validation** (if schema has resolver)
5. Store attestation with nonce-based key
6. Increment attester nonce
7. **Call resolver post-processing** (if schema has resolver)
8. Emit attestation event

**Resolver Integration**:
```rust
// Step 4: Pre-validation
if let Some(resolver_addr) = schema.resolver {
    let validation_result = resolver.before_attest(env, attestation_data);
    if !validation_result? {
        return Err(Error::ResolverRejected);
    }
}

// Step 7: Post-processing
if let Some(resolver_addr) = schema.resolver {
    let _ = resolver.after_attest(env, attestation_data);
    // Note: after_attest failures don't revert the attestation
}
```

**Nonce Management**:
- Each attester has an independent nonce counter
- Nonce increments with each attestation
- Creates unique identity: `(schema_uid, subject, nonce)`
- Enables multiple attestations for same schema/subject pair

**Design Considerations**:
- **Atomic Operations**: Either entire attestation succeeds or fails
- **Resolver Isolation**: `before_attest` failures abort, `after_attest` failures don't
- **Gas Optimization**: Early validation prevents unnecessary state changes
- **Event Emission**: Standard events for indexing and monitoring

**Security Implications**:
- Attester authorization prevents unauthorized attestation creation
- Resolver validation provides customizable access control
- Nonce system prevents conflicts and enables tracking
- Atomic operations maintain state consistency

**Attack Vectors & Mitigations**:
- **Unauthorized Attestations**: Creating attestations without permission
  - *Mitigation*: Strict authorization requirements + resolver validation
- **Nonce Manipulation**: Attempting to reuse or skip nonces
  - *Mitigation*: Protocol-managed nonce incrementation
- **Resolver DoS**: Malicious resolvers consuming excessive gas
  - *Mitigation*: Gas limits on resolver calls (implementation dependent)
- **Schema Squatting**: Using popular schema UIDs maliciously
  - *Mitigation*: Schema content determines UID; users verify schema legitimacy

### Delegated Attestation

#### `attest_by_delegation(submitter, request)`

**Purpose**: Creates an attestation using a pre-signed request, enabling gas-less attestations.

**Access Control**: 
- Requires authorization from submitter (who pays gas)
- Validates BLS signature from original attester

**Critical Security Function**: Enables cryptographic delegation while maintaining security guarantees.

**Process Flow**:
1. Verify submitter authorization (gas payer)
2. Validate request deadline hasn't passed
3. **Verify BLS signature against attester's registered public key**
4. Check nonce matches expected value for attester
5. Create attestation with original attester as creator
6. Follow same resolver validation as direct attestation
7. Increment attester nonce to prevent replay

**BLS Signature Verification**:
```rust
// Critical security step
let attester_bls_key = get_bls_public_key(env, &request.attester)
    .ok_or(Error::BlsKeyNotRegistered)?;

let message_hash = create_attestation_message_hash(&request);
let verification_result = env.crypto().bls12_381_verify(
    &request.signature,
    &attester_bls_key.key,
    &message_hash
);

if !verification_result {
    return Err(Error::InvalidSignature);
}
```

**Nonce Validation**:
```rust
// Anti-replay protection
let expected_nonce = get_next_nonce(env, &request.attester);
if request.nonce != expected_nonce {
    return Err(Error::InvalidNonce);
}
```

**Design Considerations**:
- **Gas Cost Separation**: Submitter pays transaction costs, attester creates content
- **Strong Cryptography**: BLS12-381 provides quantum-resistant signatures
- **Replay Protection**: Multiple layers (nonce + deadline + signature uniqueness)
- **Deadline Enforcement**: Prevents indefinite signature validity
- **Identical Processing**: Delegated attestations follow same validation as direct

**Security Implications**:
- BLS signature verification ensures only the attester could have created the request
- Nonce verification prevents replay attacks across all contexts
- Deadline verification prevents stale signature usage
- Submitter separation prevents attester from being charged gas

**Attack Vectors & Mitigations**:
- **Signature Replay**: Reusing signatures across different contexts
  - *Mitigation*: Nonce-based replay protection + domain separation in message hash
- **Signature Forgery**: Creating signatures without private key
  - *Mitigation*: Cryptographically secure BLS signature verification
- **Nonce Racing**: Multiple parties submitting same signed request
  - *Mitigation*: First submission wins; subsequent attempts fail nonce check
- **Deadline Bypass**: Using expired signatures
  - *Mitigation*: Strict deadline validation before processing
- **Key Substitution**: Using different BLS key than registered
  - *Mitigation*: Signature verification against registered key only

### BLS Key Management

#### `register_bls_key(attester, public_key)`

**Purpose**: Registers a BLS12-381 public key for an attester to enable delegated signatures.

**Access Control**: Requires authorization from the attester address.

**Critical Security Function**: Links wallet addresses to cryptographic keys for delegation.

**Design Considerations**:
- **One-Time Registration**: Each address can register exactly one BLS key
- **Immutable After Registration**: Keys cannot be updated or revoked
- **Cryptographic Binding**: Creates permanent link between wallet and BLS key

**Security Implications**:
- Private key compromise requires new wallet address (cannot update key)
- No key revocation mechanism (intentional design choice)
- Registration timing is public (timestamp recorded)

**Attack Vectors & Mitigations**:
- **Key Reuse**: Using same BLS key for multiple wallet addresses
  - *Mitigation*: No technical prevention; privacy concern only
- **Unauthorized Registration**: Registering key for someone else's address
  - *Mitigation*: Strict authorization requirements
- **Key Compromise**: BLS private key theft
  - *Mitigation*: No on-chain mitigation; requires new wallet address

### Revocation System

#### `revoke_attestation(revoker, schema_uid, subject, nonce)`

**Purpose**: Revokes a specific attestation if permitted by schema and attester policies.

**Access Control**: 
- Requires authorization from revoker
- Validates schema allows revocation
- Validates revoker has permission (typically original attester)

**Critical Security Function**: Controlled invalidation of attestations.

**Process Flow**:
1. Verify revoker authorization
2. Validate attestation exists and is not already revoked
3. Check schema allows revocation
4. **Call resolver revocation validation** (if schema has resolver)
5. Mark attestation as revoked with timestamp
6. **Call resolver post-revocation processing** (if schema has resolver)
7. Emit revocation event

**Design Considerations**:
- **Schema-Level Policy**: Revocation allowed/disallowed at schema level
- **Resolver Validation**: Custom revocation rules through resolvers
- **Permanent Revocation**: Once revoked, cannot be un-revoked
- **Timestamp Recording**: Exact revocation time recorded

**Security Implications**:
- Only authorized parties can revoke attestations
- Revocation is permanent and auditable
- Schema policy prevents unauthorized revocation categories
- Resolver validation enables custom authorization logic

## Resolver Integration

### Integration Points

The protocol integrates with resolvers at four critical points:

1. **Before Attestation** (`before_attest`): Access control and validation
2. **After Attestation** (`after_attest`): Side effects and rewards
3. **Before Revocation** (`before_revoke`): Revocation authorization
4. **After Revocation** (`after_revoke`): Cleanup and penalties

### Security Boundaries

**Critical Path**: `before_*` functions control whether operations proceed
**Non-Critical Path**: `after_*` functions handle side effects

**Failure Handling**:
- `before_*` failures abort the entire operation
- `after_*` failures are logged but don't affect core operation
- Protocol must be resilient to resolver failures

### Gas Considerations

**Resolver Gas Limits**: Each resolver call should be bounded to prevent DoS
**Gas Optimization**: Resolvers should be efficient for frequent operations
**Fallback Mechanisms**: Protocol should handle resolver out-of-gas conditions

## Storage Architecture

### Key Structure

```rust
pub enum DataKey {
    Admin,                                    // Contract admin
    Schema(BytesN<32>),                      // Schema definitions
    Attestation(BytesN<32>, Address, u64),   // (schema, subject, nonce)
    AttesterNonce(Address),                  // Per-attester nonce counters
    AttesterPublicKey(Address),              // BLS public keys
}
```

**Design Rationale**:
- **Hierarchical Keys**: Natural data organization
- **Composite Attestation Keys**: Enables efficient querying
- **Separate Nonce Tracking**: Prevents nonce conflicts
- **Address-Based BLS Keys**: One key per address

### Storage Patterns

**Persistent Storage**: All attestation data (long-term retention)
**Instance Storage**: Contract configuration (admin, etc.)
**TTL Management**: Automatic cleanup for expired data

**Gas Optimization**:
- Efficient key structures for common queries
- Minimal storage writes per operation
- Batched operations where possible

## Security Model

### Trust Assumptions

**Protocol Contract**: Fully trusted (immutable core logic)
**Resolver Contracts**: Partially trusted (custom business logic)
**Schema Authorities**: Trusted for their schemas only
**Attesters**: Trusted for their own attestations only

### Attack Surface Analysis

#### Core Protocol Attacks

**Nonce Manipulation**:
- **Attack**: Attempting to reuse, skip, or manipulate nonces
- **Mitigation**: Protocol-managed nonce incrementation
- **Detection**: Nonce validation on all operations

**Signature Attacks**:
- **Attack**: Signature replay, forgery, or substitution
- **Mitigation**: Strong BLS verification + nonce protection
- **Detection**: Cryptographic signature validation

**State Consistency Attacks**:
- **Attack**: Creating inconsistent attestation states
- **Mitigation**: Atomic operations with proper error handling
- **Detection**: State validation on all reads

#### Resolver Integration Attacks

**Malicious Resolver DoS**:
- **Attack**: Resolver consuming excessive gas or reverting
- **Mitigation**: Gas limits and graceful failure handling
- **Detection**: Gas usage monitoring

**Resolver Authorization Bypass**:
- **Attack**: Circumventing resolver access controls
- **Mitigation**: Mandatory resolver validation in critical path
- **Detection**: Resolver call verification

#### Economic Attacks

**Gas Griefing**:
- **Attack**: Creating expensive operations to drain funds
- **Mitigation**: Gas-efficient code and limits
- **Detection**: Gas usage monitoring

**Schema Squatting**:
- **Attack**: Creating malicious schemas with popular names
- **Mitigation**: Content-based UIDs and user verification
- **Detection**: Schema content analysis

### Access Control Matrix

| Operation | Authorization Required | Additional Validation |
|-----------|----------------------|---------------------|
| Schema Registration | Caller auth | None |
| Direct Attestation | Attester auth | Resolver validation |
| Delegated Attestation | Submitter auth | BLS signature + nonce |
| BLS Key Registration | Attester auth | One-time only |
| Revocation | Revoker auth | Schema policy + resolver |

## Error Handling

### Error Categories

```rust
pub enum Error {
    // Authorization errors
    NotAuthorized,
    
    // Schema errors
    SchemaNotFound,
    SchemaAlreadyExists,
    
    // Attestation errors
    AttestationNotFound,
    AttestationAlreadyRevoked,
    InvalidNonce,
    InvalidDeadline,
    
    // Cryptographic errors
    InvalidSignature,
    BlsKeyNotRegistered,
    BlsKeyAlreadyRegistered,
    
    // Resolver errors
    ResolverRejected,
    ResolverCallFailed,
}
```

**Error Handling Strategy**:
- **Fail Fast**: Invalid operations abort immediately
- **Clear Error Messages**: Specific error codes for debugging
- **Graceful Degradation**: Non-critical failures don't abort operations
- **Event Logging**: All errors logged for monitoring

## Gas Optimization

### Storage Efficiency

**Minimal State**: Only essential data stored on-chain
**Efficient Keys**: Optimized key structures for common operations
**TTL Management**: Automatic cleanup of expired data

### Computation Efficiency

**Early Validation**: Cheap validations before expensive operations
**Batch Operations**: Multiple operations in single transaction where possible
**Resolver Limits**: Gas bounds on resolver calls

### User Experience

**Predictable Costs**: Consistent gas usage for similar operations
**Fee Delegation**: Submitter model for gas-less user experience
**Batch Support**: Efficient multi-attestation creation

## Monitoring and Events

### Event Structure

```rust
pub struct AttestationEvent {
    pub schema_uid: BytesN<32>,
    pub subject: Address,
    pub attester: Address,
    pub nonce: u64,
    pub timestamp: u64,
}
```

**Event Strategy**:
- **Complete Data**: All necessary information in events
- **Efficient Indexing**: Structured data for easy querying
- **Real-time Monitoring**: Events enable live system monitoring
- **Audit Trail**: Complete history of all operations

### Monitoring Metrics

**Performance Metrics**:
- Gas usage per operation type
- Transaction success/failure rates
- Resolver call performance

**Security Metrics**:
- Failed authorization attempts
- Invalid signature attempts
- Unusual nonce patterns

**Business Metrics**:
- Attestation creation rates
- Schema usage patterns
- Resolver adoption rates

## Future Considerations

### Scalability Improvements

**Batch Operations**: Native support for multiple attestations
**Layer 2 Integration**: Off-chain processing with on-chain finality
**Sharding**: Horizontal scaling for high-volume use cases

### Feature Enhancements

**Attestation Updates**: Allowing attestation modifications (with versioning)
**Multi-Signature**: Group attestations requiring multiple signatures
**Conditional Logic**: More complex validation rules in core protocol

### Security Enhancements

**Formal Verification**: Mathematical proof of critical security properties
**Upgrade Mechanisms**: Secure upgrade paths for protocol improvements
**Emergency Controls**: Circuit breakers for critical vulnerabilities

## Conclusion

The Protocol contract provides a robust, secure foundation for attestation systems with careful attention to security boundaries, gas efficiency, and extensibility. The resolver integration pattern enables complex business logic while maintaining core protocol simplicity and security.

**For Q/A Review Focus Areas**:
1. **Nonce-based replay protection** in delegated attestations
2. **BLS signature verification** implementation and message construction
3. **Resolver integration security** boundaries and failure handling
4. **Access control validation** across all operations
5. **State consistency** under concurrent operations and failure conditions
6. **Gas exhaustion protection** in resolver calls
7. **Schema authority model** and trust assumptions
8. **Storage key security** and potential collision attacks