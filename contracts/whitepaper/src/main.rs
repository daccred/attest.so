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

    #[arg(short, long, default_value = "release/attestprotocol.pdf")]
    output: PathBuf,

    #[arg(short = 'd', long, default_value = "release", help = "Output directory for all generated files")]
    output_dir: PathBuf,

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

    // Create output directory
    fs::create_dir_all(&args.output_dir)
        .context("Failed to create output directory")?;

    println!("Building PDF from {:?} using Tectonic CLI...", args.input);
    println!("Output directory: {:?}", args.output_dir);

    let mut cmd = Command::new("tectonic");
    
    // Use direct compilation with output directory
    cmd.arg(&args.input);
    cmd.arg("--outdir").arg(&args.output_dir);

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

    // The PDF is generated in the output directory
    let input_stem = args.input.file_stem()
        .context("Invalid input filename")?;
    let built_pdf = args.output_dir.join(format!("{}.pdf", input_stem.to_string_lossy()));
    
    if !built_pdf.exists() {
        anyhow::bail!("Expected PDF output not found at {:?}", built_pdf);
    }

    // Copy to final output location if different from build location
    if built_pdf != args.output {
        if let Some(parent) = args.output.parent() {
            fs::create_dir_all(parent)
                .context("Failed to create final output directory")?;
        }
        
        fs::copy(&built_pdf, &args.output)
            .context("Failed to copy PDF to final output location")?;
        
        println!("PDF generated: {:?}", built_pdf);
        println!("PDF copied to: {:?}", args.output);
    } else {
        println!("PDF generated: {:?}", args.output);
    }

    Ok(())
}