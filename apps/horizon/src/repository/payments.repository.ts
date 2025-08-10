import { sorobanRpcUrl, getHorizonBaseUrl } from '../common/constants';
import { getDB } from '../common/db';

export async function fetchPaymentsFromHorizon(params: {
  accountId?: string;
  cursor?: string;
  limit?: number;
}): Promise<any[]> {
  const { accountId, cursor, limit = 100 } = params;
  
  try {
    const baseParams: any = {
      limit,
      order: 'desc'
    };
    
    if (cursor) baseParams.cursor = cursor;
    if (accountId) baseParams.for_account = accountId;
    
    console.log('Fetching payments from Horizon with params:', baseParams);

    // Use Stellar Horizon API for payments (not Soroban RPC)
    const horizonUrl = getHorizonBaseUrl();
    const queryString = new URLSearchParams(baseParams).toString();
    const url = `${horizonUrl}/payments?${queryString}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Payments request failed: ${response.status}`);
    }

    const data = await response.json();
    return data._embedded?.records || [];
  } catch (error: any) {
    console.error('Error fetching payments:', error.message);
    return [];
  }
}

export async function storePaymentsInDB(payments: any[]) {
    const db = await getDB();
    if (!db || payments.length === 0) return;
  
    try {
      const results = await db.$transaction(async (prismaTx) => {
        const pymnts = payments.map(async (payment) => {
          const paymentData = {
            paymentId: payment.id,
            transactionHash: payment.transaction_hash,
            operationId: payment.operation_id,
            from: payment.from,
            to: payment.to,
            asset: {
              type: payment.asset_type,
              code: payment.asset_code,
              issuer: payment.asset_issuer
            },
            amount: payment.amount,
            timestamp: payment.created_at ? new Date(payment.created_at) : new Date(),
          };
  
          return prismaTx.horizonPayment.upsert({
            where: { paymentId: payment.id },
            update: paymentData,
            create: paymentData
          });
        });
        
        return Promise.all(pymnts);
      });
      
      console.log(`Stored ${results.length} payments.`);
    } catch (error) {
      console.error('Error storing payments:', error);
    }
} 