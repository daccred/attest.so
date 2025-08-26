# Authority Contract - Payment-Gated Resolver

## Overview

The Authority contract is a resolver implementation that demonstrates a payment-gated access control system for enterprise authority verification. It serves as both a reference implementation of the resolver interface and a production-ready business model for monetizing attestation services.

## Business Model

### Core Value Proposition

**Problem**: Organizations need verifiable on-chain credentials but lack a trusted mechanism for proving enterprise legitimacy.

**Solution**: Payment-gated authority verification system where:
1. Organizations pay 100 XLM for verification eligibility
2. Platform performs off-chain due diligence
3. Platform issues delegated attestations for verified organizations
4. Organizations receive verified authority status on-chain

### Revenue Model

- **Verification Fee**: 100 XLM per organization (configurable by admin)
- **Service Model**: One-time payment for ongoing attestation eligibility
- **Value Delivery**: Verified authority badge provides trust signal for organization's wallet

### Competitive Advantages

- **Pay-Once Model**: No per-attestation fees after initial payment
- **Cryptographic Delegation**: Organizations don't pay gas for attestations
- **Immutable Verification**: On-chain proof of authority status
- **Platform Agnostic**: Works across any application integrating the protocol

## Architecture Overview

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Organization  │    │   Authority      │    │   Protocol      │
│                 │    │   Resolver       │    │   Contract      │
│                 │    │                  │    │                 │
│  1. Pay 100 XLM │───▶│ 2. Record Payment│    │                 │
│                 │    │                  │    │                 │
│                 │    │ 3. Platform signs│    │                 │
│                 │    │    attestation   │    │                 │
│                 │    │                  │    │                 │
│                 │    │ 4. Submit delegated   │ 5. Call resolver│
│                 │    │    attestation   │───▶│    validation   │
│                 │    │                  │    │                 │
│                 │    │ 6. Register in   │◀───│ 7. Store       │
│                 │    │    phone book    │    │    attestation  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Contract Role

**Primary Function**: Resolver contract that validates payment before allowing attestations

**Secondary Functions**:
- Payment collection and tracking
- Authority registration (phone book)
- Fee management
- Admin controls

## Detailed Workflow

### Step 1: Organization Payment

```rust
pub fn pay_verification_fee(
    env: Env,
    payer: Address,
    ref_id: String,
    token_address: Address,
) -> Result<(), Error>
```

**Purpose**: Organizations pay the verification fee to become eligible for authority attestations.

**Business Logic**:
1. Organization calls this function with their wallet address
2. Contract transfers 100 XLM from organization to contract
3. Payment record stored in ledger with platform reference ID
4. Payment event emitted for platform tracking

**Parameters**:
- `payer`: Organization's wallet address
- `ref_id`: Organization's data UID on platform (links on-chain to off-chain)
- `token_address`: XLM token contract address

**Security Considerations**:
- **Authorization Required**: Payer must authorize the transaction
- **Payment Validation**: Token transfer must succeed or transaction reverts
- **One Payment Per Address**: Each address can pay once (subsequent payments update record)
- **Reference ID Tracking**: Links payment to platform's off-chain due diligence

**Attack Vectors & Mitigations**:
- **Payment Bypass**: Attempting to get verification without payment
  - *Mitigation*: Resolver validation checks payment record before allowing attestations
- **Double Payment**: Paying multiple times to manipulate system
  - *Mitigation*: Payment records can be updated; no additional benefit from multiple payments
- **Fake Reference IDs**: Using invalid or manipulated ref_ids
  - *Mitigation*: Platform validates ref_ids off-chain before issuing attestations

### Step 2: Payment Ledger Tracking

```rust
pub struct PaymentRecord {
    pub recipient: Address,      // Wallet address that paid
    pub timestamp: u64,          // Payment timestamp
    pub ref_id: String,          // Platform reference ID
    pub amount_paid: i128,       // Amount in stroops
}
```

**Purpose**: Immutable record of all payments for verification eligibility.

**Design Rationale**:
- **Immutable Audit Trail**: All payments permanently recorded
- **Platform Integration**: ref_id links to off-chain organization data
- **Amount Tracking**: Records actual amount paid (supports fee changes)
- **Timestamp Evidence**: Proves when payment was made

**Storage Pattern**:
```rust
DataKey::PaymentRecord(Address) → PaymentRecord
```

**Query Functions**:
- `has_confirmed_payment(address)`: Check if address has paid
- `get_payment_record(address)`: Get full payment details
- `get_payment_status(address)`: Admin function for payment lookup

### Step 3-4: Platform Due Diligence & Attestation

**Off-Chain Process** (Platform Responsibility):
1. Verify payment received via blockchain events
2. Perform enterprise due diligence on organization
3. Validate organization legitimacy through multiple sources
4. Create delegated attestation request with platform's BLS key
5. Sign attestation request off-chain

**On-Chain Submission**:
- Platform submits delegated attestation to protocol
- Protocol calls authority resolver for validation
- If payment confirmed, attestation proceeds

### Step 5: Resolver Validation (`onattest`)

```rust
fn onattest(
    env: Env,
    attestation: ResolverAttestation,
) -> Result<bool, ResolverError>
```

**Purpose**: Core access control - validates that attestation subject has paid verification fee.

**Critical Security Function**: This is the enforcement point for the payment requirement.

**Validation Logic**:
```rust
// Check payment ledger for confirmed payment
let has_paid = state::has_confirmed_payment(&env, &attestation.recipient);

if !has_paid {
    // Return FALSE - block attestation due to no payment
    return Err(ResolverError::NotAuthorized);
}

// Validate attestation hasn't expired
if attestation.expiration_time > 0 && 
   attestation.expiration_time < env.ledger().timestamp() {
    return Err(ResolverError::InvalidAttestation);
}

// Return TRUE - payment confirmed, allow attestation
Ok(true)
```

**Design Considerations**:
- **Simple Binary Check**: Either paid or not paid (no partial payments)
- **Immediate Validation**: No delays or grace periods
- **Immutable Decision**: Once payment recorded, always valid (no expiration)
- **Standard Expiration Check**: Validates attestation timing

**Security Implications**:
- **Primary Access Control**: No payment = no attestation
- **Cryptographic Security**: Cannot be bypassed (payment records are immutable)
- **Platform Control**: Platform controls who gets attestations through payment validation
- **No Revocation**: Once paid, cannot be "unpaid" (permanent eligibility)

**Attack Vectors & Mitigations**:
- **Payment Record Manipulation**: Attempting to forge payment records
  - *Mitigation*: Payment records created only through payment function with token transfer
- **Resolver Bypass**: Attempting to create attestations without resolver validation
  - *Mitigation*: Protocol enforces resolver calls; cannot be bypassed
- **Time Manipulation**: Using stale or future timestamps
  - *Mitigation*: Blockchain timestamp used; cannot be manipulated by users

### Step 6-7: Authority Registration (`onresolve`)

```rust
fn onresolve(
    env: Env,
    attestation: ResolverAttestation,
) -> Result<(), ResolverError>
```

**Purpose**: Register the organization in the authority phone book after successful attestation.

**Non-Critical Function**: This is side-effect processing that doesn't affect attestation validity.

**Registration Logic**:
```rust
// Get payment record for reference ID and metadata
let payment_record = state::get_payment_record(&env, &attestation.recipient)
    .ok_or(ResolverError::NotAuthorized)?;

// Create authority registry entry
let authority_data = state::RegisteredAuthorityData {
    address: attestation.recipient.clone(),
    metadata: String::from_str(&env, "Verified Authority"),
    registration_time: env.ledger().timestamp(),
    ref_id: payment_record.ref_id.clone(),
};

// Store in phone book
state::set_authority_data(&env, &authority_data);
```

**Design Considerations**:
- **Phone Book Model**: Registry of verified authorities for discovery
- **Reference ID Linking**: Connects on-chain registration to off-chain organization data
- **Timestamp Recording**: Immutable proof of when authority status was granted
- **Metadata Placeholder**: Could be enhanced with decoded attestation data

**Security Implications**:
- **Non-Critical Path**: Failures here don't affect attestation creation
- **Audit Trail**: Creates permanent record of authority registration
- **Platform Integration**: ref_id enables platform to display organization details

### Admin Functions

#### Fee Management

```rust
pub fn set_registration_fee(
    env: Env,
    admin: Address,
    new_fee: i128,
) -> Result<(), Error>
```

**Purpose**: Admin can update the verification fee amount.

**Access Control**: Only contract admin can modify fees.

**Business Rationale**: 
- Market conditions may require fee adjustments
- Economic attacks may require emergency fee increases
- Platform sustainability may require fee optimization

**Security Considerations**:
- **Admin Only**: Strong access control prevents unauthorized fee changes
- **Immediate Effect**: New fees apply to subsequent payments
- **No Retroactive Effect**: Existing payments remain valid regardless of fee changes
- **Event Emission**: Fee changes are publicly auditable

**Attack Vectors & Mitigations**:
- **Admin Compromise**: Malicious admin setting extreme fees
  - *Mitigation*: Multi-sig admin accounts, community governance oversight
- **Economic Griefing**: Setting fees too high to block access
  - *Mitigation*: Platform reputation and competition provide market checks
- **Fee Front-Running**: Changing fees to extract value from pending transactions
  - *Mitigation*: Transparent fee change process with notice periods

#### Fee Withdrawal

```rust
pub fn admin_withdraw_fees(
    env: Env,
    admin: Address,
    token_address: Address,
    amount: i128,
) -> Result<(), Error>
```

**Purpose**: Admin can withdraw collected verification fees.

**Access Control**: Only contract admin can withdraw funds.

**Business Model**: Platform monetization through collected fees.

**Security Considerations**:
- **Admin Authorization**: Strict access control on fund extraction
- **Partial Withdrawals**: Admin can withdraw specified amounts (not required to drain contract)
- **Token Validation**: Specifies exact token and amount for withdrawal
- **Event Auditing**: All withdrawals are publicly recorded

**Attack Vectors & Mitigations**:
- **Admin Rug Pull**: Admin draining all funds and disappearing
  - *Mitigation*: Platform reputation, multi-sig controls, community governance
- **Unauthorized Withdrawal**: Non-admin attempting to extract funds
  - *Mitigation*: Strong access control validation
- **Token Substitution**: Withdrawing wrong tokens or amounts
  - *Mitigation*: Explicit token address and amount specification

## Access Control Architecture

### Role-Based Access Control

```rust
pub enum AccessLevel {
    Admin,       // Full contract control
    Payer,       // Can pay verification fees
    Public,      // Can query data
}
```

### Admin Privileges

**Scope of Admin Power**:
- Fee amount modification
- Fee withdrawal
- Direct authority registration (bypass payment)
- Contract parameter updates

**Admin Responsibilities**:
- Platform operation and maintenance
- Economic parameter management
- Emergency response coordination
- Community governance (if applicable)

**Admin Limitations**:
- Cannot modify existing payment records
- Cannot revoke authority status once granted
- Cannot bypass resolver validation in protocol
- Cannot change immutable contract logic

### Payer Rights

**Payment Rights**:
- Pay verification fee once per address
- Update payment record (if paying again)
- Query own payment status

**Attestation Rights**:
- Eligible for platform-issued attestations after payment
- Permanent eligibility (no expiration)
- Cannot transfer eligibility to other addresses

### Public Access

**Query Functions**:
- Check if address has confirmed payment
- Get payment record details (public data)
- Get authority registration information
- Get current fee amount

**Transparency Benefits**:
- Public payment verification
- Auditable fee structure
- Open authority registry

## Economic Model Analysis

### Fee Structure

**Current Model**: 100 XLM one-time payment
- **Basis**: ~$10-20 USD at current XLM prices
- **Target Market**: Legitimate enterprises (excludes spam/bots)
- **Value Proposition**: Permanent authority status for single payment

### Economic Incentives

**For Organizations**:
- **Benefit**: Verified authority status increases trust and adoption
- **Cost**: One-time 100 XLM payment
- **ROI**: Increased business opportunity through verified status

**For Platform**:
- **Revenue**: 100 XLM per verified organization
- **Costs**: Due diligence operations, platform maintenance
- **Scaling**: Revenue scales with organization adoption

**For Ecosystem**:
- **Trust**: Payment barrier reduces fake/malicious organizations
- **Quality**: Due diligence ensures legitimate authority verification
- **Sustainability**: Fee model supports platform operations

### Economic Attack Vectors

#### Sybil Attacks

**Attack**: Creating many fake organizations to gain authority status
**Cost**: 100 XLM per fake organization
**Mitigation**: 
- High cost barrier (100 XLM × number of fake orgs)
- Platform due diligence process
- Reputational consequences for platform

#### Economic Griefing

**Attack**: Admin setting extremely high fees to block access
**Impact**: Legitimate organizations cannot afford verification
**Mitigation**:
- Multi-sig admin controls
- Community governance oversight
- Platform reputation incentives

#### Fee Avoidance

**Attack**: Attempting to gain authority status without payment
**Technical Mitigation**: Cryptographic enforcement through resolver validation
**Economic Mitigation**: No benefit without payment (no attestations possible)

## Security Model

### Trust Boundaries

**High Trust Components**:
- Contract admin (fee management, withdrawals)
- Platform (due diligence, attestation issuance)
- Payment system (token transfers)

**Medium Trust Components**:
- Protocol contract (resolver interface compliance)
- Organizations (honest payment and identity)

**Zero Trust Components**:
- Payment validation (cryptographically enforced)
- Attestation creation (protocol-enforced)
- Fund security (smart contract protected)

### Security Assumptions

**Platform Integrity**: Platform performs legitimate due diligence
**Admin Honesty**: Admin acts in platform's best interest
**Payment System**: Token transfers work correctly
**Protocol Security**: Core protocol enforces resolver calls

### Threat Model

#### External Threats

**Malicious Organizations**:
- Paying but providing false information
- Attempting to bypass payment requirements
- Social engineering platform staff

**Economic Attackers**:
- Market manipulation affecting XLM price
- Competitive attacks on platform reputation
- Regulatory challenges to business model

#### Internal Threats

**Admin Compromise**:
- Unauthorized fee changes
- Fund extraction
- Service disruption

**Platform Compromise**:
- False authority verification
- Unauthorized attestation issuance
- Data breach affecting ref_ids

#### Technical Threats

**Smart Contract Vulnerabilities**:
- Reentrancy attacks on payment functions
- Access control bypass attempts
- State manipulation attacks

**Integration Vulnerabilities**:
- Protocol contract changes affecting resolver interface
- Token contract issues affecting payments
- Cross-contract interaction failures

## State Management

### Storage Architecture

```rust
pub enum DataKey {
    Admin,                           // Contract administrator
    Initialized,                     // Initialization flag
    RegistrationFee,                 // Current fee amount
    PaymentRecord,                   // Payment ledger entries
    Authority,                       // Registered authorities
}
```

### Data Structures

**PaymentRecord Storage**:
```rust
(DataKey::PaymentRecord, Address) → PaymentRecord
```
- One record per address
- Immutable after creation
- Searchable by payer address

**Authority Storage**:
```rust
(DataKey::Authority, Address) → RegisteredAuthorityData
```
- One record per verified authority
- Created after successful attestation
- Contains platform reference ID

### State Consistency

**Atomic Operations**:
- Payment recording and token transfer are atomic
- Authority registration is atomic with attestation
- Fee updates are immediately effective

**Consistency Guarantees**:
- Payment records always reflect actual token transfers
- Authority records always correspond to successful attestations
- Fee changes don't affect pending transactions

**Error Recovery**:
- Failed payments don't leave partial state
- Failed authority registration doesn't affect attestation
- Admin operations fail cleanly without state corruption

## Integration Patterns

### Protocol Integration

**Resolver Interface Compliance**:
```rust
impl ResolverInterface for AuthorityResolverContract {
    fn onattest(...) -> Result<bool, ResolverError> { /* payment validation */ }
    fn onresolve(...) -> Result<(), ResolverError> { /* authority registration */ }
    fn onrevoke(...) -> Result<bool, ResolverError> { /* admin validation */ }
    fn onresolve(...) -> Result<(), ResolverError> { /* cleanup */ }
    fn metadata(...) -> ResolverMetadata { /* resolver info */ }
}
```

**Schema Binding**: Authority schemas must specify this contract as their resolver

**Event Integration**: All operations emit events for platform monitoring

### Platform Integration

**Payment Monitoring**:
```javascript
// Platform monitors payment events
contract.events.filter("PAYMENT_RECEIVED")
  .on('data', (event) => {
    // Update platform records
    // Trigger due diligence process
  });
```

**Reference ID Mapping**:
```javascript
// Platform maintains mapping
const orgRecord = {
  onChainAddress: event.payer,
  platformRefId: event.ref_id,
  paymentTimestamp: event.timestamp,
  dueDiligenceStatus: 'pending'
};
```

### Token Integration

**XLM Token Requirements**:
- Standard Stellar token contract
- Transfer function compliance
- Sufficient allowance for payment amount

**Multi-Token Support** (Future):
- Configurable token address
- Dynamic fee calculations
- Cross-token fee conversions

## Monitoring and Observability

### Key Metrics

**Business Metrics**:
- Payment volume and frequency
- Authority registration rate
- Fee collection totals
- Organization conversion rates

**Security Metrics**:
- Failed payment attempts
- Unauthorized access attempts
- Admin action frequency
- Unusual payment patterns

**Technical Metrics**:
- Transaction success rates
- Gas usage patterns
- Resolver call performance
- Event emission reliability

### Event Schema

```rust
// Payment received
(topic: "PAYMENT_RECEIVED", payer: Address) → (amount: i128, ref_id: String)

// Authority registered
(topic: "AUTHORITY_REGISTERED", authority: Address) → ref_id: String

// Fee updated
(topic: "REGISTRATION_FEE_UPDATED") → new_fee: i128

// Fees withdrawn
(topic: "FEES_WITHDRAWN", admin: Address) → amount: i128
```

### Alert Conditions

**Security Alerts**:
- Large fee withdrawals
- Fee changes outside normal ranges
- Multiple failed authorization attempts
- Unusual payment patterns

**Business Alerts**:
- Payment volume anomalies
- Authority registration failures
- Platform due diligence backlogs

## Testing Strategy

### Unit Tests

**Payment System Tests**:
- Valid payment processing
- Payment record creation
- Fee calculation accuracy
- Double payment handling

**Access Control Tests**:
- Admin privilege validation
- Unauthorized access attempts
- Payment validation logic
- Resolver interface compliance

**State Management Tests**:
- Data structure integrity
- Storage key uniqueness
- State consistency under failures
- Concurrent operation handling

### Integration Tests

**Protocol Integration**:
- End-to-end attestation flow
- Resolver validation behavior
- Cross-contract state consistency
- Event emission verification

**Token Integration**:
- Token transfer mechanics
- Allowance handling
- Transfer failure scenarios
- Multi-token support

### Security Tests

**Economic Attack Simulation**:
- Sybil attack cost analysis
- Fee manipulation scenarios
- Payment bypass attempts
- Admin privilege abuse

**Technical Security Tests**:
- Reentrancy attack attempts
- Integer overflow/underflow
- Access control bypass attempts
- State corruption attempts

## Future Enhancements

### Business Model Evolution

**Subscription Model**: Monthly/yearly fees for continued authority status
**Tiered Verification**: Different fee levels for different verification depths
**Revenue Sharing**: Split fees with protocol or other stakeholders
**Staking Model**: Require staked tokens in addition to fees

### Technical Improvements

**Multi-Token Payments**: Accept various tokens for fees
**Payment Plans**: Installment payment options
**Automatic Renewal**: Optional subscription renewals
**Bulk Payments**: Enterprise packages for multiple addresses

### Integration Enhancements

**Cross-Chain Support**: Authority status across multiple blockchains
**API Integration**: Direct platform API for payment processing
**Governance Integration**: Community control over fee structures
**Analytics Dashboard**: Real-time business metrics

## Upgrade Considerations

### Current Limitations

**Immutable Contract**: Cannot be upgraded once deployed
**Fixed Business Logic**: Payment model cannot be changed
**Single Token**: Only supports one token type for fees
**No Revocation**: Authority status cannot be revoked

### Migration Strategies

**New Contract Deployment**: Deploy updated contract with new features
**State Migration**: Tools to transfer existing payment records
**Gradual Migration**: Support both old and new contracts during transition
**Backward Compatibility**: Maintain old contract for existing authorities

### Governance Preparation

**Parameter Control**: Make key parameters governable (fees, admin rights)
**Upgrade Mechanisms**: Proxy patterns for contract upgrades
**Community Voting**: Decentralized control over major changes
**Emergency Procedures**: Circuit breakers for critical issues

## Conclusion

The Authority contract demonstrates a production-ready business model for monetizing attestation services while maintaining strong security guarantees. The payment-gated access control system provides economic incentives for legitimate organizations while creating barriers for malicious actors.

**Key Security Properties**:
- Cryptographic enforcement of payment requirements
- Immutable audit trail of all payments and registrations
- Strong access controls with clear privilege separation
- Economic barriers to Sybil attacks

**Business Model Strengths**:
- Simple, understandable value proposition
- Sustainable revenue model for platform operations
- Clear return on investment for organizations
- Scalable with market adoption

**For Q/A Review Focus Areas**:
1. **Payment validation logic** - ensure cryptographic enforcement cannot be bypassed
2. **Admin privilege scope** - verify admin cannot manipulate payment records or bypass validation
3. **Economic attack vectors** - analyze cost/benefit of various attack strategies
4. **State consistency** - verify payment records always reflect actual token transfers
5. **Resolver interface compliance** - ensure proper integration with protocol contract
6. **Token handling security** - verify safe token transfer operations
7. **Event emission accuracy** - ensure all state changes are properly logged
8. **Access control matrix** - verify each function has appropriate authorization checks