/**
 * Test data generation utilities
 */

// Secure random number generation functions using Web Crypto API
const getSecureRandomInt = (min: number, max: number): number => {
  const range = max - min
  const bytes = new Uint32Array(1)
  
  // Use global crypto (available in both Node.js and browsers)
  const crypto = globalThis.crypto
  if (!crypto) {
    throw new Error('Crypto API not available')
  }
  
  crypto.getRandomValues(bytes)
  return min + (bytes[0] % range)
}

const getSecureRandomBytes = (length: number): string => {
  const bytes = new Uint8Array(length)
  
  // Use global crypto (available in both Node.js and browsers)
  const crypto = globalThis.crypto
  if (!crypto) {
    throw new Error('Crypto API not available')
  }
  
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}
import { SchemaDefinition, AttestationDefinition } from '@attestprotocol/core'
import { createTestKeypairs } from './keypairs'

/**
 * Create a test schema definition for development and testing.
 * 
 * @param schemaType - The type of schema to create ('degree', 'identity', 'certification', or 'custom')
 * @param name - Optional name for the schema
 * @returns SchemaDefinition object suitable for testing
 */
export function createTestSchema(
  schemaType: 'degree' | 'identity' | 'certification' | 'employment' | 'custom' = 'identity',
  name?: string
): SchemaDefinition {
  const schemas = {
    degree: {
      name: name || 'university-degree',
      content: JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        title: 'University Degree Attestation',
        description: 'Attestation of university degree completion',
        properties: {
          studentName: {
            type: 'string',
            description: 'Full name of the student'
          },
          university: {
            type: 'string', 
            description: 'Name of the issuing university'
          },
          degree: {
            type: 'string',
            description: 'Type of degree (Bachelor, Master, PhD, etc.)'
          },
          fieldOfStudy: {
            type: 'string',
            description: 'Major or field of study'
          },
          graduationDate: {
            type: 'string',
            format: 'date',
            description: 'Date of graduation (YYYY-MM-DD)'
          },
          gpa: {
            type: 'number',
            minimum: 0,
            maximum: 4,
            description: 'Grade Point Average'
          },
          honors: {
            type: 'string',
            enum: ['summa_cum_laude', 'magna_cum_laude', 'cum_laude', 'none'],
            description: 'Academic honors received'
          }
        },
        required: ['studentName', 'university', 'degree', 'fieldOfStudy', 'graduationDate'],
        additionalProperties: false
      })
    },
    identity: {
      name: name || 'identity-verification',
      content: JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        title: 'Identity Verification Attestation',
        description: 'Attestation of identity verification completion',
        properties: {
          fullName: {
            type: 'string',
            description: 'Legal full name of the individual'
          },
          dateOfBirth: {
            type: 'string',
            format: 'date',
            description: 'Date of birth (YYYY-MM-DD)'
          },
          nationality: {
            type: 'string',
            description: 'Nationality or citizenship'
          },
          documentType: {
            type: 'string',
            enum: ['passport', 'drivers_license', 'national_id', 'other'],
            description: 'Type of identification document used'
          },
          documentNumber: {
            type: 'string',
            description: 'Document identification number (hashed for privacy)'
          },
          verificationLevel: {
            type: 'string',
            enum: ['basic', 'enhanced', 'premium'],
            description: 'Level of verification performed'
          },
          verificationDate: {
            type: 'string',
            format: 'date-time',
            description: 'When the verification was completed'
          },
          verifiedBy: {
            type: 'string',
            description: 'Entity that performed the verification'
          }
        },
        required: ['fullName', 'dateOfBirth', 'documentType', 'verificationLevel', 'verificationDate', 'verifiedBy'],
        additionalProperties: false
      })
    },
    certification: {
      name: name || 'professional-certification',
      content: JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        title: 'Professional Certification Attestation',
        description: 'Attestation of professional certification or license',
        properties: {
          holderName: {
            type: 'string',
            description: 'Name of the certification holder'
          },
          certificationName: {
            type: 'string',
            description: 'Name of the certification or license'
          },
          issuingOrganization: {
            type: 'string',
            description: 'Organization that issued the certification'
          },
          certificationNumber: {
            type: 'string',
            description: 'Unique certification or license number'
          },
          issueDate: {
            type: 'string',
            format: 'date',
            description: 'Date the certification was issued'
          },
          expirationDate: {
            type: 'string',
            format: 'date',
            description: 'Date the certification expires (if applicable)'
          },
          skillsValidated: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of skills or competencies validated'
          },
          certificationLevel: {
            type: 'string',
            enum: ['entry', 'associate', 'professional', 'expert', 'master'],
            description: 'Level or tier of the certification'
          }
        },
        required: ['holderName', 'certificationName', 'issuingOrganization', 'issueDate'],
        additionalProperties: false
      })
    },
    employment: {
      name: name || 'employment-verification',
      content: JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        title: 'Employment Verification Attestation',
        description: 'Attestation of employment history and status',
        properties: {
          employeeName: {
            type: 'string',
            description: 'Full name of the employee'
          },
          employerName: {
            type: 'string',
            description: 'Name of the employing organization'
          },
          jobTitle: {
            type: 'string',
            description: 'Official job title or position'
          },
          department: {
            type: 'string',
            description: 'Department or division'
          },
          employmentType: {
            type: 'string',
            enum: ['full_time', 'part_time', 'contract', 'internship', 'consultant'],
            description: 'Type of employment'
          },
          startDate: {
            type: 'string',
            format: 'date',
            description: 'Employment start date'
          },
          endDate: {
            type: 'string',
            format: 'date',
            description: 'Employment end date (if applicable)'
          },
          currentlyEmployed: {
            type: 'boolean',
            description: 'Whether the person is currently employed'
          },
          salary: {
            type: 'object',
            properties: {
              amount: { type: 'number' },
              currency: { type: 'string' },
              frequency: { 
                type: 'string',
                enum: ['hourly', 'monthly', 'annually']
              }
            },
            description: 'Salary information (optional)'
          },
          performanceRating: {
            type: 'string',
            enum: ['outstanding', 'exceeds_expectations', 'meets_expectations', 'needs_improvement'],
            description: 'Most recent performance rating'
          }
        },
        required: ['employeeName', 'employerName', 'jobTitle', 'employmentType', 'startDate', 'currentlyEmployed'],
        additionalProperties: false
      })
    },
    custom: {
      name: name || 'custom-schema',
      content: JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        title: 'Custom Attestation Schema',
        description: 'A flexible schema for custom attestations',
        properties: {
          title: {
            type: 'string',
            description: 'Title or name of what is being attested'
          },
          description: {
            type: 'string',
            description: 'Description of the attestation'
          },
          data: {
            type: 'object',
            description: 'Custom data fields'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'When this attestation was created'
          }
        },
        required: ['title', 'description'],
        additionalProperties: true
      })
    }
  }

  return {
    ...schemas[schemaType],
    revocable: true,
    resolver: null,
  }
}

/**
 * Create a test attestation definition for development and testing.
 * 
 * @param schemaUid - The schema UID to attest against
 * @param attestationType - Type of attestation matching the schema types
 * @param subject - The subject address (defaults to test recipient)
 * @param customData - Optional custom data to override defaults
 * @returns AttestationDefinition object suitable for testing
 */
export function createTestAttestation(
  schemaUid: string,
  attestationType: 'degree' | 'identity' | 'certification' | 'employment' | 'custom' = 'identity',
  subject?: string,
  customData?: any
): AttestationDefinition {
  const testKeypairs = createTestKeypairs()
  
  const attestationData = {
    degree: {
      studentName: 'Alice Johnson',
      university: 'Stanford University',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Computer Science',
      graduationDate: '2023-06-15',
      gpa: 3.8,
      honors: 'magna_cum_laude'
    },
    identity: {
      fullName: 'John Smith',
      dateOfBirth: '1990-03-15',
      nationality: 'United States',
      documentType: 'passport',
      documentNumber: 'sha256:a1b2c3d4e5f6...', // Hashed for privacy
      verificationLevel: 'enhanced',
      verificationDate: new Date().toISOString(),
      verifiedBy: 'TrustedVerify Inc.'
    },
    certification: {
      holderName: 'Sarah Chen',
      certificationName: 'AWS Solutions Architect - Professional',
      issuingOrganization: 'Amazon Web Services',
      certificationNumber: 'AWS-SAP-2023-001234',
      issueDate: '2023-09-20',
      expirationDate: '2026-09-20',
      skillsValidated: [
        'Cloud Architecture Design',
        'Security Best Practices',
        'Cost Optimization',
        'Migration Strategies'
      ],
      certificationLevel: 'professional'
    },
    employment: {
      employeeName: 'Michael Rodriguez',
      employerName: 'Tech Innovations LLC',
      jobTitle: 'Senior Software Engineer',
      department: 'Engineering',
      employmentType: 'full_time',
      startDate: '2022-01-15',
      currentlyEmployed: true,
      salary: {
        amount: 150000,
        currency: 'USD',
        frequency: 'annually'
      },
      performanceRating: 'exceeds_expectations'
    },
    custom: {
      title: 'Community Volunteer Recognition',
      description: 'Recognition for outstanding community service',
      data: {
        volunteerName: 'Emma Davis',
        organization: 'Local Food Bank',
        hoursContributed: 120,
        projectsLed: 3,
        impactArea: 'Food Security',
        period: '2023-01-01 to 2023-12-31'
      },
      timestamp: new Date().toISOString()
    }
  }

  // Generate realistic reference based on attestation type
  const referenceMap = {
    degree: `degree_${Date.now()}`,
    identity: `id_verification_${Date.now()}`,
    certification: `cert_${Date.now()}`,
    employment: `employment_${Date.now()}`,
    custom: `custom_${Date.now()}`
  }

  return {
    schemaUid,
    subject: subject || testKeypairs.recipientPublic,
    data: JSON.stringify(customData || attestationData[attestationType]),
    reference: referenceMap[attestationType],
    expirationTime: attestationType === 'certification' ? 
      new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).getTime() : // 3 years for certifications
      null,
    revocable: true,
  }
}

/**
 * Generate realistic test data for different attestation types.
 * 
 * @param type - The type of test data to generate
 * @returns Object containing realistic test data
 */
export function generateRealisticTestData(type: 'degree' | 'identity' | 'certification' | 'employment') {
  const universities = [
    'Stanford University', 'Harvard University', 'MIT', 'UC Berkeley', 
    'Princeton University', 'Yale University', 'Columbia University'
  ]
  
  const companies = [
    'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Tesla', 
    'Stripe', 'Shopify', 'Airbnb', 'Uber', 'Netflix'
  ]
  
  const certifications = [
    { name: 'AWS Solutions Architect - Professional', org: 'Amazon Web Services' },
    { name: 'Google Cloud Professional Cloud Architect', org: 'Google Cloud' },
    { name: 'Certified Kubernetes Administrator', org: 'Cloud Native Computing Foundation' },
    { name: 'Microsoft Azure Solutions Architect Expert', org: 'Microsoft' },
    { name: 'Certified Information Systems Security Professional', org: 'ISC2' }
  ]

  const names = [
    'Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson', 'Emma Brown',
    'Frank Miller', 'Grace Chen', 'Henry Garcia', 'Iris Kumar', 'Jack Rodriguez'
  ]

  const getRandomElement = <T>(array: T[]): T => array[getSecureRandomInt(0, array.length)]
  const getRandomDate = (yearsAgo: number, yearsFuture: number = 0) => {
    const start = new Date()
    start.setFullYear(start.getFullYear() - yearsAgo)
    const end = new Date()
    end.setFullYear(end.getFullYear() + yearsFuture)
    const timeRange = end.getTime() - start.getTime()
    const randomOffset = getSecureRandomInt(0, timeRange + 1)
    return new Date(start.getTime() + randomOffset)
  }

  switch (type) {
    case 'degree':
      return {
        studentName: getRandomElement(names),
        university: getRandomElement(universities),
        degree: getRandomElement(['Bachelor of Science', 'Master of Science', 'Bachelor of Arts', 'Master of Arts', 'PhD']),
        fieldOfStudy: getRandomElement(['Computer Science', 'Engineering', 'Business Administration', 'Psychology', 'Biology']),
        graduationDate: getRandomDate(5, 0).toISOString().split('T')[0],
        gpa: Math.round((getSecureRandomInt(0, 151) / 100 + 2.5) * 100) / 100, // 2.5-4.0 range
        honors: getRandomElement(['summa_cum_laude', 'magna_cum_laude', 'cum_laude', 'none'])
      }

    case 'identity':
      return {
        fullName: getRandomElement(names),
        dateOfBirth: getRandomDate(50, -18).toISOString().split('T')[0], // 18-50 years old
        nationality: getRandomElement(['United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Japan']),
        documentType: getRandomElement(['passport', 'drivers_license', 'national_id']),
        documentNumber: `sha256:${getSecureRandomBytes(8)}...`,
        verificationLevel: getRandomElement(['basic', 'enhanced', 'premium']),
        verificationDate: new Date().toISOString(),
        verifiedBy: getRandomElement(['TrustedVerify Inc.', 'GlobalID Services', 'SecureAuth Solutions'])
      }

    case 'certification':
      const cert = getRandomElement(certifications)
      const issueDate = getRandomDate(2, 0)
      const expirationDate = new Date(issueDate)
      expirationDate.setFullYear(expirationDate.getFullYear() + 3)
      
      return {
        holderName: getRandomElement(names),
        certificationName: cert.name,
        issuingOrganization: cert.org,
        certificationNumber: `${cert.org.replace(/\s+/g, '').toUpperCase()}-${getSecureRandomBytes(3).toUpperCase()}`,
        issueDate: issueDate.toISOString().split('T')[0],
        expirationDate: expirationDate.toISOString().split('T')[0],
        skillsValidated: getRandomElement([
          ['Cloud Architecture', 'Security', 'DevOps'],
          ['Software Development', 'System Design', 'Database Management'],
          ['Project Management', 'Leadership', 'Strategic Planning']
        ]),
        certificationLevel: getRandomElement(['associate', 'professional', 'expert'])
      }

    case 'employment':
      return {
        employeeName: getRandomElement(names),
        employerName: getRandomElement(companies),
        jobTitle: getRandomElement(['Software Engineer', 'Product Manager', 'Data Scientist', 'UX Designer', 'DevOps Engineer']),
        department: getRandomElement(['Engineering', 'Product', 'Design', 'Marketing', 'Operations']),
        employmentType: getRandomElement(['full_time', 'part_time', 'contract']),
        startDate: getRandomDate(3, 0).toISOString().split('T')[0],
        currentlyEmployed: getSecureRandomInt(0, 10) > 2, // 70% currently employed
        salary: {
          amount: getSecureRandomInt(80000, 180001), // $80k-$180k range
          currency: 'USD',
          frequency: 'annually'
        },
        performanceRating: getRandomElement(['outstanding', 'exceeds_expectations', 'meets_expectations'])
      }

    default:
      return {}
  }
}

/**
 * Create multiple test schemas for comprehensive testing.
 * 
 * @returns Array of different schema types for testing
 */
export function createTestSchemaSet(): Array<{ type: string, schema: SchemaDefinition }> {
  return [
    { type: 'degree', schema: createTestSchema('degree') },
    { type: 'identity', schema: createTestSchema('identity') },
    { type: 'certification', schema: createTestSchema('certification') },
    { type: 'employment', schema: createTestSchema('employment') }
  ]
}