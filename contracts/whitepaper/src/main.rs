use anyhow::{Context, Result};
use clap::Parser;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(Parser, Debug)]
#[command(name = "whitepaper-builder")]
#[command(about = "Build PDF from LaTeX whitepaper using Tectonic CLI", long_about = None)]
struct Args {
    #[arg(short, long, default_value = "whitepaper.tex")]
    input: PathBuf,

    #[arg(short, long, default_value = "../../packages/whitepaper/attestprotocol.pdf")]
    output: PathBuf,

    #[arg(short = 'k', long, help = "Keep intermediate files")]
    keep_intermediates: bool,

    #[arg(short = 'l', long, help = "Keep log files")]
    keep_logs: bool,

    #[arg(short, long, help = "Run tectonic with verbose output")]
    verbose: bool,
}

fn main() -> Result<()> {
    let args = Args::parse();

    if !args.input.exists() {
        anyhow::bail!("Input file {:?} does not exist", args.input);
    }

    println!("Building PDF from {:?} using Tectonic CLI...", args.input);

    let mut cmd = Command::new("tectonic");
    
    // Use direct compilation instead of -X build
    cmd.arg(&args.input);

    if args.keep_intermediates {
        cmd.arg("--keep-intermediates");
    }

    if args.keep_logs {
        cmd.arg("--keep-logs");
    }

    if args.verbose {
        cmd.arg("-v");
    }

    let status = cmd
        .status()
        .context("Failed to execute tectonic command")?;

    if !status.success() {
        anyhow::bail!("Tectonic compilation failed with status: {}", status);
    }

    // The PDF is generated with the same name as the tex file
    let input_stem = args.input.file_stem()
        .context("Invalid input filename")?;
    let built_pdf = PathBuf::from(format!("{}.pdf", input_stem.to_string_lossy()));
    
    if !built_pdf.exists() {
        anyhow::bail!("Expected PDF output not found at {:?}", built_pdf);
    }

    if let Some(parent) = args.output.parent() {
        fs::create_dir_all(parent)
            .context("Failed to create output directory")?;
    }

    fs::copy(&built_pdf, &args.output)
        .context("Failed to copy PDF to output location")?;

    println!("PDF generated successfully: {:?}", args.output);

    Ok(())
}