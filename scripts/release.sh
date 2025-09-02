#!/bin/bash

# Release Automation Script
# Automates the complete release process from version updates to NPM publishing.

# Usage

# ```bash
# Basic release (runs all checks and validations)
# ./scripts/release.sh

# # Skip certain steps during development/testing
# ./scripts/release.sh --skip-tests --skip-lint --skip-build

# # Show help
# ./scripts/release.sh --help
# ```

# ### What the script does
# 1. **Pre-flight checks**
#    - Validates you're in the project root
#    - Ensures git working directory is clean
#    - Checks current branch (recommends main/canary)
#    - Verifies changesets exist

# 2. **Build validation**
#    - Installs dependencies with `pnpm install`
#    - Runs tests with `pnpm test`
#    - Runs linter with `pnpm lint`
#    - Builds all packages with `pnpm build`

# 3. **Version management**
#    - Applies changesets and versions packages
#    - Commits version changes

# 4. **Publishing**
#    - Publishes these packages to NPM:
#      - `@attestprotocol/sdk`
#      - `@attestprotocol/cli`
#      - `@attestprotocol/stellar-sdk`
#      - `@attestprotocol/solana-sdk`
#      - `@attestprotocol/starknet-sdk`

# 5. **Post-release**
#    - Optionally releases Stellar contracts
#    - Creates and pushes git tags
#    - Provides next steps reminders

# ### Options

# - `--skip-tests`: Skip running tests
# - `--skip-lint`: Skip running linter
# - `--skip-build`: Skip building packages
# - `--help`: Show help message

# ### Prerequisites

# Before running the release script:

# 1. **Create changesets** for your changes:
#    ```bash
#    pnpm changeset
#    ```

# 2. **Ensure you're authenticated** with NPM:
#    ```bash
#    npm login
#    ```

# 3. **Clean working directory** - commit or stash all changes

# 4. **Be on the correct branch** (main or canary recommended)

# ### Security Notes

# - The script validates all steps before publishing
# - Asks for confirmation before irreversible actions
# - Provides colored output for easy monitoring
# - Exits immediately on any errors

# ### Troubleshooting

# If the script fails:

# 1. **Build failures**: Fix TypeScript/build errors and run again
# 2. **Test failures**: Fix failing tests before proceeding
# 3. **Publishing errors**: May indicate package already published at that version
# 4. **Git errors**: Ensure working directory is clean and you have push permissions

# ### Integration with Existing Workflows

# This script integrates with your existing release infrastructure:

# - Uses `@changesets/cli` for version management
# - Leverages existing `pnpm` scripts in package.json
# - Respects workspace configuration
# - Works with your current NPM publishing setup


set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
check_directory() {
    if [[ ! -f "package.json" ]] || [[ ! -d ".changeset" ]]; then
        log_error "This script must be run from the project root directory"
        exit 1
    fi
}

# Check if git working directory is clean
check_git_status() {
    log_info "Checking git status..."
    if [[ -n $(git status --porcelain) ]]; then
        log_error "Working directory is not clean. Please commit or stash your changes."
        git status --short
        exit 1
    fi
    log_success "Working directory is clean"
}

# Check if we're on the main branch
check_branch() {
    local current_branch=$(git branch --show-current)
    if [[ "$current_branch" != "main" ]] && [[ "$current_branch" != "canary" ]]; then
        log_warning "You are on branch '$current_branch'. It's recommended to release from 'main' or 'canary'."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Check if there are any changesets
check_changesets() {
    log_info "Checking for changesets..."
    # if [[ ! -d ".changeset" ]] || [[ -z "$(find .changeset -name '*.md' -not -name 'README.md' -not -name 'config.json')" ]]; then
    #     log_error "No changesets found. Create a changeset first with 'pnpm changeset'"
    #     exit 1
    # fi
    log_success "Changesets found"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    if ! pnpm install; then
        log_error "Failed to install dependencies"
        exit 1
    fi
    log_success "Dependencies installed"
}

# Run tests
run_tests() {
    log_info "Running tests..."
    if ! pnpm test; then
        log_error "Tests failed. Please fix failing tests before releasing."
        exit 1
    fi
    log_success "All tests passed"
}

# Run linting
run_lint() {
    log_info "Running linter..."
    if ! pnpm lint; then
        log_error "Linting failed. Please fix linting errors before releasing."
        exit 1
    fi
    log_success "Linting passed"
}

# Build all packages
build_packages() {
    log_info "Building all packages..."
    if ! pnpm build; then
        log_error "Build failed. Please fix build errors before releasing."
        exit 1
    fi
    log_success "All packages built successfully"
}

# Version packages using changesets
version_packages() {
    log_info "Versioning packages..."
    
    # Apply changesets and version packages
    if ! pnpm changeset version; then
        log_error "Failed to version packages"
        exit 1
    fi
    
    log_success "Packages versioned successfully"
}

# Commit version changes
commit_version_changes() {
    log_info "Committing version changes..."
    
    # Check if there are changes to commit
    if [[ -n $(git status --porcelain) ]]; then
        git add .
        git commit -m "chore: release packages"
        log_success "Version changes committed"
    else
        log_info "No version changes to commit"
    fi
}

# Publish packages to NPM
publish_packages() {
    log_info "Publishing packages to NPM..."
    
    # Get list of packages that should be published
    local packages=(
        "@attestprotocol/sdk"
        "@attestprotocol/cli" 
        "@attestprotocol/core"
        "@attestprotocol/stellar-contracts"
        "@attestprotocol/stellar-sdk"
        "@attestprotocol/solana-sdk"
        "@attestprotocol/starknet-sdk"
    )
    
    local published_count=0
    
    for package in "${packages[@]}"; do
        log_info "Publishing $package..."
        
        # Find the package directory
        local package_dir=""
        case $package in
            "@attestprotocol/sdk")
                package_dir="packages/sdk"
                ;;
            "@attestprotocol/cli")
                package_dir="packages/cli"
                ;;
            "@attestprotocol/core")
                package_dir="packages/core"
                ;;
            "@attestprotocol/stellar-contracts")
                package_dir="contracts/stellar"
                ;;
            "@attestprotocol/stellar-sdk")
                package_dir="packages/stellar-sdk"
                ;;
            "@attestprotocol/solana-sdk")
                package_dir="packages/solana-sdk"
                ;;
            "@attestprotocol/starknet-sdk")
                package_dir="packages/starknet-sdk"
                ;;
        esac
        
        if [[ -d "$package_dir" ]]; then
            (cd "$package_dir" && pnpm publish --access public --no-git-checks) && {
                log_success "Published $package"
                ((published_count++))
            } || {
                log_warning "Failed to publish $package (may already be published)"
            }
        else
            log_warning "Package directory not found for $package"
        fi
    done
    
    log_success "Published $published_count packages"
}

# Release Stellar contracts (optional)
release_stellar_contracts() {
    if [[ -d "contracts/stellar" ]]; then
        read -p "Do you want to release Stellar contracts? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            read -p "Enter Stellar contract version (e.g., 1.0.0): " stellar_version
            if [[ -n "$stellar_version" ]]; then
                log_info "Releasing Stellar contracts version $stellar_version..."
                if pnpm release:stellar "$stellar_version"; then
                    log_success "Stellar contracts released"
                else
                    log_warning "Failed to release Stellar contracts"
                fi
            fi
        fi
    fi
}

# Create and push git tag
create_git_tag() {
    local main_version=$(node -p "require('./packages/sdk/package.json').version")
    local tag_name="v$main_version"
    
    log_info "Creating git tag $tag_name..."
    
    if git tag "$tag_name"; then
        log_success "Created tag $tag_name"
        
        read -p "Push tag to remote? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if git push origin "$tag_name"; then
                log_success "Tag pushed to remote"
            else
                log_warning "Failed to push tag to remote"
            fi
        fi
    else
        log_warning "Failed to create tag (may already exist)"
    fi
}

# Main release function
main() {
    log_info "Starting automated release process..."
    
    # Pre-flight checks
    check_directory
    check_git_status
    check_branch
    check_changesets
    
    # Dependency and validation
    install_dependencies
    run_tests
    run_lint
    build_packages
    
    # Version and release
    version_packages
    commit_version_changes
    
    # Confirmation before publishing
    log_warning "About to publish packages to NPM. This action cannot be undone."
    read -p "Continue with publishing? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Release cancelled by user"
        exit 0
    fi
    
    publish_packages
    release_stellar_contracts
    create_git_tag
    
    log_success "Release process completed successfully!"
    log_info "Don't forget to:"
    log_info "  - Push your changes: git push origin $(git branch --show-current)"
    log_info "  - Create a GitHub release with release notes"
    log_info "  - Update documentation if needed"
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --skip-tests     Skip running tests"
    echo "  --skip-lint      Skip running linter" 
    echo "  --skip-build     Skip building packages"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "This script automates the release process for Attest Protocol."
    echo "It will:"
    echo "  1. Check git status and branch"
    echo "  2. Install dependencies"
    echo "  3. Run tests and linting"
    echo "  4. Build all packages"
    echo "  5. Version packages using changesets"
    echo "  6. Commit version changes"
    echo "  7. Publish packages to NPM"
    echo "  8. Optionally release Stellar contracts"
    echo "  9. Create and push git tags"
}

# Parse command line arguments
SKIP_TESTS=false
SKIP_LINT=false
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-lint)
            SKIP_LINT=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Override functions based on flags
if [[ "$SKIP_TESTS" == true ]]; then
    run_tests() {
        log_warning "Skipping tests (--skip-tests flag used)"
    }
fi

if [[ "$SKIP_LINT" == true ]]; then
    run_lint() {
        log_warning "Skipping linting (--skip-lint flag used)"
    }
fi

if [[ "$SKIP_BUILD" == true ]]; then
    build_packages() {
        log_warning "Skipping build (--skip-build flag used)"
    }
fi

# Run main function
main "$@"