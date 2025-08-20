# Convenience Makefile for the `resolvers` crate
#
# Usage examples:
#   make test
#   make build-fee
#   make build-token
#   make build-default
#   make build
#   make deploy-fee IDENTITY=drew NETWORK=testnet
#
# Variables you can override:
#   TARGET  (default: wasm32v1-none)
#   PROFILE (default: release)
#   CARGO_TARGET_DIR (defaults to workspace: ../.. or ../../stellar depending on layout)

CRATE := resolvers
TARGET ?= wasm32v1-none
PROFILE ?= release
DIST := dist
# Default to the actual workspace artifacts path
CARGO_TARGET_DIR ?= ../../stellar/target
WASM := $(CARGO_TARGET_DIR)/$(TARGET)/$(PROFILE)/$(CRATE).wasm

.PHONY: help
help:
	@echo "Available targets:"
	@echo "  test                 - Run tests for the resolvers crate"
	@echo "  clean                - Clean build artifacts"
	@echo "  build-default        - Build DefaultResolver Wasm"
	@echo "  build-token          - Build TokenRewardResolver Wasm"
	@echo "  build-fee            - Build FeeCollectionResolver Wasm"
	@echo "  build                - Build all resolver Wasm artifacts"
	@echo "  deploy-default       - Deploy DefaultResolver (requires IDENTITY, NETWORK)"
	@echo "  deploy-token         - Deploy TokenRewardResolver (requires IDENTITY, NETWORK)"
	@echo "  deploy-fee           - Deploy FeeCollectionResolver (requires IDENTITY, NETWORK)"
	@echo "\nVariables: TARGET=$(TARGET), PROFILE=$(PROFILE), CARGO_TARGET_DIR=$(CARGO_TARGET_DIR)"

.PHONY: test
test:
	cargo test -q

.PHONY: clean
clean:
	cargo clean
	@rm -rf $(DIST)

$(DIST):
	@mkdir -p $(DIST)

# Build individual resolvers (Wasm) with feature-gated exports
.PHONY: build-default
build-default: $(DIST)
	cargo build --target $(TARGET) --release --features export-default-resolver
	cp "$(WASM)" "$(DIST)/$(CRATE)-default.wasm"
	@echo "Built: $(DIST)/$(CRATE)-default.wasm"

.PHONY: build-token
build-token: $(DIST)
	cargo build --target $(TARGET) --release --features export-token-reward-resolver
	cp "$(WASM)" "$(DIST)/$(CRATE)-token-reward.wasm"
	@echo "Built: $(DIST)/$(CRATE)-token-reward.wasm"

.PHONY: build-fee
build-fee: $(DIST)
	cargo build --target $(TARGET) --release --features export-fee-collection-resolver
	cp "$(WASM)" "$(DIST)/$(CRATE)-fee-collection.wasm"
	@echo "Built: $(DIST)/$(CRATE)-fee-collection.wasm"

.PHONY: build
build: build-default build-token build-fee
	@echo "All resolver Wasms built under $(DIST)/"

# Deploy helpers (requires Stellar CLI). Provide IDENTITY and NETWORK.
# Example: make deploy-fee IDENTITY=drew NETWORK=testnet

REQ_VARS = \
	if [ -z "$(IDENTITY)" ]; then echo "Set IDENTITY=<your_identity>"; exit 1; fi; \
	if [ -z "$(NETWORK)" ]; then echo "Set NETWORK=<testnet|mainnet>"; exit 1; fi

.PHONY: deploy-default
deploy-default: build-default
	@$(REQ_VARS)
	stellar contract deploy \
		--wasm "$(DIST)/$(CRATE)-default.wasm" \
		--source "$(IDENTITY)" \
		--network "$(NETWORK)"

.PHONY: deploy-token
deploy-token: build-token
	@$(REQ_VARS)
	stellar contract deploy \
		--wasm "$(DIST)/$(CRATE)-token-reward.wasm" \
		--source "$(IDENTITY)" \
		--network "$(NETWORK)"

.PHONY: deploy-fee
deploy-fee: build-fee
	@$(REQ_VARS)
	stellar contract deploy \
		--wasm "$(DIST)/$(CRATE)-fee-collection.wasm" \
		--source "$(IDENTITY)" \
		--network "$(NETWORK)" 