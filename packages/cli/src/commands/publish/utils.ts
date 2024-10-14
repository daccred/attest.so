import fs from 'fs'
import path from 'path'
import { logger } from '../../logger'

export const handleJsonFile = async (jsonFile: any) => {
  try {
    const filePath = path.resolve(jsonFile)

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }

    // Check file extension
    if (!filePath.toLowerCase().endsWith('.json')) {
      throw new Error('File must have a .json extension')
    }

    // Read and parse file
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    try {
      const jsonData = JSON.parse(fileContent)

      //   logger.log('Loaded JSON data:', jsonData)

      return jsonData
    } catch (parseError) {
      throw new Error('Invalid JSON format in file')
    }
  } catch (error: any) {
    logger.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

export const checkValidJSONContent = (schema: any): string | null => {
  console.log({ schema })

  // Check for schema
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    return 'Invalid schema: must be an object.'
  }

  // Check for name
  if (typeof schema.name !== 'string') {
    return 'Invalid schema: name is required and must be a string.'
  }

  // Check for type
  if (typeof schema.type !== 'string' || schema.type !== 'object') {
    return 'Invalid schema: type is required and must be "object".'
  }

  // Check for properties
  if (typeof schema.properties !== 'object' || schema.properties === null) {
    return 'Invalid schema: properties is required and must be an object.'
  }

  // Check for required fields
  if (!Array.isArray(schema.required)) {
    return 'Invalid schema: required is required and must be an array.'
  }

  // Validate each property in properties
  for (const key in schema.properties) {
    const property = schema.properties[key]
    if (typeof property !== 'object' || property === null) {
      return `Invalid schema: properties.${key} must be an object.`
    }

    if (typeof property.type !== 'string') {
      return `Invalid schema: properties.${key}.type is required and must be a string.`
    }

    // Additional checks for specific types can be added here if needed
    // For example, checking maxLength for string types
    if (property.type === 'string' && typeof property.maxLength !== 'undefined') {
      if (typeof property.maxLength !== 'number') {
        return `Invalid schema: properties.${key}.maxLength must be a number.`
      }
    }

    if (property.type === 'integer' && typeof property.minimum !== 'undefined') {
      if (typeof property.minimum !== 'number') {
        return `Invalid schema: properties.${key}.minimum must be a number.`
      }
    }
  }

  return null // All checks passed
}
