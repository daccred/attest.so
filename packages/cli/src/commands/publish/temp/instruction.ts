import { PublicKey } from '@solana/web3.js'

export class RegisterSchemaInstructionData {
  instruction: number // Enum variant index, e.g., 0 for RegisterSchema
  schema_definition: Uint8Array
  resolver: PublicKey | number | null
  revocable: boolean

  constructor(instruction: number, schema_definition: Uint8Array, resolver: PublicKey | null | number, revocable: boolean) {
    this.instruction = instruction
    this.schema_definition = schema_definition
    this.resolver = resolver
    this.revocable = revocable
  }
}

// PREFERRED SCHEMA FORMAT
//   export const registerSchemaInstructionSchema1 = new Map<Function, any>([
//     [
//       RegisterSchemaInstructionData,
//       {
//         kind: 'struct',
//         fields: [
//           ['instruction', 'u8'],
//           ['schema_definition', ['u8']],
//            // hoping i could do this but it doesn't work
//           ['resolver', { kind: 'option', type: 'u8;32' }], // Option<[u8;32]>
//           ['revocable', 'u8'],
//         ],
//       },
//     ],
//   ]);


// ACCEPTED BORSH SCHEMA FORMAT
export const registerSchemaInstructionSchema = {
  struct: {
    instruction: 'u8',
    schema_definition: { array: { type: 'u8' }}, 
    revocable: 'bool',
    resolver: 'u8'
  },
}
