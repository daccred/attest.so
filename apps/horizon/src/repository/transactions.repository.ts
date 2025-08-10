import { sorobanRpcUrl } from '../common/constants';

async function fetchTransactionDetails(txHash: string): Promise<any | null> {
    try {
      const txRpcPayload = {
        jsonrpc: "2.0",
        id: `getTx-${txHash}-${Date.now()}`,
        method: "getTransaction",
        params: { hash: txHash },
      };
      
      const rawTxResponse = await fetch(sorobanRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txRpcPayload),
      });
      
      if (!rawTxResponse.ok) {
        throw new Error(`HTTP ${rawTxResponse.status}`);
      }
      
      const txRpcResponse = await rawTxResponse.json();
      
      if (txRpcResponse.error) {
        throw new Error(txRpcResponse.error.message);
      }
      
      return txRpcResponse.result;
    } catch (error: any) {
      console.error(`Error fetching transaction ${txHash}:`, error.message);
      return null;
    }
}

export { fetchTransactionDetails }; 