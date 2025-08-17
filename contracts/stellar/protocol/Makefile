# Makefile for building the contract

.PHONY: build
build:
	cargo build --target wasm32v1-none --release

.PHONY: test
test:
	cargo test -- --nocapture 

.PHONY: fmt
fmt:
	cargo fmt

.PHONY: lint
lint:
	cargo clippy -- -D warnings

.PHONY: all
all: fmt lint test build 