const dataTypesMap: Record<string, string> = {
  b: 'bool',
  c: 'char',
  s: 'string',
  by: 'byte',
  i8: 'int8',
  i16: 'int16',
  i32: 'int32',
  i64: 'int64',
  u8: 'uint8',
  u16: 'uint16',
  u32: 'uint32',
  u64: 'uint64',
  f: 'float',
  d: 'double',
  dt: 'datetime',
  ts: 'timestamp',
}

// Reverse the mapping for full-to-short conversion
const reverseDataTypesMap = Object.fromEntries(
  Object.entries(dataTypesMap).map(([short, full]) => [full, short])
)

/**
 * Converts an object to a compressed string format.
 * @param obj The object to convert.
 * @returns A compressed string representation of the object.
 */
function convertToString(obj: Record<string, string>): string {
  return Object.entries(obj)
    .map(([key, value]) => `${reverseDataTypesMap[value] || value} ${key}`)
    .join(', ')
}

/**
 * Converts a compressed string back to an object.
 * @param str The compressed string (e.g., "s name, i32 age").
 * @returns The reconstructed object.
 */
function convertToObject(str: string): Record<string, string> {
  return Object.fromEntries(
    str.split(', ').map((pair) => {
      const [type, ...nameParts] = pair.split(' ')
      return [nameParts.join(' '), dataTypesMap[type] || type] // Correctly map types
    })
  )
}

// Example Usage
const exampleObject = {
  'name dsd': 'string',
  age: 'int32',
  5: 'bool',
  createdAt: 'datetime',
}

const compressed = convertToString(exampleObject)
console.log(compressed)
// ✅ Expected Output: "s name, i32 age, b verified, dt createdAt"

const decompressed = convertToObject(compressed)
console.log(decompressed)
// ✅ Expected Output: { name: 'string', age: 'int32', verified: 'bool', createdAt: 'datetime' }
