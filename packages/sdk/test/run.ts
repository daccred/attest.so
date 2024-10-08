import AttestSDK from '../src'


async function run() {
  const secretKey = [
    114, 196, 179, 104, 127, 64, 39, 59, 139, 102, 15, 159, 174, 148, 220, 126, 53, 58, 254, 166,
    162, 119, 252, 77, 119, 61, 64, 44, 131, 150, 23, 36, 220, 229, 29, 142, 145, 8, 143, 3, 124,
    35, 111, 115, 224, 191, 68, 64, 198, 202, 179, 60, 250, 89, 214, 140, 3, 234, 169, 159, 235, 42,
    26, 42,
  ]

  const client = new AttestSDK({
    secretKey,
  })

  const res = await client.schema.register({
    schemaName: 'schema-bean',
    schemaContent: '{"name": "example", "type": "object"}',
  })

  console.log({ res })

  const res2 = await client.schema.fetch(res.data!.toBase58())

  console.log({ res2 })
}

run()
