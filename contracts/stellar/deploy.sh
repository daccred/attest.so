#!/bin/bash

# ================================================================================
# Stellar Smart Contract Deployment Script
# ================================================================================
# Automates Soroban smart contract deployment to Stellar networks.
# Features: Multi-contract support, deployment history tracking, network selection,
# clean build mode, and robust error handling.
#
# Usage: ./deploy.sh --authority --network testnet --source my_identity --mode clean
# ================================================================================

# === Safety Settings ===
set -e   # Exit on errors (prevents partial deployments)
set -u   # Unset variables = errors (catches config issues)
set -o pipefail  # Catch pipe failures (important for cmd | tee log.txt)

# === Configuration ===
DEFAULT_NETWORK="testnet"      # Options: testnet, mainnet
DEFAULT_SOURCE="drew"          # Default deployment identity
CONTRACTS_JSON_FILE="deployments.json"  # JSON: {network: {contract: {id, hash, timestamp}}}

# Contract definitions (WASM paths relative to project root)
AUTHORITY_CONTRACT_NAME="authority"    # Handles permissions/access control
PROTOCOL_CONTRACT_NAME="protocol"      # Implements core business logic
AUTHORITY_WASM_PATH="target/wasm32-unknown-unknown/release/${AUTHORITY_CONTRACT_NAME}.wasm"
PROTOCOL_WASM_PATH="target/wasm32-unknown-unknown/release/${PROTOCOL_CONTRACT_NAME}.wasm"

# === Runtime Variables ===
deploy_authority=false   # Deploy authority contract flag
deploy_protocol=false    # Deploy protocol contract flag
network_name=""          # Target network
source_identity=""       # Signing identity
mode="default"           # Mode: 'default' (build+deploy) or 'clean' (clean+test+build+deploy)

# === Helper Functions ===

# Display usage info (exit: 1 = help displayed)
usage() {
  echo "Usage: $0 [--authority] [--protocol] [--network <network_name>] [--source <identity_name>] [--mode <default|clean>] [-h|--help]"
  echo ""
  echo "Builds, tests (optional), and deploys Soroban contracts, storing details in ${CONTRACTS_JSON_FILE}."
  echo ""
  echo "Options:"
  echo "  --authority         Deploy the authority contract."
  echo "  --protocol          Deploy the protocol contract."
  echo "  --network <name>    Specify the network (e.g., testnet, mainnet). Default: ${DEFAULT_NETWORK}"
  echo "  --source <identity> Specify the source identity for deployment. Default: ${DEFAULT_SOURCE}"
  echo "  --mode <mode>       Deployment mode: 'clean' (clean, test, build, deploy) or 'default' (build, deploy). Default: default"
  echo "  -h, --help          Display this help message."
  exit 1
}

# Print step header for clarity (arg: step description)
log_step() {
  echo ""
  echo "========================================"
  echo "STEP: $1"
  echo "========================================"
}

# Verify jq installation (exit: 0=available, 1=missing)
check_jq() {
  if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install jq (e.g., 'brew install jq' or 'sudo apt-get install jq')."
    exit 1
  fi
}

# Update deployment history in JSON
# Args: network, contract_name, contract_id(C...), tx_hash(64-hex), timestamp(ISO-8601)
# Exit: 0=success, 1=JSON error
update_contracts_json() {
    local network=$1
    local contract_name=$2
    local contract_id=$3
    local tx_hash=$4
    local deploy_timestamp=$5
    local tmp_json_file="${CONTRACTS_JSON_FILE}.tmp"

    echo "Updating ${CONTRACTS_JSON_FILE} for network '${network}' with ${contract_name} details..."

    # Read existing JSON or initialize.
    # This ensures we don't overwrite unrelated data if the file already exists.
    local current_json
    if [[ -f "$CONTRACTS_JSON_FILE" ]]; then
        current_json=$(cat "$CONTRACTS_JSON_FILE")
    else
        current_json="{}"
    fi

    # Create the contract data JSON snippet using jq.
    # Using jq -n ensures correct JSON formatting even with special characters.
    local contract_data
    contract_data=$(jq -n \
      --arg id "$contract_id" \
      --arg hash "$tx_hash" \
      --arg ts "$deploy_timestamp" \
      '{id: $id, hash: $hash, timestamp: $ts}')

    # Use jq to merge the new contract data into the existing JSON.
    # This is safer and more robust than string manipulation.
    # The filter '.[$net] |= (if . == null then {} else . end) | .[$net][$name] = $data'
    # ensures the network level exists before adding/updating the contract.
    # stderr is captured to provide better error messages if jq fails.
    jq_stderr=$(echo "$current_json" | jq \
        --arg net "$network" \
        --arg name "$contract_name" \
        --argjson data "$contract_data" \
        '.[$net] |= (if . == null then {} else . end) | .[$net][$name] = $data' \
        > "$tmp_json_file" 2>&1)
    local jq_exit_code=$?

    # Check jq's exit code explicitly.
    if [[ $jq_exit_code -ne 0 ]]; then
      echo "Error: Failed to update JSON using jq (Exit Code: $jq_exit_code)."
      echo "jq stderr: $jq_stderr"
      if [[ -f "$tmp_json_file" ]]; then rm -f "$tmp_json_file"; fi
      exit 1
    fi

    # Verify the temp file content includes the new ID before moving.
    # This is a safety check against unexpected jq behavior.
    if grep -q "$contract_id" "$tmp_json_file"; then
        true # Placeholder for successful grep
    else
        echo "Error: Temp file $tmp_json_file does NOT contain the new contract ID $contract_id!"
        cat "$tmp_json_file"
        rm -f "$tmp_json_file"
        exit 1
    fi

    # Atomically replace the old file with the new one using mv.
    # The -f flag ensures overwriting if the target exists.
    mv -f "$tmp_json_file" "$CONTRACTS_JSON_FILE"
    local mv_exit_code=$?

    # Check if the move was successful.
    if [[ $mv_exit_code -ne 0 ]]; then
        echo "Error: Failed to move $tmp_json_file to $CONTRACTS_JSON_FILE (Exit Code: $mv_exit_code)."
        if [[ -f "$tmp_json_file" ]]; then rm -f "$tmp_json_file"; fi # Clean up if move failed
        exit 1
    fi

    echo "${CONTRACTS_JSON_FILE} updated successfully."
}

# Extract deployment info from CLI output
# Args: raw_output, network, contract_name
# Sets deployment in JSON, Exit: 0=success, 1=invalid ID
extract_deployment_details() {
    local deploy_output="$1"
    local network="$2"
    local contract_name="$3"
    
    # Extract transaction hash from output
    local tx_hash=$(echo "$deploy_output" | grep "Transaction hash is" | awk '{print $NF}')
    
    # Extract contract ID from URL
    local contract_id=$(echo "$deploy_output" | grep "stellar.expert/explorer/.*/contract/" | sed -E 's|.*contract/([A-Z0-9]+).*|\1|')
    
    # Create timestamp
    local deploy_timestamp=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
    
    # Validate contract ID format (should start with C and have 55 more characters)
    if [[ ! "$contract_id" =~ ^C[A-Z0-9]{55}$ ]]; then
        echo "Error: Could not extract valid contract ID from output."
        echo "Raw output contained: $deploy_output"
        return 1
    fi
    
    # Validate transaction hash (should be 64 hex characters)
    if [[ -z "$tx_hash" || ${#tx_hash} -ne 64 ]]; then
        echo "Warning: Could not reliably extract transaction hash. Using empty value."
        tx_hash=""
    fi
    
    echo "Extracted contract ID: $contract_id"
    echo "Extracted tx hash: $tx_hash"
    echo "Timestamp: $deploy_timestamp"
    
    # Update JSON with extracted details
    update_contracts_json "$network" "$contract_name" "$contract_id" "$tx_hash" "$deploy_timestamp"
}

# === Command Line Processing ===
# Parse arguments with getopts-style handler
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --authority)
      deploy_authority=true
      shift # past argument
      ;;
    --protocol)
      deploy_protocol=true
      shift # past argument
      ;;
    --network)
      network_name="$2"
      shift # past argument
      shift # past value
      ;;
    --source)
      source_identity="$2"
      shift # past argument
      shift # past value
      ;;
    --mode)
      mode="$2"
      if [[ "$mode" != "default" && "$mode" != "clean" ]]; then
        echo "Error: Invalid mode '$mode'. Use 'default' or 'clean'."
        usage
      fi
      shift # past argument
      shift # past value
      ;;
    -h|--help)
      usage
      ;;
    *) # unknown option
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

# Apply defaults for minimal config
if [[ -z "$network_name" ]]; then
  network_name="$DEFAULT_NETWORK"
fi
if [[ -z "$source_identity" ]]; then
  source_identity="$DEFAULT_SOURCE"
fi

# === Validation ===
check_jq  # Ensure required tools exist

# Prevent accidental empty runs
if [[ "$deploy_authority" = false && "$deploy_protocol" = false ]]; then
  echo "Error: No contracts specified for deployment. Use --authority and/or --protocol."
  usage
fi

# Confirm deployment settings to prevent accidents
echo "Selected Network: ${network_name}"
echo "Deployment Identity: ${source_identity}"
echo "Mode: ${mode}"
echo "Deploy Authority: ${deploy_authority}"
echo "Deploy Protocol: ${deploy_protocol}"
echo "Contracts JSON: ${CONTRACTS_JSON_FILE}"
echo ""
read -p "Proceed with deployment? (y/N): " confirm && [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]] || exit 1
echo ""

# === Directory Setup ===
# Ensure correct path resolution
script_dir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd "$script_dir"
echo "Changed directory to: $(pwd)"

# === Build Process ===
# Clean build + test if requested
if [[ "$mode" == "clean" ]]; then
  log_step "Running Cargo Clean"
  cargo clean
  echo "Clean completed."

  log_step "Running Tests"
  cargo test --workspace
  echo "Tests completed."
else
    log_step "Skipping Clean and Test (Mode: default)"
fi

# Build contracts to WASM format
log_step "Building Contracts"
stellar contract build
echo "Build completed."

# === Contract Deployment Function ===
# Deploy contract and process deployment info
# Args: contract_name, wasm_path
# Sets: DEPLOYED_CONTRACT_ID, DEPLOYED_TX_HASH
# Exit: 0=success, 1=failure
deploy_contract() {
  local contract_name=$1
  local wasm_path=$2
  # These will be set globally

  log_step "Deploying ${contract_name} Contract"
  echo "Deploying ${wasm_path}..."

  # Create a temporary file securely using mktemp.
  local temp_output
  temp_output=$(mktemp)
  if [[ -z "$temp_output" ]]; then
      echo "Error: Failed to create temporary file."
      return 1
  fi

  # Run the deploy command.
  # Redirect stderr (2) to stdout (1) BEFORE piping (|) to `tee`.
  # This is necessary because `stellar contract deploy` prints essential info
  # (like tx hash) to stderr, and the pipe only captures stdout by default.
  # `tee` writes the combined output to the temporary file AND the console.
  stellar contract deploy --wasm "${wasm_path}" --source "${source_identity}" --network "${network_name}" 2>&1 | tee "$temp_output"
  # Check the exit status of the `stellar` command (the first command in the pipe)
  # using PIPESTATUS[0], because `$?` would give the exit status of `tee`.
  local deploy_exit_code=${PIPESTATUS[0]}

  # Check if the deployment command itself failed.
  if [[ $deploy_exit_code -ne 0 ]]; then
      echo "Error: Deployment command failed for ${contract_name} (Exit Code: $deploy_exit_code)."
      cat "$temp_output" # Show output on error
      rm "$temp_output"
      return 1 # Return non-zero status
  fi

  # Read the full captured output (stdout + stderr) from the temp file.
  local deploy_output
  deploy_output=$(cat "$temp_output")
  rm "$temp_output" # Clean up temp file immediately after use.

  # Extract transaction hash using grep and awk.
  # Assumes specific output format from `stellar contract deploy`.
  local tx_hash=$(echo "$deploy_output" | grep "Transaction hash is" | awk '{print $NF}')

  # Extract contract ID using grep and sed with a regex.
  # Assumes specific output format from `stellar contract deploy`.
  local contract_id=$(echo "$deploy_output" | grep "stellar.expert/explorer/.*/contract/" | sed -E 's|.*contract/([A-Z0-9]+).*|\1|')

  # Get current UTC timestamp.
  local deploy_timestamp=$(date -u +'%Y-%m-%dT%H:%M:%SZ')

  # Validate extracted contract ID format using regex.
  # Provides robustness against unexpected output changes.
  if [[ ! "$contract_id" =~ ^C[A-Z0-9]{55}$ ]]; then
      echo "Error: Failed to extract valid contract ID for ${contract_name}."
      echo "Extracted ID: '$contract_id' from output:"
      echo "$deploy_output"
      return 1 # Return non-zero status
  fi

  # Validate extracted transaction hash format (basic length check).
  if [[ -z "$tx_hash" || ${#tx_hash} -ne 64 ]]; then
      echo "Warning: Could not reliably extract transaction hash for ${contract_name}. Storing empty hash."
      tx_hash=""
  fi

  # Display extracted details
  echo "${contract_name} Contract ID: ${contract_id}"
  echo "${contract_name} Tx Hash: ${tx_hash:-Not Found}"
  echo "${contract_name} Timestamp: ${deploy_timestamp}"

  # Call the internal function to update the JSON file
  update_contracts_json "$network_name" "$contract_name" "$contract_id" "$tx_hash" "$deploy_timestamp"
  local update_exit_code=$?
  if [[ $update_exit_code -ne 0 ]]; then
      echo "Error: update_contracts_json failed for ${contract_name} (Exit Code: $update_exit_code)."
      return 1 # Propagate failure
  fi

  # Set global variables used by the summary section
  DEPLOYED_CONTRACT_ID="$contract_id"
  DEPLOYED_TX_HASH="$tx_hash"
  
  return 0 # Indicate success
}

# === Deployment Execution ===
# Allow both deployments to attempt even if one fails
set +e

# Initialize tracking variables
DEPLOYED_CONTRACT_ID=""
DEPLOYED_TX_HASH=""
authority_contract_id=""
authority_tx_hash=""
protocol_contract_id=""
protocol_tx_hash=""

# Deploy Authority if requested
if [[ "$deploy_authority" = true ]]; then
  deploy_contract "$AUTHORITY_CONTRACT_NAME" "$AUTHORITY_WASM_PATH"
  if [[ $? -eq 0 ]]; then
    authority_contract_id="$DEPLOYED_CONTRACT_ID"
    authority_tx_hash="$DEPLOYED_TX_HASH"
  else
    echo "ERROR: Authority contract deployment failed. Summary might be incomplete."
  fi
fi

# Reset tracking (prevent cross-contamination)
DEPLOYED_CONTRACT_ID=""
DEPLOYED_TX_HASH=""

# Deploy Protocol if requested
if [[ "$deploy_protocol" = true ]]; then
  deploy_contract "$PROTOCOL_CONTRACT_NAME" "$PROTOCOL_WASM_PATH"
  if [[ $? -eq 0 ]]; then
    protocol_contract_id="$DEPLOYED_CONTRACT_ID"
    protocol_tx_hash="$DEPLOYED_TX_HASH"
  else
    echo "ERROR: Protocol contract deployment failed. Summary might be incomplete."
  fi
fi

# Resume strict error checking
set -e

# === Summary ===
# Display deployment results with explorer links
log_step "Deployment Summary"
echo "Network: ${network_name}"
echo "Mode: ${mode}"
if [[ "$deploy_authority" = true && -n "$authority_contract_id" ]]; then
  echo "Authority Contract ID: ${authority_contract_id}"
  echo "Authority Tx Hash: ${authority_tx_hash:-Not Found}"
  if [[ -n "$authority_tx_hash" ]]; then
    echo "Authority Tx URL: https://stellar.expert/explorer/${network_name}/tx/${authority_tx_hash}"
  fi
fi
if [[ "$deploy_protocol" = true && -n "$protocol_contract_id" ]]; then
  echo "Protocol Contract ID: ${protocol_contract_id}"
  echo "Protocol Tx Hash: ${protocol_tx_hash:-Not Found}"
  if [[ -n "$protocol_tx_hash" ]]; then
    echo "Protocol Tx URL: https://stellar.expert/explorer/${network_name}/tx/${protocol_tx_hash}"
  fi
fi
echo "Contract details saved to ${CONTRACTS_JSON_FILE}"
echo "Deployment script finished successfully."

exit 0 