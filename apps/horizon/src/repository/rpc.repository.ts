import { rpc } from '@stellar/stellar-sdk';
import { sorobanRpcUrl } from '../common/constants';

const sorobanServer = new rpc.Server(sorobanRpcUrl, {
  allowHttp: sorobanRpcUrl.startsWith('http://'),
});

export async function getLatestRPCLedgerIndex(): Promise<number> {
  console.log('--------------- Attempting to call sorobanServer.getLatestLedger() --------------- ');
  const latestLedgerOnRpcData = await sorobanServer.getLatestLedger();
  console.log('--------------- sorobanServer.getLatestLedger() RAW RESPONSE: ---------------');
  console.log(JSON.stringify(latestLedgerOnRpcData, null, 2));
  console.log('----------------------------------------------------------------------------');
  if (!latestLedgerOnRpcData || typeof latestLedgerOnRpcData.sequence !== 'number') {
    throw new Error('Invalid response from getLatestLedger or sequence number missing.');
  }
  return latestLedgerOnRpcData.sequence;
}

export async function getRpcHealth(): Promise<string> {
  console.log('--------------- Attempting to call sorobanServer.getHealth() --------------- ');
  const rpcHealth = await sorobanServer.getHealth();
  console.log('--------------- sorobanServer.getHealth() RAW RESPONSE: ------------------');
  console.log(JSON.stringify(rpcHealth, null, 2));
  console.log('--------------------------------------------------------------------------');
  
  if (!rpcHealth || typeof rpcHealth.status !== 'string') {
    console.warn('RPC health response invalid or status missing.');
    return 'error_invalid_response';
  }
  return rpcHealth.status;
} 