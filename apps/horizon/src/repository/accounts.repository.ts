import { sorobanRpcUrl } from '../common/constants';
import { getDB } from '../common/db';

export async function fetchAccountFromHorizon(accountId: string): Promise<any | null> {
  try {
    console.log(`Fetching account ${accountId} from Horizon`);

    // Use Stellar Horizon API for accounts (not Soroban RPC)
    const horizonUrl = sorobanRpcUrl.includes('testnet') 
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org';

    const response = await fetch(`${horizonUrl}/accounts/${accountId}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Account ${accountId} not found`);
        return null;
      }
      throw new Error(`Account request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`Error fetching account ${accountId}:`, error.message);
    return null;
  }
}

export async function storeAccountsInDB(accounts: any[]) {
    const db = await getDB();
    if (!db || accounts.length === 0) return;
  
    try {
      const results = await db.$transaction(async (prismaTx) => {
        const accs = accounts.map(async (account) => {
          const accountData = {
            accountId: account.account_id,
            sequence: account.sequence,
            balances: account.balances || [],
            signers: account.signers || [],
            data: account.data || {},
            flags: account.flags || 0,
            homeDomain: account.home_domain,
            thresholds: account.thresholds || {},
            isContract: Boolean(account.is_contract),
            contractCode: account.contract_code,
            operationCount: account.operation_count || 0,
            lastActivity: account.last_modified_time ? new Date(account.last_modified_time) : null,
          };
  
          return prismaTx.horizonAccount.upsert({
            where: { accountId: account.account_id },
            update: accountData,
            create: accountData
          });
        });
        
        return Promise.all(accs);
      });
      
      console.log(`Stored ${results.length} accounts.`);
    } catch (error) {
      console.error('Error storing accounts:', error);
    }
  } 