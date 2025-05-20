import assert from 'node:assert/strict';
import test from 'node:test';

const DataTypes = {
  Bool: 'bool',
  Char: 'char',
  String: 'string',
  Byte: 'byte',
  Int8: 'int8',
  Int16: 'int16',
  Int32: 'int32',
  Int64: 'int64',
  Uint8: 'uint8',
  Uint16: 'uint16',
  Uint32: 'uint32',
  Uint64: 'uint64',
  Float: 'float',
  Double: 'double',
  DateTime: 'datetime',
  Timestamp: 'timestamp',
};

const dataTypesMap = {
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
};

// Reverse the mapping for full-to-short conversion
const reverseDataTypesMap = Object.fromEntries(
  Object.entries(dataTypesMap).map(([short, full]) => [full, short])
);

/**
 * Converts an object to a compressed string format.
 *
 * @param {Record<string, string>} obj The object to convert.
 * @returns {string} A compressed string representation of the object.
 */
function convertToString(obj) {
  return Object.entries(obj)
    .map(([key, value]) => `${reverseDataTypesMap[value] || value} ${key}`)
    .join(', ');
}

/**
 * Converts a compressed string back to an object.
 *
 * @param {string} str The compressed string (e.g., "s name, i32 age").
 * @returns {Record<string, string>} The reconstructed object.
 */
function convertToObject(str) {
  return Object.fromEntries(
    str.split(', ').map((pair) => {
      const [type, ...nameParts] = pair.split(' ');
      return [nameParts.join(' '), dataTypesMap[type] || type]; // Correctly map types
    })
  );
}

test('convertToString returns expected compressed string', () => {
  const exampleObject = {
    'name dsd': DataTypes.String,
    age: DataTypes.Int32,
    5: DataTypes.Bool,
    createdAt: DataTypes.DateTime,
  };

  const expected = 'b 5, s name dsd, i32 age, dt createdAt';
  assert.equal(convertToString(exampleObject), expected);
});

test('convertToObject reconstructs the original object', () => {
  const compressed = 'b 5, s name dsd, i32 age, dt createdAt';
  const expected = {
    'name dsd': 'string',
    age: 'int32',
    5: 'bool',
    createdAt: 'datetime',
  };

  assert.deepStrictEqual(convertToObject(compressed), expected);
});
