/**
 * Stellar-specific utility functions
 */

import { Keypair } from '@stellar/stellar-sdk'

/**
 * Create test keypairs for Stellar development and testing.
 * 
 * This utility generates funded test accounts that can be used for testing
 * the attestation protocol on Stellar testnet.
 * 
 * @returns Object containing authority and recipient keypairs
 */
export function createTestKeypairs(): {
  authority: Keypair
  recipient: Keypair
  authorityPublic: string
  recipientPublic: string
} {
  // Generate deterministic keypairs for consistent testing
  // These are the same keypairs used in the examples
  const authority = Keypair.fromSecret('SALAT34FZK3CSTAWIOT6D4PY6UWKSG6AABGJHXJZCOUHUGP75DDOFPO4')
  const recipient = Keypair.fromSecret('SCA2IFDKXLRPWCMUWIW6RLOCVGXOQOFQJIODGGGJQ2UAD2RI3WQAXLKX')

  return {
    authority,
    recipient,
    authorityPublic: authority.publicKey(),
    recipientPublic: recipient.publicKey(),
  }
}

/**
 * Generate funding URLs for Stellar testnet accounts.
 * 
 * @param publicKeys - Array of public keys to generate funding URLs for
 * @returns Array of Friendbot URLs for funding the accounts
 */
export function generateFundingUrls(publicKeys: string[]): string[] {
  return publicKeys.map(key => `https://friendbot.stellar.org/?addr=${key}`)
}

/**
 * Check if a Stellar address is properly formatted.
 * 
 * @param address - The address to validate
 * @returns boolean - True if the address is valid
 */
export function isValidStellarAddress(address: string): boolean {
  try {
    // Stellar public keys are 56 characters long and start with 'G'
    if (address.length !== 56 || !address.startsWith('G')) {
      return false
    }
    
    // Additional validation could be added here (checksum, etc.)
    return true
  } catch {
    return false
  }
}