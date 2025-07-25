.PHONY: build pdf clean run help tectonic-build tectonic-watch

help:
	@echo "Available commands:"
	@echo "  make build         - Build the Rust application"
	@echo "  make pdf           - Generate PDF using Rust wrapper"
	@echo "  make tectonic-build - Generate PDF directly with tectonic"
	@echo "  make tectonic-watch - Watch for changes and rebuild"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make run           - Build and run to generate PDF"

build:
	cargo build --release

pdf: build
	cargo run --release

tectonic-build:
	tectonic whitepaper.tex

tectonic-watch:
	tectonic whitepaper.tex --watch

run: pdf

clean:
	cargo clean
	rm -rf build/
	rm -f ../../packages/whitepaper/attestprotocol.pdf

install-deps:
	@echo "Checking for Tectonic installation..."
	@which tectonic > /dev/null || echo "Warning: tectonic not found. Run: brew install tectonic"