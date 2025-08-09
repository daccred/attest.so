# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-17

### Added
- **NPM Package Publishing**: Package is now ready for global npm installation
- Initial CLI tool implementation for syncing .md files from GitHub repositories
- Package.json with proper bin configuration for global installation
- Main CLI script (index.js) with shebang for executable functionality
- GitHub API integration for fetching repository contents
- File filtering and downloading logic for .md files only
- Configuration management with .claude-sync-config.json
- Command line argument parsing supporting:
  - `--repo <user/repo>` - Specify GitHub repository
  - `--branch <branch>` - Specify branch (defaults to main)
  - `--init` - Interactive configuration setup
  - `--verbose` - Enable verbose output
  - `--help` - Show help message
- Interactive initialization prompting for GitHub repository
- Automatic directory creation for .claude/commands/
- Error handling and validation for repository formats
- Git remote origin detection as fallback repository source
- Gist fetching functionality (fetch-gists.js)
- Downloaded 9 .md command files from kieranklaassen's GitHub gists:
  - Api Documentation DecipherMe.md
  - Commit Prompt Cursor.md
  - appsimv2.md (most popular with 52 stars)
  - cc.md
  - draftkit_prd.md
  - featurebase_triage.md
  - issues.md
  - resolve-pr-comments.md
  - work.md
- Manually created .md command files:
  - plan.md
  - query.md


### Technical Details
- Uses only Node.js built-in modules (https, fs, path, readline, child_process)
- Fetches from GitHub API endpoint: `https://api.github.com/repos/{repo}/contents?ref={branch}`
- Filters for `.type === 'file'` and `.name.endsWith('.md')`
- Downloads files using `.download_url` property
- Handles network errors, API rate limiting, and file system permissions gracefully
- Supports both HTTPS and SSH GitHub remote URLs
- Executable permissions set on index.js for global installation

### Configuration
- Saves configuration in `.claude-sync-config.json` with format:
  ```json
  {
    "repo": "username/repo-name",
    "branch": "main",
    "lastSync": "2025-01-17T10:30:00.000Z"
  }
  ```

### Installation
Ready for global installation with: `npm install -g claude-code-helpers`

### NPM Package Features
- Professional README.md with comprehensive documentation
- Proper package.json with repository, homepage, and bug tracking URLs
- "files" field for clean package distribution (excludes development files)
- NPM scripts for testing and publishing workflow
- Validated package contents (4 files: index.js, package.json, CHANGELOG.md, README.md)
- Package size: 5.2 kB (17.0 kB unpacked)

### Usage Examples
```bash
# Uses git remote or saved config
claude-code-helpers

# Initialize with interactive prompt
claude-code-helpers --init

# Sync from specific repository
claude-code-helpers --repo username/repo-name

# Sync from specific branch
claude-code-helpers --repo username/repo-name --branch develop

# Enable verbose output
claude-code-helpers --verbose

# Show help
claude-code-helpers --help
```