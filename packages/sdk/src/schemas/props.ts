export interface CreateSchemaProps {
    schema: string;
    resolver?: string;
    reference?: string;
  }
  
  export interface GetSchemaProps {
    uid: string;
  }

  export interface GetAllSchemaUIDsProps {
    uids?: string[];
  }