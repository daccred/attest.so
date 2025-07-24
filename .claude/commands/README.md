# claude-code-helpers

A CLI tool to sync .md files from GitHub repositories to your local `.claude/commands/` directory for use with Claude Code.

## Installation

Install globally via npm:

```bash
npm install -g claude-code-helpers
```

## Usage

### Quick Start

```bash
# Use git remote origin as default repository
claude-code-helpers

# Interactive setup
claude-code-helpers --init

# Sync from a specific repository
claude-code-helpers --repo username/repo-name

# Sync from a specific branch
claude-code-helpers --repo username/repo-name --branch develop

# Enable verbose output
claude-code-helpers --verbose
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `--repo <user/repo>` | Specify GitHub repository (username/repo-name) |
| `--branch <branch>` | Specify branch (default: main) |
| `--init` | Initialize configuration interactively |
| `--verbose` | Enable verbose output |
| `--help` | Show help message |

### Examples

```bash
# Sync from current git repository's remote origin
claude-code-helpers

# Interactive setup - prompts for repository
claude-code-helpers --init

# Sync from specific repository
claude-code-helpers --repo anthropics/claude-code

# Sync from development branch
claude-code-helpers --repo myusername/my-commands --branch develop

# Verbose output for debugging
claude-code-helpers --repo myusername/my-commands --verbose
```

## How It Works

1. **Repository Detection**: Uses git remote origin as default, or specify with `--repo`
2. **GitHub API**: Fetches repository contents using GitHub's REST API
3. **Recursive Scanning**: Recursively traverses all directories in the repository
4. **File Filtering**: Downloads only `.md` files from the entire repository tree
5. **Local Storage**: Saves all files directly to `.claude/commands/` directory (flattened)
6. **Configuration**: Stores settings in `.claude-sync-config.json`

## Configuration

The tool creates a `.claude-sync-config.json` file in your current directory:

```json
{
  "repo": "username/repo-name",
  "branch": "main",
  "lastSync": "2025-01-17T10:30:00.000Z"
}
```

## Directory Structure

```
your-project/
├── .claude/
│   └── commands/
│       ├── command1.md
│       ├── command2.md
│       ├── advanced.md
│       ├── setup.md
│       └── demo.md
└── .claude-sync-config.json
```

## Requirements

- Node.js 14.0.0 or higher
- Git (for automatic repository detection)
- Internet connection for GitHub API access

## Features

- 🚀 **Zero Dependencies**: Uses only Node.js built-in modules
- 📁 **Automatic Setup**: Creates `.claude/commands/` directory automatically
- 🔧 **Git Integration**: Automatically detects git remote origin
- 💾 **Configuration Management**: Saves settings for future use
- 🌐 **GitHub API**: Reliable fetching from GitHub repositories
- 📝 **Markdown Focus**: Filters and downloads only `.md` files from entire repository tree
- 🔍 **Error Handling**: Graceful handling of network and API errors

## Troubleshooting

### Common Issues

**Repository not found or access denied**
- Ensure the repository exists and is public
- Check your internet connection
- Verify repository name format: `username/repo-name`

**No .md files found**
- Ensure the repository contains .md files anywhere in the directory tree
- Check if you're using the correct branch with `--branch`

**Git remote not found**
- Run from a git repository directory, or
- Use `--repo` flag to specify repository manually

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Repository

[https://github.com/pauleke65/claude-code-helpers](https://github.com/pauleke65/claude-code-helpers)

## Author

Paul Imoke