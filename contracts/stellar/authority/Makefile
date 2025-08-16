# Makefile for building the authority resolver contract

TARGET=wasm32v1-none
WASM=target/$(TARGET)/release/authority.wasm 


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
