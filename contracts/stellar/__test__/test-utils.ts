import fs from 'fs'
import path from 'path'

export interface TestConfig {
  adminSecretKey: string
  rpcUrl: string
  protocolContractId: string
  authorityContractId: string
}

/**
 * Load test configuration from env.sh file
 */
export function loadTestConfig(): TestConfig {
  const envPath = path.join(__dirname, '..', 'env.sh')
  
  try {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const envVars = parseEnvFile(envContent)
    
    const adminSecretKey = envVars.ADMIN_SECRET_KEY || envVars.SECRET_KEY
    const rpcUrl = envVars.SOROBAN_RPC_URL
    const protocolContractId = envVars.PROTOCOL_CONTRACT_ID
    const authorityContractId = envVars.AUTHORITY_CONTRACT_ID
    
    if (!adminSecretKey) {
      throw new Error('ADMIN_SECRET_KEY or SECRET_KEY not found in env.sh')
    }
    
    if (!rpcUrl) {
      throw new Error('SOROBAN_RPC_URL not found in env.sh')
    }
    
    if (!protocolContractId) {
      throw new Error('PROTOCOL_CONTRACT_ID not found in env.sh')
    }
    
    if (!authorityContractId) {
      throw new Error('AUTHORITY_CONTRACT_ID not found in env.sh')
    }
    
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