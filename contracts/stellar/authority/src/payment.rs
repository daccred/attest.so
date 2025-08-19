use crate::errors::Error;
use crate::state::{PaymentRecord, get_registration_fee, record_payment};
use soroban_sdk::{Address, Env, String, token};

// ══════════════════════════════════════════════════════════════════════════════
// ► Payment Collection and Verification
// ══════════════════════════════════════════════════════════════════════════════

/// Process payment for authority verification
/// This function should be called by organizations wanting to become verified authorities
pub fn pay_verification_fee(
    env: &Env,
    payer: &Address,
    ref_id: &String,
    token_address: &Address, // XLM token address
) -> Result<(), Error> {
    payer.require_auth();
    
    let fee_amount = get_registration_fee(env).unwrap_or(100_0000000); // 100 XLM default
    
    // Transfer XLM from payer to contract
    let contract_address = env.current_contract_address();
    token::Client::new(env, token_address).transfer(
        payer,
        &contract_address, 
        &fee_amount
    );
    
    // Record payment in ledger
    let payment_record = PaymentRecord {
        recipient: payer.clone(),
        timestamp: env.ledger().timestamp(),
        ref_id: ref_id.clone(),
        amount_paid: fee_amount,
    };
    
    record_payment(env, &payment_record);
    
    // Emit payment event
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

/// Withdraw collected fees (admin only)
pub fn admin_withdraw_fees(
    env: &Env,
    admin: &Address,
    token_address: &Address,
    amount: i128,
) -> Result<(), Error> {
    crate::access_control::only_owner(env, admin)?;
    
    let contract_address = env.current_contract_address();
    token::Client::new(env, token_address).transfer(
        &contract_address,
        admin,
        &amount
    );
    
    // Emit withdrawal event
    env.events().publish(
        (String::from_str(env, "FEES_WITHDRAWN"), admin),
        amount,
    );
    
    Ok(())
}