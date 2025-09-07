# Schema Processing Scripts

This directory contains scripts for processing attestation schemas, creating attestations, and managing schema categories in the database.

## Files Overview

- **`write-schema.ts`** - Contains schema value definitions for all attestation schemas
- **`seed-schema.ts`** - Original script for registering schemas on the Stellar network
- **`process-schema-attestations.ts`** - Main script for processing JSONL files and creating attestations
- **`test-schema-processing.ts`** - Test script to verify setup before running the main processor
- **`schemas-*.jsonl`** - JSONL files containing registered schema information by category

## Available Schema Categories

The following schema categories are available:

1. **Identity** (`schemas-identity.jsonl`) - 9 schemas
   - National ID, Passport, Driver's License, Digital Wallet Identity
   - Biometric Auth, Age Verification, Trust Score, Background Check
   - Multi-Factor Authentication

2. **Education** (`schemas-education.jsonl`) - 8 schemas
   - Bachelor's/Master's/PhD Degrees, IT Certification, Skill Badge
   - Course Completion, Language Proficiency, Academic Transcript

3. **Professional** (`schemas-professional.jsonl`) - 4 schemas
   - Professional License, Industry Certification
   - Competency Assessment, Employee ID

4. **Technology** (`schemas-technology.jsonl`) - 8 schemas
   - Code Signing, SBOM, Hardware Attestation, API Security
   - Vulnerability Assessment, OAuth Service, SLA, Content Provenance

5. **Civic** (`schemas-civic.jsonl`) - 2 schemas
   - Voter Eligibility, Public Service Verification

## Prerequisites

1. **Database Setup**: Ensure PostgreSQL is running and `DATABASE_URL` is set
2. **Stellar Network**: Scripts use Stellar testnet for attestations
3. **Dependencies**: Run `pnpm install` to install required packages

## Usage

### 1. Test the Setup

Before running the main processing script, test your setup:

```bash
npx ts-node test-schema-processing.ts
```

This will verify:
- Database connectivity
- Schema value matching
- Database schema lookup

### 2. Process All Schema Categories

Run the main processing script to create attestations and update categories:

```bash
npx ts-node process-schema-attestations.ts
```

This script will:
- Generate a new Stellar keypair for attestations
- Fund the account using Friendbot
- Process each JSONL file in batch
- Create attestations for each schema using values from `write-schema.ts`
- Update the database with category information
- Provide detailed progress and summary reports

### 3. Process Individual Categories

If you want to process schemas individually, you can use the original seeding script:

```bash
npx ts-node seed-schema.ts identity
npx ts-node seed-schema.ts education
npx ts-node seed-schema.ts professional
npx ts-node seed-schema.ts technology
npx ts-node seed-schema.ts civic
```

## Script Behavior

### `process-schema-attestations.ts`

**What it does:**
1. Reads all `schemas-*.jsonl` files in the scripts directory
2. For each schema entry:
   - Matches the schema name to a value in `write-schema.ts`
   - Creates an attestation on Stellar testnet using that value
   - Updates the database schema record with the correct category
3. Provides comprehensive logging and error handling
4. Generates a summary report of all operations

**Output:**
- Real-time progress logging with emojis
- Detailed error reporting for failed operations
- Summary statistics for each category
- Total counts for processed schemas, attestations, and database updates

**Rate Limiting:**
- 2-second delay between schema operations to avoid network issues
- Robust error handling for network timeouts

### `test-schema-processing.ts`

**What it does:**
1. Tests database connectivity
2. Verifies schema value matching works correctly
3. Checks database schema lookup functionality
4. Provides a go/no-go decision for running the main script

## Database Updates

The scripts update the following fields in the `schemas` table:

- **`category`** - Set to the category from the JSONL file (e.g., "identity", "education")
- **`type`** - Also set to the category for consistency

## Error Handling

Both scripts include comprehensive error handling:

- **Network Issues**: Automatic retries and graceful degradation
- **Database Errors**: Detailed logging with specific error messages  
- **Missing Schema Values**: Warnings for schemas not found in `write-schema.ts`
- **Invalid JSONL**: Parsing error handling with line-by-line processing

## Monitoring

The scripts provide detailed logging:

- 🚀 Process start/completion
- 🔑 Account generation and funding
- 📂 Category processing status
- 📝 Individual attestation creation
- 💾 Database update confirmations
- ⚠️ Warnings for non-critical issues
- ❌ Errors with detailed context
- 📊 Summary statistics

## Troubleshooting

### Database Connection Issues
```bash
# Check if DATABASE_URL is set
echo $DATABASE_URL

# Test database connection
npx prisma db push --preview-feature
```

### Stellar Network Issues
- Scripts use testnet Friendbot for funding
- Network timeouts are handled with retries
- Check Stellar testnet status if issues persist

### Missing Schema Values
- Verify schema names match exactly between JSONL files and `write-schema.ts`
- Check for typos in schema names
- Review the error output for specific missing schemas

## Example Output

```
🚀 Starting Schema Attestation Processing...

🔑 Generated keypair: GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
🏦 Funding account: GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
✅ Successfully funded account

📋 Found 5 schema files to process:
  • schemas-civic.jsonl
  • schemas-education.jsonl
  • schemas-identity.jsonl
  • schemas-professional.jsonl
  • schemas-technology.jsonl

📂 Processing category: identity
📄 File: schemas-identity.jsonl
📊 Found 9 schemas in identity category

[1/9] Processing: nationalIdSchema
📝 Creating attestation for schema: nationalIdSchema
✅ Attestation created for nationalIdSchema with UID: abc123...
✅ Updated schema 3f7ad183... with category: identity
⏱️  Waiting 2 seconds before next schema...

============================================================
📊 PROCESSING SUMMARY
============================================================

📂 Category: identity
   Processed: 9
   Attestations: 9
   DB Updates: 9
   Errors: 0

============================================================
🎯 TOTALS
============================================================
📊 Total Schemas Processed: 31
📝 Total Attestations Created: 31
💾 Total DB Updates: 31
❌ Total Errors: 0
💰 Account Used: GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

🎉 All schemas processed successfully!
``` 