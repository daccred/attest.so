// ============================================================================
// INITIAL SCHEMA DEFINITIONS
// This file contains the SorobanSchemaEncoder definitions for all common schemas.
// ============================================================================

import { Keypair, Transaction } from '@stellar/stellar-sdk';
import { SorobanSchemaEncoder, StellarDataType } from '@attestprotocol/stellar-sdk';
import * as ProtocolContract from '@attestprotocol/stellar-contracts/protocol';
import { writeFileSync } from 'fs';
import { join } from 'path';

const ATTEST_PROTOCOL_CONTRACT_ID = 'CDBWGWEZ3P4DZ3YUZSCEUKOVV2UGF2PYQEPW3E5OKNLYS5SNW4SQLDUA'

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

// --- Identity & Verification ---

const nationalIdSchema = new SorobanSchemaEncoder({
  name: 'National ID',
  description: 'A national identification document.',
  fields: [
    { name: 'is_valid', type: StellarDataType.BOOL },
    { name: 'name', type: StellarDataType.STRING },
    { name: 'nationality', type: StellarDataType.STRING },
    { name: 'issuer', type: StellarDataType.STRING },
    { name: 'expiry', type: StellarDataType.STRING },
  ]
});

const passportSchema = new SorobanSchemaEncoder({
  name: 'Passport',
  description: 'An official passport document.',
  fields: [
    { name: 'is_valid', type: StellarDataType.BOOL },
    { name: 'issuer', type: StellarDataType.STRING },
    { name: 'name', type: StellarDataType.STRING },
    { name: 'expiry', type: StellarDataType.STRING },
  ]
});

const driversLicenseSchema = new SorobanSchemaEncoder({
  name: "Driver's License",
  description: "A driver's license.",
  fields: [
    { name: 'is_valid', type: StellarDataType.BOOL },
    { name: 'name', type: StellarDataType.STRING },
    { name: 'expiry', type: StellarDataType.STRING },
  ]
});

const digitalWalletIdentitySchema = new SorobanSchemaEncoder({
  name: 'Digital Wallet Identity',
  description: 'An identity associated with a digital wallet.',
  fields: [
    { name: 'publicKey', type: StellarDataType.STRING },
    { name: 'controller', type: StellarDataType.STRING },
    { name: 'permissions', type: StellarDataType.STRING }, // Expected to be JSON string array
  ]
});

const biometricAuthSchema = new SorobanSchemaEncoder({
  name: 'Biometric Authentication',
  description: 'An attestation of a biometric authentication event.',
  fields: [
    { name: 'type', type: StellarDataType.STRING },
    { name: 'accuracy', type: StellarDataType.U64 },
    { name: 'device', type: StellarDataType.STRING },
    { name: 'timestamp', type: StellarDataType.STRING },
    { name: 'liveness', type: StellarDataType.U64 },
  ]
});

const ageVerificationSchema = new SorobanSchemaEncoder({
  name: 'Age Verification',
  description: 'Verification of age thresholds.',
  fields: [
    { name: 'isOver18', type: StellarDataType.BOOL },
    { name: 'isOver21', type: StellarDataType.BOOL },
    { name: 'isOver65', type: StellarDataType.BOOL },
    { name: 'attestor_did', type: StellarDataType.STRING },
    { name: 'valid_until', type: StellarDataType.STRING },
    { name: 'jurisdiction', type: StellarDataType.STRING },
  ]
});

const trustScoreSchema = new SorobanSchemaEncoder({
  name: 'Trust Score',
  description: 'A composite trust score from various sources.',
  fields: [
    { name: 'subject', type: StellarDataType.STRING },
    { name: 'score', type: StellarDataType.U64 },
    { name: 'sources', type: StellarDataType.STRING }, // Expected to be JSON string array
    { name: 'updated', type: StellarDataType.STRING },
  ]
});

const backgroundCheckSchema = new SorobanSchemaEncoder({
  name: 'Background Check',
  description: 'Results of a background check.',
  fields: [
    { name: 'subject', type: StellarDataType.STRING },
    { name: 'has_criminal_record', type: StellarDataType.BOOL },
    { name: 'jurisdictions', type: StellarDataType.STRING }, // Expected to be JSON string array
    { name: 'employed', type: StellarDataType.BOOL },
    { name: 'education', type: StellarDataType.BOOL },
    { name: 'has_credit_history', type: StellarDataType.BOOL },
    { name: 'completed', type: StellarDataType.STRING },
    { name: 'valid_for', type: StellarDataType.U32 },
  ]
});

const multiFactorAuthenticationSchema = new SorobanSchemaEncoder({
  name: 'Multi-Factor Authentication',
  description: 'Attestation of a successful multi-factor authentication event.',
  fields: [
    { name: 'session', type: StellarDataType.STRING },
    { name: 'factors', type: StellarDataType.STRING }, // Expected to be JSON string array
    { name: 'completed_at', type: StellarDataType.STRING },
    { name: 'risk', type: StellarDataType.U64 },
    { name: 'ip', type: StellarDataType.STRING },
  ]
});

// --- Education & Credentials ---

const bachelorsDegreeSchema = new SorobanSchemaEncoder({
  name: "Bachelor's Degree",
  description: "A bachelor's degree credential.",
  fields: [
    { name: 'degree', type: StellarDataType.STRING },
    { name: 'major', type: StellarDataType.STRING },
    { name: 'institution', type: StellarDataType.STRING },
    { name: 'year', type: StellarDataType.STRING },
    { name: 'gpa', type: StellarDataType.U32 },
    { name: 'transcript_hash', type: StellarDataType.STRING },
  ]
});

const mastersDegreeSchema = new SorobanSchemaEncoder({
  name: "Master's Degree",
  description: "A master's degree credential.",
  fields: [
    { name: 'degree', type: StellarDataType.STRING },
    { name: 'institution', type: StellarDataType.STRING },
    { name: 'thesis', type: StellarDataType.STRING },
    { name: 'year', type: StellarDataType.STRING },
    { name: 'gpa', type: StellarDataType.U32 },
    { name: 'credits', type: StellarDataType.U32 },
  ]
});

const phdSchema = new SorobanSchemaEncoder({
  name: 'Doctor of Philosophy (PhD)',
  description: 'A PhD credential.',
  fields: [
    { name: 'degree', type: StellarDataType.STRING },
    { name: 'field', type: StellarDataType.STRING },
    { name: 'institution', type: StellarDataType.STRING },
    { name: 'year', type: StellarDataType.STRING },
    { name: 'dissertation', type: StellarDataType.STRING },
    { name: 'num_publications', type: StellarDataType.U32 },
  ]
});

const itCertificationSchema = new SorobanSchemaEncoder({
  name: 'IT Certification',
  description: 'An information technology certification.',
  fields: [
    { name: 'certification', type: StellarDataType.STRING },
    { name: 'issuer', type: StellarDataType.STRING },
    { name: 'id', type: StellarDataType.STRING },
    { name: 'year', type: StellarDataType.STRING },
    { name: 'expiry', type: StellarDataType.STRING },
    { name: 'score', type: StellarDataType.U32 },
  ]
});

const skillBadgeSchema = new SorobanSchemaEncoder({
  name: 'Skill Badge',
  description: 'A badge representing a specific skill.',
  fields: [
    { name: 'skill', type: StellarDataType.STRING },
    { name: 'category', type: StellarDataType.STRING },
    { name: 'id', type: StellarDataType.STRING },
    { name: 'year', type: StellarDataType.STRING },
    { name: 'score', type: StellarDataType.U32 },
  ]
});

const courseCompletionSchema = new SorobanSchemaEncoder({
  name: 'Course Completion',
  description: 'Completion of an academic or professional course.',
  fields: [
    { name: 'course', type: StellarDataType.STRING },
    { name: 'institution', type: StellarDataType.STRING },
    { name: 'instructor', type: StellarDataType.STRING },
    { name: 'year', type: StellarDataType.STRING },
    { name: 'grade', type: StellarDataType.STRING },
    { name: 'credits', type: StellarDataType.U32 },
    { name: 'score', type: StellarDataType.U32 },
  ]
});

const languageProficiencySchema = new SorobanSchemaEncoder({
  name: 'Language Proficiency',
  description: 'Proficiency in a spoken or written language.',
  fields: [
    { name: 'language', type: StellarDataType.STRING },
    { name: 'framework', type: StellarDataType.STRING },
    { name: 'id', type: StellarDataType.STRING },
    { name: 'level', type: StellarDataType.STRING },
    { name: 'issuer', type: StellarDataType.STRING },
    { name: 'year', type: StellarDataType.STRING },
    { name: 'score', type: StellarDataType.U32 },
  ]
});

const academicTranscriptSchema = new SorobanSchemaEncoder({
  name: 'Academic Transcript',
  description: 'An academic transcript from an institution.',
  fields: [
    { name: 'institution', type: StellarDataType.STRING },
    { name: 'program', type: StellarDataType.STRING },
    { name: 'year', type: StellarDataType.STRING },
    { name: 'gpa', type: StellarDataType.U32 },
    { name: 'credits', type: StellarDataType.U32 },
    { name: 'status', type: StellarDataType.STRING },
  ]
});

// --- Professional ---

const professionalLicenseSchema = new SorobanSchemaEncoder({
  name: 'Professional License',
  description: 'A professional license for a specific field.',
  fields: [
    { name: 'license', type: StellarDataType.STRING },
    { name: 'profession', type: StellarDataType.STRING },
    { name: 'id', type: StellarDataType.STRING },
    { name: 'issuer', type: StellarDataType.STRING },
    { name: 'year', type: StellarDataType.STRING },
    { name: 'expiry', type: StellarDataType.STRING },
    { name: 'status', type: StellarDataType.STRING },
  ]
});

const industryCertificationSchema = new SorobanSchemaEncoder({
  name: 'Industry Certification',
  description: 'A certification for a specific industry.',
  fields: [
    { name: 'certification', type: StellarDataType.STRING },
    { name: 'industry', type: StellarDataType.STRING },
    { name: 'id', type: StellarDataType.STRING },
    { name: 'year', type: StellarDataType.STRING },
    { name: 'expiry', type: StellarDataType.STRING },
    { name: 'score', type: StellarDataType.U32 },
  ]
});

const competencyAssessmentSchema = new SorobanSchemaEncoder({
  name: 'Competency Assessment',
  description: 'An assessment of a specific competency.',
  fields: [
    { name: 'competency', type: StellarDataType.STRING },
    { name: 'level', type: StellarDataType.STRING },
    { name: 'assessor', type: StellarDataType.STRING },
    { name: 'year', type: StellarDataType.STRING },
    { name: 'score', type: StellarDataType.U32 },
  ]
});

const employeeIDSchema = new SorobanSchemaEncoder({
  name: 'Employee ID',
  description: 'An employee identification record.',
  fields: [
    { name: 'id', type: StellarDataType.STRING },
    { name: 'name', type: StellarDataType.STRING },
    { name: 'department', type: StellarDataType.STRING },
    { name: 'title', type: StellarDataType.STRING },
    { name: 'start_date', type: StellarDataType.STRING },
    { name: 'status', type: StellarDataType.STRING },
  ]
});

// --- Technology & Security ---

const codeSigningSchema = new SorobanSchemaEncoder({
  name: 'Code Signing',
  description: 'A signature for a software artifact.',
  fields: [
    { name: 'artifact_hash', type: StellarDataType.STRING },
    { name: 'signer', type: StellarDataType.STRING },
    { name: 'timestamp', type: StellarDataType.STRING },
    { name: 'repository', type: StellarDataType.STRING },
  ]
});

const sbomSchema = new SorobanSchemaEncoder({
  name: 'Software Bill of Materials (SBOM)',
  description: 'A list of components in a piece of software.',
  fields: [
    { name: 'package', type: StellarDataType.STRING },
    { name: 'version', type: StellarDataType.STRING },
    { name: 'supplier', type: StellarDataType.STRING },
    { name: 'has_vulnerabilities', type: StellarDataType.BOOL },
    { name: 'integrity_hash', type: StellarDataType.STRING },
  ]
});

const hardwareAttestationSchema = new SorobanSchemaEncoder({
  name: 'Hardware Attestation',
  description: 'An attestation of hardware integrity.',
  fields: [
    { name: 'device_id', type: StellarDataType.STRING },
    { name: 'manufacturer', type: StellarDataType.STRING },
    { name: 'model', type: StellarDataType.STRING },
    { name: 'hardware_hash', type: StellarDataType.STRING },
    { name: 'secure_boot', type: StellarDataType.BOOL },
    { name: 'tmp_present', type: StellarDataType.BOOL },
  ]
});

const apiSecuritySchema = new SorobanSchemaEncoder({
  name: 'API Security',
  description: 'Security parameters for an API endpoint.',
  fields: [
    { name: 'endpoint', type: StellarDataType.STRING },
    { name: 'version', type: StellarDataType.STRING },
    { name: 'authentication', type: StellarDataType.STRING },
    { name: 'encryption', type: StellarDataType.STRING },
    { name: 'audit', type: StellarDataType.STRING },
    { name: 'compliance', type: StellarDataType.STRING }, // Expected to be JSON string array
  ]
});

const vulnerabilityAssessmentSchema = new SorobanSchemaEncoder({
  name: 'Vulnerability Assessment',
  description: 'Results of a security vulnerability scan.',
  fields: [
    { name: 'target', type: StellarDataType.STRING },
    { name: 'scan_date', type: StellarDataType.STRING },
    { name: 'has_vulnerabilities', type: StellarDataType.BOOL },
    { name: 'risk_score', type: StellarDataType.U64 },
    { name: 'pci_compliant', type: StellarDataType.BOOL },
  ]
});

const oauthServiceSchema = new SorobanSchemaEncoder({
  name: 'OAuth Service',
  description: 'Details of an OAuth service provider.',
  fields: [
    { name: 'provider', type: StellarDataType.STRING },
    { name: 'protocol', type: StellarDataType.STRING },
    { name: 'security', type: StellarDataType.STRING }, // Expected to be JSON string array
    { name: 'audit', type: StellarDataType.BOOL },
    { name: 'mfa', type: StellarDataType.BOOL },
  ]
});

const slaSchema = new SorobanSchemaEncoder({
  name: 'Service Level Agreement (SLA)',
  description: 'A service level agreement.',
  fields: [
    { name: 'service', type: StellarDataType.STRING },
    { name: 'provider', type: StellarDataType.STRING },
    { name: 'agreement', type: StellarDataType.STRING },
    { name: 'uptime', type: StellarDataType.U64 },
    { name: 'backup', type: StellarDataType.STRING },
    { name: 'regions', type: StellarDataType.STRING }, // Expected to be JSON string array
  ]
});

const contentProvenanceSchema = new SorobanSchemaEncoder({
  name: 'Content Provenance',
  description: 'The origin and history of a piece of content.',
  fields: [
    { name: 'content', type: StellarDataType.STRING },
    { name: 'original_source', type: StellarDataType.STRING },
    { name: 'timestamp', type: StellarDataType.STRING },
    { name: 'digital_signature', type: StellarDataType.STRING },
    { name: 'integrity_hash', type: StellarDataType.STRING },
  ]
});

// --- Civic & Public Service ---

const voterEligibilitySchema = new SorobanSchemaEncoder({
  name: 'Voter Eligibility',
  description: 'Eligibility to vote in an election.',
  fields: [
    { name: 'id', type: StellarDataType.STRING },
    { name: 'is_eligible', type: StellarDataType.BOOL },
    { name: 'residency', type: StellarDataType.BOOL },
    { name: 'citizenship', type: StellarDataType.BOOL },
    { name: 'precinct', type: StellarDataType.STRING },
    { name: 'expiry', type: StellarDataType.STRING },
  ]
});

const publicServiceVerificationSchema = new SorobanSchemaEncoder({
  name: 'Public Service Verification',
  description: 'Verification of a public service.',
  fields: [
    { name: 'service', type: StellarDataType.STRING },
    { name: 'authority', type: StellarDataType.STRING },
    { name: 'service_type', type: StellarDataType.STRING },
    { name: 'group', type: StellarDataType.STRING },
    { name: 'verification_date', type: StellarDataType.STRING },
    { name: 'audit_report', type: StellarDataType.STRING },
    { name: 'compliance_status', type: StellarDataType.STRING },
  ]
});

// --- Institutional ---

const institutionalAccreditationSchema = new SorobanSchemaEncoder({
  name: 'Institutional Accreditation',
  description: 'Accreditation status of an institution.',
  fields: [
    { name: 'id', type: StellarDataType.STRING },
    { name: 'institution', type: StellarDataType.STRING },
    { name: 'accreditor', type: StellarDataType.STRING },
    { name: 'level', type: StellarDataType.STRING },
    { name: 'issue_date', type: StellarDataType.STRING },
    { name: 'expiry_date', type: StellarDataType.STRING },
    { name: 'on_probation', type: StellarDataType.BOOL },
  ]
});

const governanceAuditSchema = new SorobanSchemaEncoder({
  name: 'Governance Audit',
  description: 'An audit of organizational governance.',
  fields: [
    { name: 'organization', type: StellarDataType.STRING },
    { name: 'audit_type', type: StellarDataType.STRING },
    { name: 'auditor', type: StellarDataType.STRING },
    { name: 'audit_year', type: StellarDataType.STRING },
    { name: 'governance_framework', type: StellarDataType.STRING },
  ]
});

const partnershipAgreementSchema = new SorobanSchemaEncoder({
  name: 'Partnership Agreement',
  description: 'An agreement between two or more parties.',
  fields: [
    { name: 'id', type: StellarDataType.STRING },
    { name: 'parties', type: StellarDataType.STRING }, // Expected to be JSON string array
    { name: 'type', type: StellarDataType.STRING },
    { name: 'effective_date', type: StellarDataType.STRING },
    { name: 'expiry_date', type: StellarDataType.STRING },
    { name: 'ip_ownership', type: StellarDataType.STRING },
  ]
});

const publicServiceQualitySchema = new SorobanSchemaEncoder({
  name: 'Public Service Quality',
  description: 'Quality metrics for a public service.',
  fields: [
    { name: 'id', type: StellarDataType.STRING },
    { name: 'agency', type: StellarDataType.STRING },
    { name: 'service', type: StellarDataType.STRING },
    { name: 'satisfaction_score', type: StellarDataType.U64 },
    { name: 'ada_compliant', type: StellarDataType.BOOL },
    { name: 'audit_date', type: StellarDataType.STRING },
  ]
});

// --- Financial Services ---

const creditAssessmentSchema = new SorobanSchemaEncoder({
  name: 'Credit Assessment',
  description: 'An assessment of creditworthiness.',
  fields: [
    { name: 'applicant', type: StellarDataType.STRING },
    { name: 'lender', type: StellarDataType.STRING },
    { name: 'timestamp', type: StellarDataType.STRING },
    { name: 'credit_score', type: StellarDataType.U32 },
    { name: 'scoring_model', type: StellarDataType.STRING },
  ]
});

const altCreditScoreSchema = new SorobanSchemaEncoder({
  name: 'Alternative Credit Score',
  description: 'A credit score based on alternative data.',
  fields: [
    { name: 'id', type: StellarDataType.STRING },
    { name: 'provider', type: StellarDataType.STRING },
    { name: 'score', type: StellarDataType.U32 },
    { name: 'data_sources', type: StellarDataType.STRING }, // Expected to be JSON string array
  ]
});

const amlTransactionMonitoringSchema = new SorobanSchemaEncoder({
  name: 'AML Transaction Monitoring',
  description: 'Anti-Money Laundering transaction monitoring alert.',
  fields: [
    { name: 'id', type: StellarDataType.STRING },
    { name: 'transaction_id', type: StellarDataType.STRING },
    { name: 'risk_score', type: StellarDataType.U64 },
    { name: 'sar_filing_required', type: StellarDataType.BOOL },
    { name: 'status', type: StellarDataType.STRING },
  ]
});

const investmentAdvisorSchema = new SorobanSchemaEncoder({
  name: 'Investment Advisor',
  description: 'Registration and status of an investment advisor.',
  fields: [
    { name: 'id', type: StellarDataType.STRING },
    { name: 'firm', type: StellarDataType.STRING },
    { name: 'advisor', type: StellarDataType.STRING },
    { name: 'is_licensed', type: StellarDataType.BOOL },
    { name: 'has_disciplinary_history', type: StellarDataType.BOOL },
    { name: 'aum', type: StellarDataType.U64 },
  ]
});

const insuranceClaimSchema = new SorobanSchemaEncoder({
  name: 'Insurance Claim',
  description: 'Details of an insurance claim.',
  fields: [
    { name: 'id', type: StellarDataType.STRING },
    { name: 'policy_id', type: StellarDataType.STRING },
    { name: 'type', type: StellarDataType.STRING },
    { name: 'claimed_amount', type: StellarDataType.U64 },
    { name: 'settled_amount', type: StellarDataType.U64 },
    { name: 'is_approved', type: StellarDataType.BOOL },
  ]
});

const crossBorderPaymentSchema = new SorobanSchemaEncoder({
  name: 'Cross-Border Payment',
  description: 'Details of a cross-border payment.',
  fields: [
    { name: 'id', type: StellarDataType.STRING },
    { name: 'sender_country', type: StellarDataType.STRING },
    { name: 'receiver_country', type: StellarDataType.STRING },
    { name: 'amount', type: StellarDataType.U64 },
    { name: 'currency', type: StellarDataType.STRING },
    { name: 'sanctions_clear', type: StellarDataType.BOOL },
  ]
});

const esgReportingSchema = new SorobanSchemaEncoder({
  name: 'ESG Reporting',
  description: 'Environmental, Social, and Governance (ESG) reporting data.',
  fields: [
    { name: 'id', type: StellarDataType.STRING },
    { name: 'organization', type: StellarDataType.STRING },
    { name: 'year', type: StellarDataType.U32 },
    { name: 'framework', type: StellarDataType.STRING },
    { name: 'net_zero_target', type: StellarDataType.STRING },
    { name: 'third_party_verified', type: StellarDataType.BOOL },
  ]
});

const financialAuditSchema = new SorobanSchemaEncoder({
  name: 'Financial Audit',
  description: 'Results of a financial audit.',
  fields: [
    { name: 'entity', type: StellarDataType.STRING },
    { name: 'audit_firm', type: StellarDataType.STRING },
    { name: 'audit_type', type: StellarDataType.STRING },
    { name: 'id', type: StellarDataType.STRING },
    { name: 'fiscal_year', type: StellarDataType.U32 },
    { name: 'verdict', type: StellarDataType.STRING },
  ]
});

const complianceAuditSchema = new SorobanSchemaEncoder({
  name: 'Compliance Audit',
  description: 'Results of a compliance audit.',
  fields: [
    { name: 'organization', type: StellarDataType.STRING },
    { name: 'regulatory_framework', type: StellarDataType.STRING },
    { name: 'regulator', type: StellarDataType.STRING },
    { name: 'audit_date', type: StellarDataType.STRING },
    { name: 'verdict', type: StellarDataType.STRING },
  ]
});

const incomeStatementSchema = new SorobanSchemaEncoder({
  name: 'Income Statement',
  description: 'A summary of income and expenses.',
  fields: [
    { name: 'entity', type: StellarDataType.STRING },
    { name: 'timestamp', type: StellarDataType.STRING },
    { name: 'credit', type: StellarDataType.U64 },
    { name: 'debit', type: StellarDataType.U64 },
    { name: 'balance', type: StellarDataType.I64 },
  ]
});

// --- AI, LLMs & AI Agents ---

const modelTrainingProvenanceSchema = new SorobanSchemaEncoder({
  name: 'Model Training Provenance',
  description: 'Provenance data for an AI model training process.',
  fields: [
    { name: 'model', type: StellarDataType.STRING },
    { name: 'version', type: StellarDataType.STRING },
    { name: 'dataset', type: StellarDataType.STRING },
    { name: 'data_provenance_verified', type: StellarDataType.BOOL },
    { name: 'dataset_license', type: StellarDataType.STRING },
  ]
});

const aiSafetyCertificationSchema = new SorobanSchemaEncoder({
  name: 'AI Safety Certification',
  description: 'Certification of AI model safety.',
  fields: [
    { name: 'model_id', type: StellarDataType.STRING },
    { name: 'certifier', type: StellarDataType.STRING },
    { name: 'framework', type: StellarDataType.STRING },
    { name: 'evaluation_date', type: StellarDataType.STRING },
    { name: 'level', type: StellarDataType.STRING },
  ]
});

const biasAuditSchema = new SorobanSchemaEncoder({
  name: 'AI Bias Audit',
  description: 'Results of an AI bias audit.',
  fields: [
    { name: 'model_id', type: StellarDataType.STRING },
    { name: 'audit_date', type: StellarDataType.STRING },
    { name: 'auditor', type: StellarDataType.STRING },
    { name: 'eu_ai_act_compliant', type: StellarDataType.BOOL },
    { name: 'nyc_law_144_compliant', type: StellarDataType.BOOL },
  ]
});

const aiGeneratedContentSchema = new SorobanSchemaEncoder({
  name: 'AI Generated Content',
  description: 'Attestation for AI-generated content.',
  fields: [
    { name: 'content', type: StellarDataType.STRING },
    { name: 'type', type: StellarDataType.STRING },
    { name: 'model', type: StellarDataType.STRING },
    { name: 'timestamp', type: StellarDataType.STRING },
    { name: 'prompt', type: StellarDataType.STRING },
    { name: 'is_ai_generated', type: StellarDataType.BOOL },
    { name: 'confidence', type: StellarDataType.U64 },
  ]
});

const agentCapabilitySchema = new SorobanSchemaEncoder({
  name: 'AI Agent Capability',
  description: 'Capabilities and limitations of an AI agent.',
  fields: [
    { name: 'agent_id', type: StellarDataType.STRING },
    { name: 'capabilities', type: StellarDataType.STRING }, // Expected to be JSON string array
    { name: 'limitations', type: StellarDataType.STRING }, // Expected to be JSON string array
    { name: 'accuracy', type: StellarDataType.U64 },
  ]
});

const modelInterpretabilitySchema = new SorobanSchemaEncoder({
  name: 'Model Interpretability',
  description: 'Interpretability data for an AI model prediction.',
  fields: [
    { name: 'model_id', type: StellarDataType.STRING },
    { name: 'prediction_id', type: StellarDataType.STRING },
    { name: 'explanation_method', type: StellarDataType.STRING },
    { name: 'confidence', type: StellarDataType.U64 },
  ]
});

const trainingConsentSchema = new SorobanSchemaEncoder({
  name: 'Training Consent',
  description: 'Consent for data to be used in AI model training.',
  fields: [
    { name: 'id', type: StellarDataType.STRING },
    { name: 'subject', type: StellarDataType.STRING },
    { name: 'purpose', type: StellarDataType.STRING },
    { name: 'consent_method', type: StellarDataType.STRING },
    { name: 'gdpr_basis', type: StellarDataType.STRING },
  ]
});

const trainingDataQualitySchema = new SorobanSchemaEncoder({
  name: 'Training Data Quality',
  description: 'Quality metrics for AI training data.',
  fields: [
    { name: 'dataset', type: StellarDataType.STRING },
    { name: 'quality_score', type: StellarDataType.U64 },
    { name: 'gdpr_compliant', type: StellarDataType.BOOL },
    { name: 'consent', type: StellarDataType.STRING },
    { name: 'last_audited', type: StellarDataType.STRING },
  ]
});

const deepfakeDetectionSchema = new SorobanSchemaEncoder({
  name: 'Deepfake Detection',
  description: 'Results of a deepfake detection analysis.',
  fields: [
    { name: 'media', type: StellarDataType.STRING },
    { name: 'type', type: StellarDataType.STRING },
    { name: 'model', type: StellarDataType.STRING },
    { name: 'timestamp', type: StellarDataType.STRING },
    { name: 'confidence', type: StellarDataType.U64 },
    { name: 'risk_level', type: StellarDataType.STRING },
  ]
});

// --- AI Agent Permissions ---

const tradingAgentPermissionSchema = new SorobanSchemaEncoder({
  name: 'Trading Agent Permission',
  description: 'Permissions for an automated trading agent.',
  fields: [
    { name: 'agent_id', type: StellarDataType.STRING },
    { name: 'principal', type: StellarDataType.STRING },
    { name: 'max_trade_value', type: StellarDataType.U64 },
    { name: 'daily_limit', type: StellarDataType.U64 },
    { name: 'asset_classes', type: StellarDataType.STRING }, // Expected to be JSON string array
  ]
});

const shoppingAgentPermissionSchema = new SorobanSchemaEncoder({
  name: 'Shopping Agent Permission',
  description: 'Permissions for an automated shopping agent.',
  fields: [
    { name: 'agent_id', type: StellarDataType.STRING },
    { name: 'principal', type: StellarDataType.STRING },
    { name: 'daily_spend_limit', type: StellarDataType.U32 },
    { name: 'monthly_budget', type: StellarDataType.U32 },
    { name: 'merchant_whitelist', type: StellarDataType.STRING }, // Expected to be JSON string array
  ]
});

const travelMeetingAgentSchema = new SorobanSchemaEncoder({
  name: 'Travel & Meeting Agent Permission',
  description: 'Permissions for an automated travel and meeting agent.',
  fields: [
    { name: 'agent_id', type: StellarDataType.STRING },
    { name: 'principal', type: StellarDataType.STRING },
    { name: 'can_book_flights', type: StellarDataType.BOOL },
    { name: 'max_flight_cost', type: StellarDataType.U32 },
    { name: 'can_book_hotels', type: StellarDataType.BOOL },
    { name: 'max_hotel_nightly', type: StellarDataType.U32 },
    { name: 'can_attend_meetings', type: StellarDataType.BOOL },
  ]
});

// ============================================================================
// EXPORT ALL SCHEMAS FOR REFERENCE
// ============================================================================

export const categorizedSchemas = {
  identity: {
    name: "Identity & Verification",
    description: "Schemas related to personal identity, authentication, and verification.",
    schemas: [
      { name: 'digitalWalletIdentitySchema', schema: digitalWalletIdentitySchema },
      { name: 'nationalIdSchema', schema: nationalIdSchema },
      { name: 'passportSchema', schema: passportSchema },
      { name: 'biometricAuthSchema', schema: biometricAuthSchema },
      { name: 'ageVerificationSchema', schema: ageVerificationSchema },
      { name: 'trustScoreSchema', schema: trustScoreSchema },
      { name: 'backgroundCheckSchema', schema: backgroundCheckSchema },
      { name: 'multiFactorAuthenticationSchema', schema: multiFactorAuthenticationSchema },
    ]
  },
  education: {
    name: "Education & Credentials",
    description: "Schemas for academic achievements, professional licenses, industry certifications and skills.",
    schemas: [
      { name: 'bachelorsDegreeSchema', schema: bachelorsDegreeSchema },
      { name: 'mastersDegreeSchema', schema: mastersDegreeSchema },
      { name: 'phdSchema', schema: phdSchema },
      { name: 'itCertificationSchema', schema: itCertificationSchema },
      { name: 'skillBadgeSchema', schema: skillBadgeSchema },
      { name: 'professionalLicenseSchema', schema: professionalLicenseSchema },
      { name: 'industryCertificationSchema', schema: industryCertificationSchema },
      { name: 'languageProficiencySchema', schema: languageProficiencySchema },
      { name: 'competencyAssessmentSchema', schema: competencyAssessmentSchema },
      { name: 'employeeIDSchema', schema: employeeIDSchema },
      { name: 'courseCompletionSchema', schema: courseCompletionSchema },
      { name: 'academicTranscriptSchema', schema: academicTranscriptSchema },
    ]
  },
  technology: {
    name: "Technology & Security",
    description: "Schemas for software, hardware, security, and IT infrastructure.",
    schemas: [
      { name: 'codeSigningSchema', schema: codeSigningSchema },
      { name: 'sbomSchema', schema: sbomSchema },
      { name: 'hardwareAttestationSchema', schema: hardwareAttestationSchema },
      { name: 'apiSecuritySchema', schema: apiSecuritySchema },
      { name: 'vulnerabilityAssessmentSchema', schema: vulnerabilityAssessmentSchema },
      { name: 'oauthServiceSchema', schema: oauthServiceSchema },
      { name: 'slaSchema', schema: slaSchema },
      { name: 'contentProvenanceSchema', schema: contentProvenanceSchema },
    ]
  },
  institution: {
    name: "Institutional",
    description: "Schemas for institutional accreditation, Public Service, governance, and agreements.",
    schemas: [
      { name: 'driversLicenseSchema', schema: driversLicenseSchema },
      { name: 'institutionalAccreditationSchema', schema: institutionalAccreditationSchema },
      { name: 'voterEligibilitySchema', schema: voterEligibilitySchema },
      { name: 'publicServiceVerificationSchema', schema: publicServiceVerificationSchema },
      { name: 'governanceAuditSchema', schema: governanceAuditSchema },
      { name: 'esgReportingSchema', schema: esgReportingSchema },
      { name: 'partnershipAgreementSchema', schema: partnershipAgreementSchema },
      { name: 'publicServiceQualitySchema', schema: publicServiceQualitySchema },
    ]
  },
  finance: {
    name: "Finance",
    description: "Schemas for finance, credit, insurance, and regulatory compliance.",
    schemas: [
      { name: 'creditAssessmentSchema', schema: creditAssessmentSchema },
      { name: 'altCreditScoreSchema', schema: altCreditScoreSchema },
      { name: 'amlTransactionMonitoringSchema', schema: amlTransactionMonitoringSchema },
      { name: 'investmentAdvisorSchema', schema: investmentAdvisorSchema },
      { name: 'insuranceClaimSchema', schema: insuranceClaimSchema },
      { name: 'crossBorderPaymentSchema', schema: crossBorderPaymentSchema },
      { name: 'financialAuditSchema', schema: financialAuditSchema },
      { name: 'complianceAuditSchema', schema: complianceAuditSchema },
      { name: 'incomeStatementSchema', schema: incomeStatementSchema },
    ]
  },
  gpt: {
    name: "LLMs & AI Agents",
    description: "Schemas for AI models, training data, safety, and content generation.",
    schemas: [
      { name: 'modelTrainingProvenanceSchema', schema: modelTrainingProvenanceSchema },
      { name: 'aiSafetyCertificationSchema', schema: aiSafetyCertificationSchema },
      { name: 'biasAuditSchema', schema: biasAuditSchema },
      { name: 'aiGeneratedContentSchema', schema: aiGeneratedContentSchema },
      { name: 'agentCapabilitySchema', schema: agentCapabilitySchema },
      { name: 'modelInterpretabilitySchema', schema: modelInterpretabilitySchema },
      { name: 'trainingConsentSchema', schema: trainingConsentSchema },
      { name: 'trainingDataQualitySchema', schema: trainingDataQualitySchema },
      { name: 'tradingAgentPermissionSchema', schema: tradingAgentPermissionSchema },
      { name: 'shoppingAgentPermissionSchema', schema: shoppingAgentPermissionSchema },
      { name: 'travelMeetingAgentSchema', schema: travelMeetingAgentSchema },
      { name: 'deepfakeDetectionSchema', schema: deepfakeDetectionSchema },
    ]
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fundAccountIfNeeded(publicKey: string): Promise<void> {
  try {
    console.log(`Funding account: ${publicKey}`)
    const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`)
    if (!response.ok) {
      console.warn(`Friendbot funding failed for ${publicKey}: ${response.statusText}`)
    } else {
      console.log(`Successfully funded account: ${publicKey}`)
    }
    // Wait a bit for the account to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))
  } catch (error) {
    console.warn(`Error funding account ${publicKey}:`, error)
  }
}

async function registerSchema(
  client: ProtocolContract.Client,
  keypair: Keypair,
  schemaName: string,
  schema: SorobanSchemaEncoder,
  category: string
): Promise<{ name: string; uid: string; category: string } | null> {
  try {
    console.log(`Registering schema: ${schemaName}`)
    
    // Convert schema to JSON string format
    const schemaDefinition = JSON.stringify(schema.getSchema())
    console.log(`Schema definition for ${schemaName}:`, schemaDefinition.substring(0, 100) + '...')
    
    const tx = await client.register({
      caller: keypair.publicKey(),
      schema_definition: schemaDefinition,
      resolver: undefined, // No resolver for these schemas
      revocable: true
    }, {
      fee: 100000, // Reduced from 1,000,000 to 100,000 stroops (0.01 XLM)
      timeoutInSeconds: 60
    })

    console.log(`Transaction created for ${schemaName}, signing and sending...`)
    
    const sent = await tx.signAndSend({
      signTransaction: async (xdr: string) => {
        const transaction = new Transaction(xdr, ProtocolContract.networks.testnet.networkPassphrase)
        transaction.sign(keypair)
        return { signedTxXdr: transaction.toXDR() }
      }
    })

    console.log(`Transaction completed for ${schemaName}`)
    
    // Check if result exists before trying to access it
    if (!sent.result) {
      console.error(`❌ No result returned for schema '${schemaName}' - transaction may have failed`)
      console.log(`Full sent object:`, JSON.stringify(sent, null, 2))
      return null
    }

    const res = sent.result as ProtocolContract.contract.Result<Buffer>
    if (res.isOk()) {
      const schemaUid = res.unwrap()
      const uidHex = schemaUid.toString('hex')
      console.log(`✅ Schema '${schemaName}' registered with UID: ${uidHex}`)
      
      return {
        name: schemaName,
        uid: uidHex,
        category: category
      }
    } else {
      console.error(`❌ Failed to register schema '${schemaName}':`, res.unwrapErr())
      return null
    }
  } catch (error) {
    console.error(`❌ Error registering schema '${schemaName}':`, error)
    // Log more details about the error
    if (error instanceof Error) {
      console.error(`Error message: ${error.message}`)
      console.error(`Error stack: ${error.stack}`)
    }
    return null
  }
}

// ============================================================================
// MAIN FUNCTION - BATCH CREATE SCHEMAS BY CATEGORY
// ============================================================================

async function main() {
  console.log('🚀 Starting schema registration process...')
  
  // Get category to process from command line argument
  const categoryToProcess = process.argv[2]
  const availableCategories = Object.keys(categorizedSchemas)
  
  if (categoryToProcess && !availableCategories.includes(categoryToProcess)) {
    console.error(`❌ Invalid category: ${categoryToProcess}`)
    console.log(`Available categories: ${availableCategories.join(', ')}`)
    process.exit(1)
  }
  
  if (!categoryToProcess) {
    console.log(`📋 Available categories to process:`)
    availableCategories.forEach((cat, index) => {
      const categoryData = categorizedSchemas[cat as keyof typeof categorizedSchemas]
      console.log(`  ${index + 1}. ${cat} - ${categoryData.name} (${categoryData.schemas.length} schemas)`)
    })
    console.log(`\n💡 Usage: npx ts-node init-schema.ts <category>`)
    console.log(`   Example: npx ts-node init-schema.ts identity`)
    return
  }
  
  try {
    // Generate a new keypair
    const keypair = Keypair.random()
    console.log(`Generated keypair: ${keypair.publicKey()}`)
    
    // Fund the account with Friendbot
    await fundAccountIfNeeded(keypair.publicKey())
    
    // Get contract ID from environment or use default testnet deployment
    const protocolContractId =  ATTEST_PROTOCOL_CONTRACT_ID
    const rpcUrl = 'https://soroban-testnet.stellar.org'
    
    console.log(`Using protocol contract: ${protocolContractId}`)
    
    // Create Protocol client
    const protocolClient = new ProtocolContract.Client({
      contractId: protocolContractId,
      networkPassphrase: ProtocolContract.networks.testnet.networkPassphrase,
      rpcUrl: rpcUrl,
      allowHttp: true,
      publicKey: keypair.publicKey()
    })
    
    const results: Array<{ name: string; uid: string; category: string }> = []
    
    // Process the specified category
    const categoryData = categorizedSchemas[categoryToProcess as keyof typeof categorizedSchemas]
    console.log(`\n📂 Processing category: ${categoryData.name}`)
    console.log(`📊 Total schemas in category: ${categoryData.schemas.length}`)
    
    let successCount = 0
    let failCount = 0
    
    for (let i = 0; i < categoryData.schemas.length; i++) {
      const schemaItem = categoryData.schemas[i]
      console.log(`\n[${i + 1}/${categoryData.schemas.length}] Processing: ${schemaItem.name}`)
      
      const result = await registerSchema(
        protocolClient,
        keypair,
        schemaItem.name,
        schemaItem.schema,
        categoryToProcess
      )
      
      if (result) {
        results.push(result)
        successCount++
      } else {
        failCount++
      }
      
      // Add delay between registrations to avoid rate limiting
      if (i < categoryData.schemas.length - 1) {
        console.log(`⏱️  Waiting 3 seconds before next schema...`)
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }
    
    // Save results to category-specific file
    const outputPath = join(__dirname, `schemas-${categoryToProcess}.jsonl`)
    const jsonlContent = results.map(result => JSON.stringify(result)).join('\n')
    writeFileSync(outputPath, jsonlContent, 'utf8')
    
    console.log(`\n✅ Category '${categoryToProcess}' processing complete!`)
    console.log(`📝 Results saved to: ${outputPath}`)
    console.log(`📊 Success: ${successCount}, Failed: ${failCount}, Total: ${categoryData.schemas.length}`)
    console.log(`💰 Account used: ${keypair.publicKey()}`)
    
    if (results.length > 0) {
      console.log(`\n🎉 Successfully registered schemas:`)
      results.forEach(result => {
        console.log(`  • ${result.name}: ${result.uid}`)
      })
    }
    
    if (failCount > 0) {
      console.log(`\n⚠️  ${failCount} schemas failed to register. Check the logs above for details.`)
    }
    
  } catch (error) {
    console.error('❌ Schema registration failed:', error)
    process.exit(1)
  }
}

// Execute the main function
if (require.main === module) {
  main().catch(console.error)
}

export { main }