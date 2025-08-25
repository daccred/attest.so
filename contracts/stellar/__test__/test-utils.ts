import fs from 'fs'
import path from 'path'

export interface TestConfig {
  adminSecretKey: string
  rpcUrl: string
  protocolContractId: string
  authorityContractId: string
}

/**
 * Load test configuration from deployments.json and environment
 */
export function loadTestConfig(): TestConfig {
  const deploymentsPath = path.join(__dirname, '..', 'deployments.json')
  
  try {
    // Load deployment data
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'))
    const testnetDeployments = deployments.testnet
    
    if (!testnetDeployments) {
      throw new Error('No testnet deployments found in deployments.json')
    }
    
    const protocolContractId = testnetDeployments.protocol?.id
    const authorityContractId = testnetDeployments.authority?.id
    
    if (!protocolContractId) {
      throw new Error('Protocol contract ID not found in deployments.json')
    }
    
    if (!authorityContractId) {
      throw new Error('Authority contract ID not found in deployments.json')
    }
    
    // Use default testnet values - this matches the 'drew' identity used in deployment
    const adminSecretKey = process.env.ADMIN_SECRET_KEY as string;
    const rpcUrl = 'https://soroban-testnet.stellar.org'
    
    return {
      adminSecretKey,
      rpcUrl,
      protocolContractId,
      authorityContractId
    }
  } catch (error) {
    throw new Error(`Failed to load test configuration: ${error}`)
  }
}

/**
 * Parse environment file content into key-value pairs
 */
function parseEnvFile(content: string): Record<string, string> {
  const envMap: Record<string, string> = {}
  
  for (const line of content.split('\n')) {
    // Skip comments and empty lines
    if (line.trim() && !line.trim().startsWith('#')) {
      // Remove potential 'export ' prefix
      const trimmedLine = line.replace(/^\s*export\s+/, '')
      const [key, ...valueParts] = trimmedLine.split('=')
      
      if (key && valueParts.length > 0) {
        // Remove potential quotes around the value
        let value = valueParts.join('=').trim()
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1)
        }
        envMap[key.trim()] = value
      }
    }
  }
  
  return envMap
}