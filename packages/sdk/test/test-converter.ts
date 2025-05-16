enum DataTypes {
  Bool = 'bool',
  Char = 'char',
  String = 'string',
  Byte = 'byte',
  Int8 = 'int8',
  Int16 = 'int16',
  Int32 = 'int32',
  Int64 = 'int64',
  Uint8 = 'uint8',
  Uint16 = 'uint16',
  Uint32 = 'uint32',
  Uint64 = 'uint64',
  Float = 'float',
  Double = 'double',
  DateTime = 'datetime',
  Timestamp = 'timestamp',
}

const dataTypesMap: Record<string, DataTypes> = {
  b: DataTypes.Bool,
  c: DataTypes.Char,
  s: DataTypes.String,
  by: DataTypes.Byte,
  i8: DataTypes.Int8,
  i16: DataTypes.Int16,
  i32: DataTypes.Int32,
  i64: DataTypes.Int64,
  u8: DataTypes.Uint8,
  u16: DataTypes.Uint16,
  u32: DataTypes.Uint32,
  u64: DataTypes.Uint64,
  f: DataTypes.Float,
  d: DataTypes.Double,
  dt: DataTypes.DateTime,
  ts: DataTypes.Timestamp,
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
function convertToString(obj: Record<string, DataTypes>): string {
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
  'name dsd': DataTypes.String,
  age: DataTypes.Int32,
  5: DataTypes.Bool,
  createdAt: DataTypes.DateTime,
}

const compressed = convertToString(exampleObject)
console.log(compressed)
// ✅ Expected Output: "s name, i32 age, b verified, dt createdAt"

const decompressed = convertToObject(compressed)
console.log(decompressed)
// ✅ Expected Output: { name: 'string', age: 'int32', verified: 'bool', createdAt: 'datetime' }
