# Makefile for building the authority resolver contract

TARGET=wasm32-unknown-unknown
# WASM=target/$(TARGET)/release/authority.wasm # Path might vary depending on build context

.PHONY: build
build:
	cargo build --target $(TARGET) --release
	# ls $(WASM) # Removed ls check as target path seems inconsistent

.PHONY: test
test:
	# No tests currently
	@echo "No tests defined for authority contract."

.PHONY: fmt
fmt:
	cargo fmt

.PHONY: lint
lint:
	cargo clippy -- -D warnings

.PHONY: all
all: fmt lint build
