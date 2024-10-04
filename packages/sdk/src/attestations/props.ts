export interface AttestationUIDProp {
  attestationUID: string;
}

export interface CreateAttestationProps {
  schemaUID: string;
  data: any;
}

export interface GetAllAttestationsProps {
  schemaUID: string;
}
