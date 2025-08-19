# Resolvers Contract System

## Overview

The Resolvers contract system provides a standardized interface for implementing custom attestation validation and processing logic. This modular architecture allows the core protocol to remain simple while enabling complex economic models, access controls, and business logic through pluggable resolver contracts.

## Architecture Philosophy

### Core Design Principles

1. **Separation of Concerns**: Core protocol handles attestation storage/retrieval, resolvers handle business logic
2. **Pluggable Economics**: Different resolvers can implement different economic models without protocol changes
3. **Standardized Interface**: All resolvers implement the same interface for consistent protocol integration
4. **Security by Design**: Resolvers validate before allowing operations, not after
5. **Minimal Trust**: Protocol doesn't need to trust resolver implementations beyond interface compliance

### Why Resolvers Exist

**Problem**: Hard-coding business logic into the core protocol creates:
- Inflexibility for different use cases
- Upgrade complexity
- Single points of failure
- Mixing of concerns

**Solution**: Resolver pattern provides:
- Modular business logic
- Customizable economic models
- Isolated failure domains
- Clear upgrade paths

## Interface Design

### Current Hook Pattern

```rust
pub trait ResolverInterface {
    fn before_attest(env: Env, attestation: Attestation) -> Result<bool, ResolverError>;
    fn after_attest(env: Env, attestation: Attestation) -> Result<(), ResolverError>;
    fn before_revoke(env: Env, attestation_uid: BytesN<32>, attester: Address) -> Result<bool, ResolverError>;
    fn after_revoke(env: Env, attestation_uid: BytesN<32>, attester: Address) -> Result<(), ResolverError>;
    fn get_metadata(env: Env) -> ResolverMetadata;
}
```

### Design Rationale: Before/After Hooks

**Why Split Operations?**
1. **Validation vs Side Effects**: `before_*` validates, `after_*` processes
2. **Gas Optimization**: Protocol can abort early if validation fails
3. **State Consistency**: Protocol updates core state between hooks
4. **Error Isolation**: Validation errors don't affect post-processing

**Security Implications:**
- `before_*` functions are **CRITICAL** - they control access
- `after_*` functions are **NON-CRITICAL** - they handle side effects
- Protocol MUST NOT proceed if `before_*` returns false/error
- `after_*` failures should NOT revert the attestation

### Future Consideration: Single Hook Pattern

```rust
// Potential future interface
pub trait ResolverInterface {
    fn on_attest(env: Env, attestation: Attestation) -> Result<(), ResolverError>;
    fn on_revoke(env: Env, attestation_uid: BytesN<32>, attester: Address) -> Result<(), ResolverError>;
}
```

**Benefits**: Simpler implementation, eliminates side effects complexity
**Trade-offs**: Less granular control, harder to optimize gas usage

## Function Documentation

### `before_attest`

```rust
fn before_attest(env: Env, attestation: Attestation) -> Result<bool, ResolverError>
```

**Purpose**: Validates whether an attestation should be allowed to proceed.

**Critical Security Function**: This is the primary access control mechanism for attestations.

**Parameters**:
- `env`: Soroban environment for storage/crypto operations
- `attestation`: Complete attestation data for validation

**Return Values**:
- `Ok(true)`: Attestation should proceed
- `Ok(false)`: Attestation should be rejected (non-error rejection)
- `Err(ResolverError)`: Validation failed with specific error

**Design Considerations**:
- **MUST** validate all required conditions before returning true
- **SHOULD** return specific error codes for different failure modes
- **MUST NOT** have side effects that affect state
- **SHOULD** be gas-efficient as it's called for every attestation

**Common Implementations**:
- Payment validation (authority resolver)
- Stake requirements (staking resolver)
- Permission checks (access control resolver)
- Rate limiting (spam prevention resolver)

**Security Implications**:
- This function controls who can create attestations
- Bugs here can lead to unauthorized attestations
- Should validate ALL required conditions
- Must not rely on external state that can be manipulated

### `after_attest`

```rust
fn after_attest(env: Env, attestation: Attestation) -> Result<(), ResolverError>
```

**Purpose**: Processes side effects after an attestation has been successfully created.

**Non-Critical Function**: Failures here should not revert the attestation.

**Parameters**:
- `env`: Soroban environment
- `attestation`: The attestation that was just created (includes UID)

**Return Values**:
- `Ok(())`: Processing completed successfully
- `Err(ResolverError)`: Processing failed (should not revert attestation)

**Design Considerations**:
- **SHOULD** handle failures gracefully
- **MAY** emit events for external monitoring
- **MAY** distribute rewards/penalties
- **SHOULD** update resolver-specific state
- **MUST NOT** affect the core attestation state

**Common Implementations**:
- Token reward distribution
- Registry updates (authority resolver)
- Notification triggers
- Metrics collection

**Security Implications**:
- Failures should not affect core attestation
- Should validate state before making changes
- Token transfers must handle failures gracefully

### `before_revoke`

```rust
fn before_revoke(env: Env, attestation_uid: BytesN<32>, attester: Address) -> Result<bool, ResolverError>
```

**Purpose**: Validates whether an attestation revocation should be allowed.

**Critical Security Function**: Controls who can revoke attestations.

**Parameters**:
- `env`: Soroban environment
- `attestation_uid`: Unique identifier of attestation to revoke
- `attester`: Address attempting to revoke the attestation

**Return Values**:
- `Ok(true)`: Revocation should proceed
- `Ok(false)`: Revocation should be rejected
- `Err(ResolverError)`: Validation failed

**Design Considerations**:
- **MUST** verify attester has permission to revoke
- **SHOULD** check if attestation exists and is revocable
- **MAY** implement time-based restrictions
- **SHOULD** be consistent with original attestation rules

**Common Implementations**:
- Original attester verification
- Admin override permissions
- Time-lock restrictions
- Multi-signature requirements

**Security Implications**:
- Controls who can undo attestations
- Should prevent unauthorized revocations
- May need to handle edge cases (expired attestations, etc.)

### `after_revoke`

```rust
fn after_revoke(env: Env, attestation_uid: BytesN<32>, attester: Address) -> Result<(), ResolverError>
```

**Purpose**: Processes cleanup after successful revocation.

**Non-Critical Function**: Similar to `after_attest`, failures should not affect revocation.

**Design Considerations**:
- **SHOULD** clean up resolver-specific state
- **MAY** process refunds or penalties
- **SHOULD** emit revocation events
- **MUST** handle cases where original attestation data is no longer available

### `get_metadata`

```rust
fn get_metadata(env: Env) -> ResolverMetadata
```

**Purpose**: Returns static information about the resolver.

**Information Function**: Used for discovery and compatibility checking.

**Returns**: ResolverMetadata struct containing:
- `name`: Human-readable resolver name
- `version`: Semantic version string
- `description`: Detailed description of resolver functionality
- `resolver_type`: Enum categorizing the resolver type

**Design Considerations**:
- **SHOULD** be static (not depend on storage state)
- **MUST** be gas-efficient (called frequently)
- **SHOULD** include version for compatibility tracking

## Resolver Templates

### DefaultResolver

**Purpose**: Minimal resolver that allows all operations.

**Use Cases**:
- Development/testing
- Schemas that don't need restrictions
- Base implementation for custom resolvers

**Security Note**: Provides no access control - suitable only for unrestricted schemas.

### TokenRewardResolver

**Purpose**: Distributes token rewards for attestations.

**Economic Model**: Incentivize attestation creation through token distribution.

**Key Features**:
- Configurable reward amounts
- Token distribution on attestation
- Reward pool management

**Security Considerations**:
- Token contract integration risks
- Reward pool depletion handling
- Sybil attack prevention

### FeeCollectionResolver

**Purpose**: Collects fees for attestation operations.

**Economic Model**: Monetize attestation creation through fee collection.

**Key Features**:
- Configurable fee amounts
- Fee collection on attestation
- Admin fee withdrawal

**Security Considerations**:
- Fee payment validation
- Reentrancy protection
- Admin privilege management

### AuthorityResolver (Reference Implementation)

**Purpose**: Payment-gated access control for authority attestations.

**Business Model**: Organizations pay 100 XLM for attestation rights.

**Key Features**:
- Payment validation before attestation
- Payment ledger tracking
- Phone book registration after attestation

**Detailed documentation**: See `/authority/README.md`

## Security Considerations

### Access Control

**Resolver Admin Privileges**:
- Fee/reward amount updates
- Parameter configuration
- Emergency functions

**Risk**: Admin compromise can affect all resolver operations
**Mitigation**: Multi-signature admin accounts, timelock contracts

### Economic Attacks

**Fee/Reward Manipulation**:
- Admins changing fees to extract value
- Reward pool draining attacks
- Economic griefing through high fees

**Mitigation Strategies**:
- Fee/reward bounds checking
- Gradual parameter changes
- Community governance for major changes

### Integration Risks

**Malicious Resolvers**:
- Resolvers that always return false (DoS)
- Resolvers that consume excessive gas
- Resolvers that revert unexpectedly

**Protocol Protections**:
- Gas limits on resolver calls
- Fallback mechanisms for resolver failures
- Resolver allow-lists for critical schemas

### State Consistency

**Cross-Contract State**:
- Resolver state must stay consistent with protocol state
- Failed `after_*` operations should not affect core state
- Race conditions between protocol and resolver updates

**Design Solutions**:
- Clear separation of critical vs non-critical operations
- Idempotent operations where possible
- Event-based state synchronization

## Integration Patterns

### Schema-Resolver Binding

**One-to-One**: Each schema has exactly one resolver
**Benefits**: Simple, predictable behavior
**Limitations**: No resolver composition

**Future Consideration**: Resolver composition/chaining for complex workflows

### Protocol Integration

**Call Sequence**:
1. Protocol receives attestation request
2. Protocol calls `resolver.before_attest()`
3. If successful, protocol stores attestation
4. Protocol calls `resolver.after_attest()`
5. Process continues regardless of `after_attest()` result

**Error Handling**:
- `before_*` errors abort the operation
- `after_*` errors are logged but don't affect core operation

### Gas Considerations

**Resolver Gas Limits**:
- Each resolver call should have gas limits
- Complex resolvers may need gas optimization
- Protocol should handle out-of-gas gracefully

## Testing Strategy

### Unit Tests

**Critical Paths**:
- All `before_*` validation logic
- Edge cases for access control
- Token/fee handling accuracy
- Error condition handling

### Integration Tests

**Cross-Contract Testing**:
- Protocol-resolver interaction
- Multiple resolver types
- Gas limit testing
- Failure mode testing

### Security Tests

**Attack Scenarios**:
- Unauthorized access attempts
- Economic manipulation attempts
- Gas exhaustion attacks
- State inconsistency scenarios

## Upgrade Considerations

### Interface Evolution

**Current Interface Stability**: 
- Current interface should remain stable for production
- New methods can be added without breaking existing resolvers
- Major interface changes require coordinated upgrades

**Migration Path**:
- Version-based compatibility checking
- Gradual migration to new interfaces
- Backward compatibility layers

### Resolver Upgrades

**Immutable Contracts**: 
- Current Soroban contracts are immutable once deployed
- Upgrades require deploying new contracts
- Schema-resolver bindings must be updated

**Future Considerations**:
- Upgradeable proxy patterns
- Migration tools for state transfer
- Governance mechanisms for resolver changes

## Conclusion

The resolver system provides a flexible, secure foundation for implementing custom attestation logic. The interface design prioritizes security, gas efficiency, and modularity while maintaining simplicity for implementers.

**For Q/A Review Focus Areas**:
1. Access control validation in `before_*` functions
2. Economic attack vectors in token/fee handling
3. State consistency between protocol and resolvers
4. Gas limit and DoS protection mechanisms
5. Admin privilege escalation risks
6. Integration boundary security