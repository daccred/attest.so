// ============================================================================
// COMPREHENSIVE ATTESTATION SCHEMA CANVAS
// All schemas converted to JavaScript object format
// ============================================================================

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

// --- Identity & Verification ---

const nationalIdSchemaValue = {
  is_valid: true,
  name: "John Smith",
  nationality: "US",
  issuer: "Department of State",
  expiry: "2030-03-15",
};

const passportSchemaValue = {
  is_valid: true,
  issuer: "USA",
  name: "Jane Doe",
  expiry: "2030-01-15",
};

const driversLicenseSchemaValue = {
  is_valid: true,
  name: "Mike Johnson",
  expiry: "2026-12-03",
};

const digitalWalletIdentitySchemaValue = {
  publicKey: "0x742d35Cc6634C0532925a3b8D404C6d86b",
  controller: "did:ethr:0x742d35...",
  permissions: ["read", "write"],
};

const biometricAuthSchemaValue = {
  type: "fingerprint",
  accuracy: 0.9987,
  device: "TouchID-Gen3",
  timestamp: "2024-09-05T09:15:30Z",
  liveness: 0.98,
};

const ageVerificationSchemaValue = {
  isOver18: true,
  isOver21: true,
  isOver65: false,
  attestor_did: "did:web:ageverify.gov",
  valid_until: "2025-03-15",
  jurisdiction: "California"
};

const trustScoreSchemaValue = {
  subject: "did:ethr:0x1234...",
  score: 8.7,
  sources: ["credit-bureau", "linkedin", "github"],
  updated: "2024-09-05T12:00:00Z"
};

const backgroundCheckSchemaValue = {
  subject: "Robert Wilson",
  has_criminal_record: false,
  jurisdictions: ["TX", "CA"],
  employed: true,
  education: true,
  has_credit_history: true,
  completed: "2024-09-01",
  valid_for: 365 // days
};

const multiFactorAuthenticationSchemaValue = {
  session: "sess_abc123xyz",
  factors: ["password", "sms", "biometric"],
  completed_at: "2024-09-05T11:45:22Z",
  risk: 0.15,
  ip: "192.168.1.100"
};

// --- Education & Credentials ---

const bachelorsDegreeSchemaValue = {
  degree: "Bachelor of Science",
  major: "Computer Science",
  institution: "University of Texas at Austin",
  year: "2023",
  gpa: 3.78,
  transcript_hash: "sha256:b8c9d2e3..."
};

const mastersDegreeSchemaValue = {
  degree: "Master of Business Administration",
  institution: "Stanford Graduate School of Business",
  thesis: "AI Impact on Financial Markets",
  year: "2024",
  gpa: 3.92,
  credits: 60
};

const phdSchemaValue = {
  degree: "Doctor of Philosophy",
  field: "Artificial Intelligence",
  institution: "MIT",
  year: "2024",
  dissertation: "Neural Architecture Search for Edge Computing",
  num_publications: 2,
};

const itCertificationSchemaValue = {
  certification: "AWS Certified Solutions Architect",
  issuer: "Amazon Web Services",
  id: "AWS-SAA-123456",
  year: "2024",
  expiry: "2027",
  score: 895,
};

const skillBadgeSchemaValue = {
  skill: "React Development",
  category: "web-development",
  id: "React-123456",
  year: "2024",
  score: 895,
};

const courseCompletionSchemaValue = {
  course: "Machine Learning Fundamentals",
  institution: "University of California Berkeley",
  instructor: "Dr. Andrew Ng",
  year: "2024",
  grade: "A",
  credits: 3.0,
  score: 895,
};

const languageProficiencySchemaValue = {
  language: "Spanish",
  framework: "CEFR",
  id: "DELE-B2-567890",
  level: "B2",
  issuer: "Instituto Cervantes",
  year: "2024",
  score: 78,
};

const academicTranscriptSchemaValue = {
  institution: "Harvard University",
  program: "Computer Science",
  year: "2024",
  gpa: 3.85,
  credits: 128,
  status: "graduated",
};

// --- Professional ---

const professionalLicenseSchemaValue = {
  license: "Registered Nurse",
  profession: "nursing",
  id: "RN-TX-789012",
  issuer: "Texas Board of Nursing",
  year: "2020",
  expiry: "2025",
  status: "active"
};

const industryCertificationSchemaValue = {
  certification: "Project Management Professional",
  industry: "project-management",
  id: "PMP-123456",
  year: "2024",
  expiry: "2027",
  score: 895,
};

const competencyAssessmentSchemaValue = {
  competency: "Data Analysis",
  level: "proficient",
  assessor: "Jane Smith, Senior Analyst",
  year: "2024",
  score: 895,
};

const employeeIDSchemaValue = {
  id: "EMP001234",
  name: "Sarah Chen",
  department: "Engineering",
  title: "Senior Developer",
  start_date: "2022-06-01",
  status: "active"
};

// --- Technology & Security ---

const codeSigningSchemaValue = {
  artifact_hash: "sha256:a1b2c3d4e5f6...",
  signer: "dev@company.com",
  timestamp: "2024-09-05T14:30:00Z",
  repository: "github.com/company/app",
};

const sbomSchemaValue = {
  package: "web-app-v2.1.0",
  version: "2.1.0",
  supplier: "TechCorp Inc",
  has_vulnerabilities: true,
  integrity_hash: "sha512:abc123...",
};

const hardwareAttestationSchemaValue = {
  device_id: "TPM-DEV-789012",
  manufacturer: "Dell Technologies",
  model: "OptiPlex 7090",
  hardware_hash: "sha256:d4e5f6a7b8c9...",
  secure_boot: true,
  tpm_present: true,
};

const apiSecuritySchemaValue = {
  endpoint: "https://api.company.com/v2/users",
  version: "2.1.0",
  authentication: "OAuth2-PKCE",
  encryption: "TLS-1.3",
  audit: "2024-08-01",
  compliance: ["SOC2", "GDPR"],
};

const vulnerabilityAssessmentSchemaValue = {
  target: "web-app-production",
  scan_date: "2024-09-01T02:00:00Z",
  has_vulnerabilities: true,
  risk_score: 7.2,
  pci_compliant: false,
};

const oauthServiceSchemaValue = {
  provider: "auth0-prod-001",
  protocol: "OAuth2.1",
  security: ["JWKS-rotation", "token-binding"],
  audit: true,
  mfa: true
};

const slaSchemaValue = {
  service: "Cloud Database Service",
  provider: "AWS RDS",
  agreement: "enterprise",
  uptime: 99.95,
  backup: "daily",
  regions: ["US", "EU"],
};

const contentProvenanceSchemaValue = {
  content: "NEWS-PHOTO-20240905-789",
  original_source: "Reuters-Photographer-License-123",
  timestamp: "2024-09-05T12:15:30Z",
  digital_signature: "RSA-4096:MIIEvgIBADANBgkq...",
  integrity_hash: "sha256:f7e8d9c0...",
};

// --- Civic & Public Service --- //

const voterEligibilitySchemaValue = {
  id: "VTR123456789",
  is_eligible: true,
  residency: true,
  citizenship: false,
  precinct: "P-001-TX",
  expiry: "2026-11-01"
};

const publicServiceVerificationSchemaValue = {
  service: "Free School Meals Program",
  authority: "Ministry of Education",
  service_type: "education-support",
  group: "low-income-students",
  verification_date: "2024-08-01",
  audit_report: "https://domain.com/audit-report.pdf",
  compliance_status: "verified",
};

// --- Institutional ---

const institutionalAccreditationSchemaValue = {
  id: "INST-UT-AUSTIN-001",
  institution: "University of Texas at Austin",
  accreditor: "SACS",
  level: "full",
  issue_date: "2020-06-15",
  expiry_date: "2030-06-15",
  on_probation: false,
};

const governanceAuditSchemaValue = {
  organization: "TechCorp Inc",
  audit_type: "governance-effectiveness",
  auditor: "Deloitte & Touche LLP",
  audit_year: "2024",
  governance_framework: "NYSE-Listed-Company-Manual",
};

const partnershipAgreementSchemaValue = {
  id: "PARTNER-2024-MIT-IBM-AI-001",
  parties: ["MIT", "IBM"],
  type: "research-collaboration",
  effective_date: "2024-01-15",
  expiry_date: "2029-01-15",
  ip_ownership: "shared-ownership",
};

const publicServiceQualitySchemaValue = {
  id: "SVC-DMV-LICENSE-RENEWAL-001",
  agency: "DMV",
  service: "Driver License Renewal",
  satisfaction_score: 4.2,
  ada_compliant: true,
  audit_date: "2024-08-01",
};

// --- Financial Services ---

const creditAssessmentSchemaValue = {
  applicant: "APPL-789012345",
  lender: "First National Bank",
  timestamp: "2024-09-05T10:30:00Z",
  credit_score: 742,
  scoring_model: "FICO-Score-10T",
};

const altCreditScoreSchemaValue = {
  id: "ALT-SCORE-20240905-111222",
  provider: "FinTech Credit Analytics",
  score: 678,
  data_sources: ["utility-payments", "rent-payments"],
};

const amlTransactionMonitoringSchemaValue = {
  id: "AML-MON-20240905-789012",
  transaction_id: "TXN-987654321",
  risk_score: 8.7,
  sar_filing_required: true,
  status: "under-review",
};

const investmentAdvisorSchemaValue = {
  id: "IA-REG-456789123",
  firm: "Wealth Management Partners LLC",
  advisor: "Sarah Thompson CFA",
  is_licensed: true,
  has_disciplinary_history: false,
  aum: 250000000,
};

const insuranceClaimSchemaValue = {
  id: "CLAIM-AUTO-20240905-123456",
  policy_id: "POL-789012345",
  type: "auto-collision",
  claimed_amount: 15000,
  settled_amount: 11500,
  is_approved: true,
};

const crossBorderPaymentSchemaValue = {
  id: "XBORDER-PAY-20240905-456789",
  sender_country: "USA",
  receiver_country: "Germany",
  amount: 250000,
  currency: "USD",
  sanctions_clear: true,
};

const esgReportingSchemaValue = {
  id: "ESG-REPORT-2024-TECHCORP-001",
  organization: "TechCorp Inc",
  year: 2024,
  framework: "GRI-Standards",
  net_zero_target: "2035",
  third_party_verified: true,
};

const financialAuditSchemaValue = {
  entity: "State University System",
  audit_firm: "PwC LLP",
  audit_type: "financial-statement-audit",
  id: "FIN-AUDIT-2024-UNIV-STATE-001",
  fiscal_year: 2024,
  verdict: "unqualified",
};

const complianceAuditSchemaValue = {
  organization: "Community National Bank",
  regulatory_framework: "banking-regulations",
  regulator: "FDIC",
  audit_date: "2024-07-15",
  verdict: "compliant"
};

const incomeStatementSchemaValue = {
  entity: "Bank of America",
  timestamp: "2024-09-05T10:30:00Z",
  credit: 1000000,
  debit: 800000,
  balance: 200000,
};

// --- AI, LLMs & AI Agents ---

const modelTrainingProvenanceSchemaValue = {
  model: "llama-3-8b-instruct-v1.2",
  version: "1.2",
  dataset: "OpenWebText",
  data_provenance_verified: true,
  dataset_license: "MIT"
};

const aiSafetyCertificationSchemaValue = {
  model_id: "gpt-5-safe-v1.0",
  certifier: "AI Safety Institute",
  framework: "NIST-AI-RMF",
  evaluation_date: "2024-08-20",
  level: "enterprise-ready",
};

const biasAuditSchemaValue = {
  model_id: "hiring-ai-model-v2.4",
  audit_date: "2024-07-30",
  auditor: "FairAI Consulting LLC",
  eu_ai_act_compliant: true,
  nyc_law_144_compliant: false,
};

const aiGeneratedContentSchemaValue = {
  content: "IMG-20240905-143022",
  type: "image",
  model: "DALL-E-3",
  timestamp: "2024-09-05T14:30:00Z",
  prompt: "sha256:a1b2c3d4...",
  is_ai_generated: true,
  confidence: 0.98,
};

const agentCapabilitySchemaValue = {
  agent_id: "financial-advisor-agent-v3.1",
  capabilities: ["portfolio-analysis", "risk-assessment"],
  limitations: ["no-investment-execution"],
  accuracy: 0.91,
};

const modelInterpretabilitySchemaValue = {
  model_id: "credit-scoring-model-v4.1",
  prediction_id: "PRED-20240905-789012",
  explanation_method: "SHAP",
  confidence: 0.92,
};

const trainingConsentSchemaValue = {
  id: "CONSENT-20240905-567890",
  subject: "user@example.com",
  purpose: "LLM training",
  consent_method: "explicit-opt-in",
  gdpr_basis: "consent-GDPR-6a",
};

const trainingDataQualitySchemaValue = {
  dataset: "dataset-web-crawl-2024-q2",
  quality_score: 7.8,
  gdpr_compliant: true,
  consent: "explicit-consent",
  last_audited: "2024-08-15"
};

const deepfakeDetectionSchemaValue = {
  media: "VID-20240905-001234",
  type: "video",
  model: "DeepfakeDetector-v4.2",
  timestamp: "2024-09-05T15:45:00Z",
  confidence: 0.94,
  risk_level: "high"
};

// --- AI Agent Permissions ---

const tradingAgentPermissionSchemaValue = {
  agent_id: "trading-bot-alpha-v2.1",
  principal: "user-john-doe-123456",
  max_trade_value: 10000,
  daily_limit: 50000,
  asset_classes: ["stocks", "etfs", "bonds"],
};

const shoppingAgentPermissionSchemaValue = {
  agent_id: "shopping-assistant-v3.4",
  principal: "user-sarah-chen-789012",
  daily_spend_limit: 500,
  monthly_budget: 2000,
  merchant_whitelist: ["amazon.com", "target.com"],
};

const travelMeetingAgentSchemaValue = {
  agent_id: "executive-assistant-ai-v1.8",
  principal: "user-michael-rodriguez-345678",
  can_book_flights: true,
  max_flight_cost: 2500,
  can_book_hotels: true,
  max_hotel_nightly: 350,
  can_attend_meetings: true,
};

// ============================================================================
// EXPORT ALL SCHEMAS FOR REFERENCE
// ============================================================================

const schemaValues = {
  nationalIdSchema: nationalIdSchemaValue,
  passportSchema: passportSchemaValue,
  driversLicenseSchema: driversLicenseSchemaValue,
  digitalWalletIdentitySchema: digitalWalletIdentitySchemaValue,
  biometricAuthSchema: biometricAuthSchemaValue,
  ageVerificationSchema: ageVerificationSchemaValue,
  trustScoreSchema: trustScoreSchemaValue,
  backgroundCheckSchema: backgroundCheckSchemaValue,
  multiFactorAuthenticationSchema: multiFactorAuthenticationSchemaValue,
  bachelorsDegreeSchema: bachelorsDegreeSchemaValue,
  mastersDegreeSchema: mastersDegreeSchemaValue,
  phdSchema: phdSchemaValue,
  itCertificationSchema: itCertificationSchemaValue,
  skillBadgeSchema: skillBadgeSchemaValue,
  courseCompletionSchema: courseCompletionSchemaValue,
  languageProficiencySchema: languageProficiencySchemaValue,
  academicTranscriptSchema: academicTranscriptSchemaValue,
  professionalLicenseSchema: professionalLicenseSchemaValue,
  industryCertificationSchema: industryCertificationSchemaValue,
  competencyAssessmentSchema: competencyAssessmentSchemaValue,
  employeeIDSchema: employeeIDSchemaValue,
  codeSigningSchema: codeSigningSchemaValue,
  sbomSchema: sbomSchemaValue,
  hardwareAttestationSchema: hardwareAttestationSchemaValue,
  apiSecuritySchema: apiSecuritySchemaValue,
  vulnerabilityAssessmentSchema: vulnerabilityAssessmentSchemaValue,
  oauthServiceSchema: oauthServiceSchemaValue,
  slaSchema: slaSchemaValue,
  contentProvenanceSchema: contentProvenanceSchemaValue,
  voterEligibilitySchema: voterEligibilitySchemaValue,
  publicServiceVerificationSchema: publicServiceVerificationSchemaValue,
  institutionalAccreditationSchema: institutionalAccreditationSchemaValue,
  governanceAuditSchema: governanceAuditSchemaValue,
  partnershipAgreementSchema: partnershipAgreementSchemaValue,
  publicServiceQualitySchema: publicServiceQualitySchemaValue,
  creditAssessmentSchema: creditAssessmentSchemaValue,
  altCreditScoreSchema: altCreditScoreSchemaValue,
  amlTransactionMonitoringSchema: amlTransactionMonitoringSchemaValue,
  investmentAdvisorSchema: investmentAdvisorSchemaValue,
  insuranceClaimSchema: insuranceClaimSchemaValue,
  crossBorderPaymentSchema: crossBorderPaymentSchemaValue,
  esgReportingSchema: esgReportingSchemaValue,
  financialAuditSchema: financialAuditSchemaValue,
  complianceAuditSchema: complianceAuditSchemaValue,
  incomeStatementSchema: incomeStatementSchemaValue,
  modelTrainingProvenanceSchema: modelTrainingProvenanceSchemaValue,
  aiSafetyCertificationSchema: aiSafetyCertificationSchemaValue,
  biasAuditSchema: biasAuditSchemaValue,
  aiGeneratedContentSchema: aiGeneratedContentSchemaValue,
  agentCapabilitySchema: agentCapabilitySchemaValue,
  modelInterpretabilitySchema: modelInterpretabilitySchemaValue,
  trainingConsentSchema: trainingConsentSchemaValue,
  trainingDataQualitySchema: trainingDataQualitySchemaValue,
  deepfakeDetectionSchema: deepfakeDetectionSchemaValue,
  tradingAgentPermissionSchema: tradingAgentPermissionSchemaValue,
  shoppingAgentPermissionSchema: shoppingAgentPermissionSchemaValue,
  travelMeetingAgentSchema: travelMeetingAgentSchemaValue,
};

export default schemaValues;