# System Architecture Overview

## Executive Summary

We designed the attest.so system to provide a modular, secure foundation for blockchain-based attestation infrastructure. Our architecture separates core attestation logic from business rules through a resolver pattern, enabling flexible economic models while maintaining security and immutability.

## System Components

### Core Contracts

```
┌─────────────────────────────────────────────────────────────────┐
│                        System Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐    ┌──────────────┐ │
│  │    Protocol     │    │    Resolvers     │    │  Authority   │ │
│  │   (Core Logic)  │◄──►│   (Interface)    │◄──►│ (Reference)  │ │
│  │                 │    │                  │    │              │ │
│  │ • Attestations  │    │ • Validation     │    │ • Payment    │ │
│  │ • Schemas       │    │ • Templates      │    │ • Phone Book │ │
│  │ • BLS Sigs      │    │ • Business Logic │    │ • Access Ctrl│ │
│  │ • Nonce Mgmt    │    │                  │    │              │ │
│  └─────────────────┘    └──────────────────┘    └──────────────┘ │
│           │                       │                       │     │
│           ▼                       ▼                       ▼     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Integration Layer                           │ │
│  │                                                             │ │
│  │ • Event Monitoring  • Token Transfers  • Cross-Contract    │ │
│  │ • State Sync        • Gas Management   • Error Handling    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Contract Responsibilities

### Protocol Contract - Core Engine

**Primary Purpose**: Immutable attestation infrastructure

**Core Functions**:
- **Schema Management**: Register and validate attestation schemas
- **Attestation Lifecycle**: Create, query, and revoke attestations  
- **BLS Signature System**: Enable cryptographic delegation
- **Nonce Management**: Prevent replay attacks and enable multi-attestations
- **Resolver Integration**: Call business logic contracts for validation

**Security Boundaries**:
- **Trusted Core**: Protocol logic is immutable and fully trusted
- **Validation Gateway**: All operations validated before state changes
- **Nonce Authority**: Single source of truth for replay protection
- **Event Integrity**: Canonical event emission for all operations

**Trust Model**: 
- **Full Trust**: Protocol contract is completely trusted
- **Immutable Logic**: Core attestation rules cannot be changed
- **Gas Bounded**: Operations have predictable gas costs
- **Atomic Operations**: State changes are atomic and consistent

### Resolver Interface - Business Logic Abstraction

**Primary Purpose**: Standardized interface for custom business logic

**Core Functions**:
- **Validation Interface**: `onattest()`, `onrevoke()` for access control
- **Side Effects Interface**: `after_attest()`, `after_revoke()` for post-processing
- **Metadata Interface**: `get_metadata()` for resolver discovery
- **Template Library**: Pre-built resolvers for common patterns

**Security Boundaries**:
- **Critical Path**: `before_*` functions control operation authorization
- **Non-Critical Path**: `after_*` functions handle side effects only
- **Isolation**: Resolver failures don't corrupt protocol state
- **Gas Limits**: Bounded execution to prevent DoS attacks

**Trust Model**:
- **Partial Trust**: Resolvers trusted for business logic only
- **Validation Authority**: Can approve/reject operations
- **No Core Control**: Cannot modify protocol's core state
- **Fail-Safe Design**: Errors abort operations safely

### Authority Contract - Reference Implementation

**Primary Purpose**: Payment-gated authority verification resolver

**Core Functions**:
- **Payment Collection**: 100 XLM verification fee processing
- **Access Control**: Payment validation before attestation
- **Phone Book Registry**: Searchable directory of verified authorities
- **Admin Management**: Fee configuration and fund withdrawal

**Security Boundaries**:
- **Payment Gate**: Cryptographic enforcement of payment requirement
- **Fund Security**: Admin-only access to collected fees
- **Immutable Records**: Payment history cannot be modified
- **Public Transparency**: All operations auditable through events

**Trust Model**:
- **Business Logic**: Trusted for payment validation and registry
- **Admin Control**: Admin has privileged access to fees and configuration
- **Economic Security**: Payment requirements deter abuse
- **Platform Dependent**: Relies on platform for due diligence

## Data Flow Architecture

### Attestation Creation Flow

```
Organization → Authority Contract → Protocol Contract → Resolver Validation → Storage
     │               │                    │                      │             │
     ▼               ▼                    ▼                      ▼             ▼
1. Pay Fee     2. Record Payment    3. Delegate Sign     4. Validate Pay    5. Store
                                    4. Submit Request     5. Call Resolver   6. Register
```

#### Detailed Flow Steps

**Step 1-2: Payment Processing**
```rust
// Organization pays verification fee
pay_verification_fee(payer, ref_id, token_address)
  ├─ Require authorization from payer
  ├─ Transfer XLM tokens to contract
  ├─ Record payment in immutable ledger
  └─ Emit payment event for platform monitoring
```

**Step 3-4: Platform Due Diligence & Delegation**
```javascript
// Off-chain platform operations
platform.processPayment(event.payer, event.ref_id)
  ├─ Verify payment on blockchain
  ├─ Perform enterprise due diligence
  ├─ Create delegated attestation request
  └─ Sign with platform's BLS private key
```

**Step 5-6: Protocol Processing**
```rust
// Protocol contract handles delegated attestation
protocol.attest_by_delegation(submitter, request)
  ├─ Validate BLS signature
  ├─ Check nonce for replay protection
  ├─ Call resolver.onattest() → Authority validates payment
  ├─ Store attestation if validation passes
  └─ Call resolver.after_attest() → Authority registers in phone book
```

### Security Flow Analysis

**Authorization Chain**:
1. **User Authorization**: Organization authorizes payment transaction
2. **Platform Authorization**: Platform signs attestation request with BLS key
3. **Protocol Authorization**: Protocol validates signature and calls resolver
4. **Resolver Authorization**: Resolver validates payment and approves attestation

**Validation Chain**:
1. **Payment Validation**: Token transfer must succeed
2. **Cryptographic Validation**: BLS signature must verify
3. **Nonce Validation**: Prevents replay attacks
4. **Business Validation**: Resolver checks payment status
5. **Expiration Validation**: Prevents stale request processing

## Security Architecture

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                      Trust Boundary Map                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────┐ FULL TRUST   ┌─────────────────────────────┐ │
│ │ Protocol Core   │──────────────│ • Immutable Logic           │ │
│ │                 │              │ • Nonce Management          │ │
│ │                 │              │ • Event Emission            │ │
│ └─────────────────┘              └─────────────────────────────┘ │
│          │                                                      │
│          │ INTERFACE TRUST                                      │
│          ▼                                                      │
│ ┌─────────────────┐ PARTIAL TRUST ┌────────────────────────────┐ │
│ │ Resolver System │──────────────│ • Validation Logic         │ │
│ │                 │              │ • Business Rules           │ │
│ │                 │              │ • Side Effects             │ │
│ └─────────────────┘              └────────────────────────────┘ │
│          │                                                      │
│          │ IMPLEMENTATION TRUST                                 │
│          ▼                                                      │
│ ┌─────────────────┐ BUSINESS TRUST ┌───────────────────────────┐ │
│ │ Authority Impl  │──────────────│ • Payment Validation      │ │
│ │                 │              │ • Admin Controls          │ │
│ │                 │              │ • Fund Management         │ │
│ └─────────────────┘              └───────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Security Properties

#### Protocol Contract Security

**Immutability Properties**:
- Core attestation logic cannot be changed
- Nonce management prevents replay attacks
- BLS signature verification is cryptographically secure
- Storage patterns ensure data integrity

**Availability Properties**:
- No admin controls can block basic operations
- Resolver failures don't prevent other attestations
- Gas limits prevent DoS attacks
- State corruption is prevented through validation

**Integrity Properties**:
- Attestations cannot be forged or modified
- Events provide complete audit trail
- Cross-contract calls are bounded and safe
- Error handling prevents state inconsistency

#### Resolver Security Model

**Validation Authority**:
- `before_*` functions control operation approval
- Business logic errors safely abort operations
- Gas limits prevent expensive validation attacks
- Return values are strictly validated

**Side Effect Isolation**:
- `after_*` failures don't affect core operations
- Resolver state is isolated from protocol state
- Token transfers are atomic with proper error handling
- Event emission provides operation transparency

#### Authority Contract Security

**Payment Security**:
- Token transfers are atomic with record creation
- Payment records are immutable once created
- Authorization required for all payment operations
- Admin controls have strict access control

**Economic Security**:
- Payment requirements deter Sybil attacks
- Fee amounts configurable for market conditions
- Revenue extraction requires admin authorization
- Public events enable community monitoring

## Integration Patterns

### Schema-Resolver Binding

```rust
// Schema creation binds resolver
let schema = Schema {
    authority: creator_address,
    definition: "enterprise_verification_v1",
    resolver: Some(authority_contract_address), // Binds payment validation
    revocable: false,
};
```

**Security Implications**:
- Schema creator controls resolver choice
- Resolver binding is immutable after creation
- Users choose schemas based on resolver trust
- No protocol-level resolver restrictions

### Cross-Contract Communication

```rust
// Protocol → Resolver communication
impl ProtocolContract {
    fn _attest(attestation: Attestation) -> Result<(), Error> {
        // Validation phase (critical path)
        if let Some(resolver) = schema.resolver {
            let validation_result = resolver.onattest(env, attestation);
            if !validation_result? {
                return Err(Error::ResolverRejected);
            }
        }
        
        // Core protocol operations
        store_attestation(attestation);
        increment_nonce(attester);
        
        // Side effects phase (non-critical path)
        if let Some(resolver) = schema.resolver {
            let _ = resolver.after_attest(env, attestation);
            // Note: Failures here don't revert the attestation
        }
        
        Ok(())
    }
}
```

**Security Properties**:
- Validation failures abort entire operation
- Side effect failures are logged but don't revert
- Gas limits protect against resolver DoS
- Error isolation prevents cascade failures

 
## Attack Vectors & Mitigations

### Economic Attacks

#### Sybil Attack Analysis

**Attack Vector**: Creating many fake organizations to gain authority status
**Cost Analysis**: 100 XLM × number of fake organizations
**Current Mitigation**:
- High economic barrier (100 XLM ≈ $10-20 per fake org)
- Platform due diligence process
- Reputational consequences for platform

**Advanced Mitigation Strategies**:
- Progressive fee increases for suspicious patterns
- Community reporting mechanisms  
- Cross-chain identity verification
- Stake-based reputation systems

#### Fee Manipulation Attacks

**Attack Vector**: Admin manipulating fees for economic extraction
**Impact**: Pricing out legitimate organizations or extracting excess value
**Current Mitigation**:
- Admin privilege transparency through events
- Multi-signature admin controls (recommended)
- Community governance oversight

**Enhanced Protection**:
- Gradual fee change mechanisms (time delays)
- Fee change bounds (maximum percentage increases)
- Community veto mechanisms
- Decentralized governance integration

### Technical Attacks

#### Resolver DoS Attacks

**Attack Vector**: Malicious resolvers consuming excessive gas
**Impact**: Making attestations expensive or impossible
**Current Mitigation**:
- Gas limits on resolver calls
- Resolver interface standardization
- Fail-safe error handling

**Enhanced Protection**:
- Resolver allow-lists for critical schemas
- Gas usage monitoring and alerting
- Automatic resolver fallback mechanisms
- Community resolver reputation system

#### Cross-Contract Exploitation

**Attack Vector**: Exploiting interactions between contracts
**Impact**: State corruption or unauthorized operations
**Current Mitigation**:
- Atomic operations with proper error handling
- Strict interface compliance
- Bounded cross-contract calls

**Defense in Depth**:
- Formal verification of critical interactions
- Circuit breakers for unusual patterns
- Comprehensive integration testing
- Real-time monitoring of cross-contract calls

### Cryptographic Attacks

#### BLS Signature Attacks

**Attack Vector**: Signature forgery, replay, or cryptographic weakness
**Impact**: Unauthorized delegated attestations
**Current Mitigation**:
- Strong BLS12-381 cryptography
- Nonce-based replay protection
- Deadline-based signature expiration

**Additional Security**:
- Domain separation in signature schemes
- Key rotation mechanisms
- Quantum-resistant migration path
- Hardware security module integration

## Monitoring & Observability

### Key Metrics Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                    System Health Dashboard                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│ │ Business Metrics│  │Security Metrics │  │Technical Metrics│   │
│ │                 │  │                 │  │                 │   │
│ │• Payment Volume │  │• Failed Auths   │  │• Gas Usage      │   │
│ │• Authority Count│  │• Invalid Sigs   │  │• Success Rates  │   │
│ │• Fee Collection │  │• Unusual Patterns│  │• Event Latency  │   │
│ │• Conversion Rate│  │• Admin Actions  │  │• Storage Growth │   │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Alert Conditions

**Security Alerts**:
- Multiple failed authorization attempts
- Unusual payment patterns or amounts
- Large admin withdrawals
- Signature verification failures
- Cross-contract interaction anomalies

**Business Alerts**:
- Payment volume drops or spikes
- Authority registration failures
- Fee collection anomalies
- Platform due diligence backlogs

**Technical Alerts**:
- Gas usage spikes or inefficiencies
- Event emission failures
- Storage growth anomalies
- Cross-contract communication failures

## Upgrade & Evolution Strategy

### Current Limitations

**Immutable Contracts**: 
- Core logic cannot be upgraded
- Business rules fixed at deployment
- Bug fixes require new deployments

**State Migration Challenges**:
- Payment records tied to specific contract
- Authority registrations not transferable
- Historical data preservation requirements

### Our Future Architecture Evolution

#### Proxy Pattern Integration

```rust
// Upgradeable proxy pattern
contract ProxyContract {
    implementation_address: Address,
    admin: Address,
    
    fn upgrade(new_implementation: Address) {
        require_admin();
        implementation_address = new_implementation;
    }
    
    fn delegate_call(function_data: Bytes) {
        // Forward to current implementation
    }
}
```

**Benefits**:
- Logic upgrades without state migration
- Gradual rollout of new features
- Bug fix deployment capability
- Backward compatibility maintenance

#### Governance Integration

```rust
// Community governance for key parameters
contract GovernanceContract {
    fn propose_fee_change(new_fee: i128) {
        // Community voting mechanism
    }
    
    fn execute_upgrade(new_implementation: Address) {
        // Multi-signature + time delay
    }
}
```

**Governance Scope**:
- Fee amount adjustments
- Admin privilege changes
- Contract upgrade approvals
- Emergency response coordination

### Our Migration Strategy

**Phase 1: Current Architecture**
- We deploy immutable contracts
- We establish operational procedures
- We build community trust

**Phase 2: Governance Integration**
- We add community governance for key parameters
- We implement multi-signature admin controls
- We establish transparent decision-making processes

**Phase 3: Upgradeable Architecture**
- We deploy proxy contracts for new features
- We migrate to upgradeable patterns
- We maintain backward compatibility

**Phase 4: Full Decentralization**
- We transfer admin controls to governance
- We implement community-driven upgrades
- We establish sustainable development funding

## Conclusion

Our attest.so architecture provides a robust, secure foundation for attestation systems with clear separation of concerns, strong security boundaries, and flexible business logic integration. We designed the resolver pattern to enable diverse economic models while maintaining core protocol security and immutability.

**Our Architecture Strengths**:
- **Security**: We implemented multiple layers of validation and access control
- **Modularity**: We established clear separation between core logic and business rules
- **Flexibility**: Our resolver pattern enables diverse use cases
- **Transparency**: We provide complete audit trail through immutable events
- **Scalability**: We designed gas-efficient operations with bounded execution

**Our Key Security Properties**:
- We enforce access controls cryptographically
- We built immutable core logic with upgradeable business rules
- We established economic barriers to prevent abuse and spam
- We implemented comprehensive monitoring and alerting
- We designed fail-safe error handling throughout the system

**For Q/A Review Priorities**:
1. **Cross-contract security boundaries** and interaction safety
2. **Economic attack vectors** and mitigation effectiveness
3. **Cryptographic implementations** and signature verification
4. **Access control matrices** and privilege escalation prevention
5. **State consistency** under concurrent operations and failures
6. **Event integrity** and monitoring system reliability
7. **Upgrade mechanisms** and governance security
8. **Integration patterns** and external dependency risks