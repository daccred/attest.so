import { createHash } from 'crypto'

function serializeSchema(schema: object): Uint8Array {
  const schemaString = JSON.stringify(schema)
  const encoder = new TextEncoder()
  return encoder.encode(schemaString)
}

function generateSchemaUID(serializedSchema: Uint8Array): Uint8Array {
  const hash = createHash('sha256')
  hash.update(serializedSchema)
  return new Uint8Array(hash.digest())
}

export function runSerializeSchema(schema: object) {
  const serializedSchema = serializeSchema(schema)
  const schemaUID = generateSchemaUID(serializedSchema)

  return {
    serializedSchema,
    schemaUID,
  }
}
