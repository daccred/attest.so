# Makefile for building the schema contract

TARGET=wasm32-unknown-unknown
# WASM=target/$(TARGET)/release/schema.wasm # Path might vary

.PHONY: build
build:
	cargo build --target $(TARGET) --release
	# ls $(WASM) # Removed ls check

.PHONY: test
test:
	cargo test

.PHONY: fmt
fmt:
	cargo fmt

.PHONY: lint
lint:
	cargo clippy -- -D warnings

.PHONY: all
all: fmt lint test build
