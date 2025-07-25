.PHONY: pdf clean help watch

help:
	@echo "Available commands:"
	@echo "  make pdf    - Generate PDF using Tectonic CLI"
	@echo "  make watch  - Watch for changes and rebuild PDF"
	@echo "  make clean  - Clean build artifacts"

pdf:
	@mkdir -p release
	tectonic whitepaper.tex --outdir release
	@mv -f release/whitepaper.pdf release/attestprotocol_$$(date +%Y%m%d).pdf
	@echo "PDF successfully generated: release/attestprotocol_$$(date +%Y%m%d).pdf"

watch:
	tectonic whitepaper.tex --outdir release --watch

clean:
	cargo clean
	rm -f *.pdf *.log *.aux *.glo *.idx *.ist *.toc *.bbl *.blg *.acn *.fls *.fdb_latexmk

install-deps:
	@echo "Verifying Tectonic installation..."
	@which tectonic > /dev/null || echo "Warning: tectonic not found. Run: brew install tectonic"

run:
	cargo run --release