import { PublicKey } from '@solana/web3.js'

export interface AttestationUIDProp {
  attestationUID: string
}

export interface CreateAttestationProps {
  schemaUID: PublicKey
  data: any
}

export interface GetAllAttestationsProps {
  schemaUID: string
}
