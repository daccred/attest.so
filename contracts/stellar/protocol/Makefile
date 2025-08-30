# Makefile for building the Stellar protocol contract
#
# This Makefile provides targets for building, testing, and managing the Stellar
# smart contract. It includes utilities for formatting code, running tests,
# and querying contract events.
#
# Usage examples:
#   make build          # Build the contract for WASM target
#   make test           # Run all tests with output
#   make events         # Query contract events (requires ID and START_LEDGER)
#   make all            # Format, lint, test, and build

# Example command from comment below:
# make events ID=CB3NF4FHZPQOBWSPZNLKU32SK6Z5FR54TN6LWBBY72IDRDRIVWBRRFE5 START_LEDGER=265000

.PHONY: build
build:
	@echo "Building contract for WASM target..."
	cargo build --target wasm32v1-none --release

.PHONY: test
test:
	@echo "Running tests..."
	cargo test -- --nocapture 

.PHONY: fmt
fmt:
	@echo "Formatting code..."
	cargo fmt

.PHONY: events
events:
	@echo "Querying contract events..."
	@echo "ID: $(ID)"
	@echo "Start Ledger: $(START_LEDGER)"
	stellar events --id $(ID) --network testnet --count 100 --start-ledger $(START_LEDGER) 2>&1

.PHONY: lint
lint:
	@echo "Running linter..."
	cargo clippy -- -D warnings

.PHONY: all
all: fmt lint test build 
	@echo "All tasks completed successfully!" 