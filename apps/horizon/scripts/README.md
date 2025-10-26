# Schema Processing Scripts

This directory contains scripts for processing attestation schemas, creating attestations, and managing schema categories in the database.

## Files Overview

- **`importSchema.ts`** - Script for registering new schemas on the Stellar network using SorobanSchemaEncoder
- **`importSchemaEntries.ts`** - Schema attestation processor that creates attestations for existing schemas and updates database categories
- **`checkImportStatus.ts`** - Test script for validating schema processing functionality and database connectivity
- **`schemas-*.jsonl`** - JSONL files containing registered schema information organized by category

## Manual Workflow Overview

These describe the steps needed to manually process the entire schema > attestations > categories backfill workflow:

1. **Register Schemas**: Use the import script to register new schemas on a newly deployed contract
   ```bash
   pnpm tsx scripts/importSchema.ts <category>
   ```

2. **Backfill Data**: Invoke the `/backfill` route either through `curl` on the horizon API or through the integration tests in `apps/horizon/__tests__/integration/backfill.test.ts`

3. **Create Attestations**: Use the importSchemaEntries script to create attestations for registered schemas and update database categories
   ```bash
   pnpm tsx scripts/importSchemaEntries.ts
   ```

4. **Continuous Ingestion**: For ongoing monitoring, use the `ingest/recurring` route to have the server continuously listen for new schemas, attestations and events

## Available Schema Categories

The following schema categories are available:

1. **Education** (`schemas-education.jsonl`)
   - Bachelor's/Master's/PhD Degrees, IT Certification, Skill Badge
   - Course Completion, Language Proficiency, Academic Transcript

2. **Finance** (`schemas-finance.jsonl`)
   - Financial attestations and verifications

3. **GPT** (`schemas-gpt.jsonl`)
   - AI and GPT-related attestations

4. **Institution** (`schemas-institution.jsonl`)
   - Institutional verifications

5. **Professional** (`schemas-professional.jsonl`)
   - Professional License, Industry Certification
   - Competency Assessment, Employee ID

6. **Technology** (`schemas-technology.jsonl`)
   - Code Signing, SBOM, Hardware Attestation, API Security
   - Vulnerability Assessment, OAuth Service, SLA, Content Provenance

## Prerequisites

1. **Database Setup**: Ensure PostgreSQL is running and `DATABASE_URL` is set
2. **Stellar Network**: Scripts use Stellar testnet for attestations
3. **Dependencies**: Run `pnpm install` to install required packages

## Usage

### 1. Test the Setup

Before running the main processing scripts, test your setup:

```bash
pnpm tsx scripts/checkImportStatus.ts
```

This will verify:
- Database connectivity
- Schema value matching
- Database schema lookup

### 2. Register New Schemas

To register new schemas on the Stellar network by category:

```bash
pnpm tsx scripts/importSchema.ts education
pnpm tsx scripts/importSchema.ts finance
pnpm tsx scripts/importSchema.ts gpt
pnpm tsx scripts/importSchema.ts institution
pnpm tsx scripts/importSchema.ts professional
pnpm tsx scripts/importSchema.ts technology
```

### 3. Process Existing Schemas and Create Attestations

Run the attestation processor to create attestations for existing schemas:

```bash
pnpm tsx scripts/importSchemaEntries.ts
```

This script will:
- Generate a new Stellar keypair for attestations
- Fund the account using Friendbot
- Process each JSONL file in batch
- Create attestations for each schema using predefined values
- Update the database with category information
- Provide detailed progress and summary reports

## Script Details

### `importSchema.ts`

**Purpose:** Registers new schemas on the Stellar network using SorobanSchemaEncoder

**What it does:**
1. Defines schema structures using SorobanSchemaEncoder with proper field types
2. Registers schemas on the Stellar testnet via the attestation protocol contract
3. Outputs schema UIDs and saves them to category-specific JSONL files
4. Supports processing individual categories or all categories

**Usage:**
```bash
pnpm tsx scripts/importSchema.ts [category]
```

### `importSchemaEntries.ts`

**Purpose:** Creates attestations for existing schemas and updates database categories

**What it does:**
1. Reads all `schemas-*.jsonl` files in the scripts directory
2. For each schema entry:
   - Matches the schema name to predefined attestation values
   - Creates an attestation on Stellar testnet using that value
   - Updates the database schema record with the correct category
3. Provides comprehensive logging and error handling
4. Generates a summary report of all operations

**Features:**
- Real-time progress logging with emojis
- Detailed error reporting for failed operations
- Summary statistics for each category
- Rate limiting (2-second delay between operations)
- Robust error handling for network timeouts

### `checkImportStatus.ts`

**Purpose:** Test script for validating schema processing functionality

**What it does:**
1. Tests database connectivity
2. Verifies schema value matching works correctly
3. Checks database schema lookup functionality
4. Provides a go/no-go decision for running the main scripts
5. Processes a single test schema to validate the entire pipeline

## Database Updates

The scripts update the following fields in the `schemas` table:

- **`category`** - Set to the category from the JSONL file (e.g., "identity", "education")
- **`type`** - Also set to the category for consistency

## Error Handling

All scripts include comprehensive error handling:

- **Network Issues**: Automatic retries and graceful degradation
- **Database Errors**: Detailed logging with specific error messages  
- **Missing Schema Values**: Warnings for schemas not found in predefined values
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
- Verify schema names match exactly between JSONL files and predefined values
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