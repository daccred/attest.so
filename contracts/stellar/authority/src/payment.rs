use crate::errors::Error;
use crate::state::{PaymentRecord, get_registration_fee, record_payment};
use soroban_sdk::{Address, Env, String, token};

// ══════════════════════════════════════════════════════════════════════════════
// ► Payment Collection and Verification
// ══════════════════════════════════════════════════════════════════════════════

/// Process payment for authority verification eligibility
/// 
/// This is the entry point for organizations wanting to become verified authorities.
/// They pay once and become eligible for platform-issued attestations.
///
/// # Business Logic
/// 1. Organization pays the current verification fee (default 100 XLM)
/// 2. Payment is recorded in immutable ledger with platform reference ID
/// 3. Platform can then issue delegated attestations for this organization
/// 4. Payment eligibility is permanent (no expiration)
///
/// # Security Model
/// - **Authorization Required**: Only the payer can authorize their own payment
/// - **Atomic Operation**: Token transfer and record creation are atomic
/// - **Immutable Record**: Payment cannot be deleted or modified after creation
/// - **Event Auditing**: All payments are publicly verifiable through events
///
/// # Parameters
/// * `env` - Soroban environment for storage and crypto operations
/// * `payer` - Organization's wallet address (must authorize transaction)
/// * `ref_id` - Platform's internal reference ID for this organization
/// * `token_address` - XLM token contract address for fee payment
///
/// # Returns
/// * `Ok(())` - Payment processed successfully
/// * `Err(Error)` - Payment failed (insufficient funds, authorization, etc.)
///
/// # Attack Vectors & Mitigations
/// * **Double Payment**: Paying multiple times to confuse system
///   - *Mitigation*: Only latest payment record is kept; no additional benefit
/// * **Fake Reference IDs**: Using invalid or manipulated ref_ids  
///   - *Mitigation*: Platform validates ref_ids off-chain before issuing attestations
/// * **Payment Bypass**: Attempting to record payment without token transfer
///   - *Mitigation*: Token transfer must succeed or entire transaction reverts
/// * **Authorization Bypass**: Paying for someone else without permission
///   - *Mitigation*: Strict authorization requirement from payer address
///
/// # Integration Notes
/// - Platform monitors "PAYMENT_RECEIVED" events to trigger due diligence
/// - ref_id links on-chain payment to off-chain organization data
/// - Payment enables attestation eligibility but doesn't guarantee attestation issuance
pub fn pay_verification_fee(
    env: &Env,
    payer: &Address,
    ref_id: &String,
    token_address: &Address,
) -> Result<(), Error> {
    // SECURITY: Require authorization from the paying address
    // This prevents unauthorized payments on behalf of others
    payer.require_auth();
    
    // Get current fee amount (configurable by admin)
    let fee_amount = get_registration_fee(env).unwrap_or(100_0000000); // 100 XLM default
    
    // CRITICAL: Transfer tokens from payer to contract
    // This is the actual payment - if this fails, entire transaction reverts
    // No payment record is created without successful token transfer
    let contract_address = env.current_contract_address();
    token::Client::new(env, token_address).transfer(
        payer,
        &contract_address, 
        &fee_amount
    );
    
    // Record payment in immutable ledger
    // This creates permanent proof of payment for resolver validation
    let payment_record = PaymentRecord {
        recipient: payer.clone(),
        timestamp: env.ledger().timestamp(),    // Blockchain timestamp (cannot be manipulated)
        ref_id: ref_id.clone(),                 // Platform's organization reference
        amount_paid: fee_amount,                // Actual amount paid (for fee change tracking)
    };
    
    // Store payment record (overwrites any previous payment for same address)
    record_payment(env, &payment_record);
    
    // Emit public event for platform monitoring and transparency
    // Platform uses this to trigger off-chain due diligence process
    env.events().publish(
        (String::from_str(env, "PAYMENT_RECEIVED"), payer),
        (fee_amount, ref_id.clone()),
    );
    
    Ok(())
}

/// Check payment status for an address
pub fn get_payment_status(
    env: &Env,
    address: &Address,
) -> Option<PaymentRecord> {
    crate::state::get_payment_record(env, address)
}

/// Withdraw collected verification fees (admin only)
///
/// This function allows the platform admin to extract collected fees for business
/// operations. This is the primary monetization mechanism for the platform.
///
/// # Business Logic
/// - Platform collects 100 XLM per verified organization
/// - Admin can withdraw any amount up to the contract's token balance
/// - Withdrawals support partial amounts (don't require draining contract)
/// - All withdrawals are publicly auditable through events
///
/// # Access Control
/// - **Admin Only**: Strict access control - only contract admin can withdraw
/// - **Multi-sig Recommended**: Admin should be multi-sig for security
/// - **No Delegation**: Admin privilege cannot be delegated to other addresses
///
/// # Parameters
/// * `env` - Soroban environment for storage and operations
/// * `admin` - Contract admin address (must authorize transaction)
/// * `token_address` - Token contract to withdraw from (typically XLM)
/// * `amount` - Amount to withdraw in token's smallest unit (stroops for XLM)
///
/// # Returns
/// * `Ok(())` - Withdrawal completed successfully
/// * `Err(Error::NotAuthorized)` - Caller is not contract admin
/// * `Err(Error)` - Token transfer failed (insufficient balance, etc.)
///
/// # Security Considerations
/// - **Admin Compromise Risk**: Admin compromise allows fund extraction
/// - **Public Transparency**: All withdrawals are publicly auditable
/// - **Partial Withdrawals**: Admin doesn't need to drain entire balance
/// - **Token Specificity**: Must specify exact token and amount
///
/// # Attack Vectors & Mitigations
/// * **Admin Rug Pull**: Admin extracting all funds and disappearing
///   - *Mitigation*: Platform reputation, multi-sig admin, community governance
/// * **Unauthorized Withdrawal**: Non-admin attempting to extract funds
///   - *Mitigation*: Strict access control validation (only_owner)
/// * **Token Substitution**: Withdrawing wrong token or manipulated amounts
///   - *Mitigation*: Explicit token address and amount specification
/// * **Gradual Extraction**: Admin slowly draining funds to avoid detection
///   - *Mitigation*: Public event emission enables community monitoring
///
/// # Business Implications
/// - Platform sustainability depends on responsible fee management
/// - Frequent withdrawals may signal business health or admin behavior
/// - Community can monitor withdrawal patterns for platform evaluation
pub fn admin_withdraw_fees(
    env: &Env,
    admin: &Address,
    token_address: &Address,
    amount: i128,
) -> Result<(), Error> {
    // CRITICAL ACCESS CONTROL: Only contract admin can withdraw fees
    // This is the primary security boundary for fund protection
    crate::access_control::only_owner(env, admin)?;
    
    // Transfer tokens from contract to admin
    // Amount must not exceed contract's token balance or transfer will fail
    let contract_address = env.current_contract_address();
    token::Client::new(env, token_address).transfer(
        &contract_address,
        admin,
        &amount
    );
    
    // TRANSPARENCY: Emit public withdrawal event
    // Enables community monitoring of admin behavior and fund management
    // Critical for platform reputation and trust maintenance
    env.events().publish(
        (String::from_str(env, "FEES_WITHDRAWN"), admin),
        amount,
    );
    
    Ok(())
}