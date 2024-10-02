import AttestSDK from '../src';

async function run() {
  const client = new AttestSDK({
    privateKey: '0x1234567890123456789012345678901234567890',
  });

  console.log("\n\nRegistering schema...");
  const registerSchema = await client.schema.register('schema-id');
  console.log(`Schema registered: ${registerSchema.data}`);

  console.log("\n\nRetrieving schema...");
  const retrieveSchema = await client.schema.retrieve('schema-id');
  console.log(`Schema retrieved: ${retrieveSchema.data}`);

  console.log("\n\nCreating attestation...");
  const createAttestation = await client.attestation.create('schema-id');
  console.log(`Attestation created: ${createAttestation.data}`);

  console.log("\n\nRevoking attestation...");
  const revokeAttestation = await client.attestation.revoke('schema-id');
  console.log(`Attestation revoked: ${revokeAttestation.data}`);


}

run();
