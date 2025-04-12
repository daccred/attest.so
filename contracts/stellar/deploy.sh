#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e
# Treat unset variables as an error when substituting.
set -u
# Pipe commands return the exit status of the last command in the pipe
set -o pipefail

# --- Configuration ---
DEFAULT_NETWORK="testnet"
DEFAULT_SOURCE="drew" # Default identity to use for deployment
CONTRACTS_JSON_FILE="deployments.json" # File to store deployed contract details
AUTHORITY_CONTRACT_NAME="authority"
PROTOCOL_CONTRACT_NAME="protocol"
AUTHORITY_WASM_PATH="target/wasm32-unknown-unknown/release/${AUTHORITY_CONTRACT_NAME}.wasm"
PROTOCOL_WASM_PATH="target/wasm32-unknown-unknown/release/${PROTOCOL_CONTRACT_NAME}.wasm"

# --- Script Variables ---
deploy_authority=false
deploy_protocol=false
network_name=""
source_identity=""
mode="default" # Modes: default, clean

# --- Helper Functions ---
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

log_step() {
  echo ""
  echo "========================================"
  echo "STEP: $1"
  echo "========================================"
}

check_jq() {
  if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install jq (e.g., 'brew install jq' or 'sudo apt-get install jq')."
    exit 1
  fi
}

update_contracts_json() {
    local network=$1
    local contract_name=$2
    local contract_id=$3
    local tx_hash=$4
    local deploy_timestamp=$5
    local tmp_json_file="${CONTRACTS_JSON_FILE}.tmp"

    echo "Updating ${CONTRACTS_JSON_FILE} for network '${network}' with ${contract_name} details..."

    # Read existing JSON or initialize if file doesn't exist
    local current_json
    if [[ -f "$CONTRACTS_JSON_FILE" ]]; then
        current_json=$(cat "$CONTRACTS_JSON_FILE")
    else
        current_json="{}"
    fi

    # Create the nested object for the contract
    local contract_data
    contract_data=$(jq -n \
      --arg id "$contract_id" \
      --arg hash "$tx_hash" \
      --arg ts "$deploy_timestamp" \
      '{id: $id, hash: $hash, timestamp: $ts}')

    # Use jq to update the main JSON structure, capturing stderr
    jq_stderr=$(echo "$current_json" | jq \
        --arg net "$network" \
        --arg name "$contract_name" \
        --argjson data "$contract_data" \
        '.[$net] |= (if . == null then {} else . end) | .[$net][$name] = $data' \
        > "$tmp_json_file" 2>&1)
    local jq_exit_code=$?

    # Check if jq command was successful
    if [[ $jq_exit_code -ne 0 ]]; then
      echo "Error: Failed to update JSON using jq (Exit Code: $jq_exit_code)."
      echo "jq stderr: $jq_stderr"
      if [[ -f "$tmp_json_file" ]]; then rm -f "$tmp_json_file"; fi
      exit 1
    fi

    # Verify the temp file content
    if grep -q "$contract_id" "$tmp_json_file"; then
        true # Placeholder for successful grep
    else
        echo "Error: Temp file $tmp_json_file does NOT contain the new contract ID $contract_id!"
        cat "$tmp_json_file"
        rm -f "$tmp_json_file"
        exit 1
    fi

    # Replace the old file with the new one
    mv -f "$tmp_json_file" "$CONTRACTS_JSON_FILE"
    local mv_exit_code=$?

    if [[ $mv_exit_code -ne 0 ]]; then
        echo "Error: Failed to move $tmp_json_file to $CONTRACTS_JSON_FILE (Exit Code: $mv_exit_code)."
        if [[ -f "$tmp_json_file" ]]; then rm -f "$tmp_json_file"; fi # Clean up if move failed
        exit 1
    fi

    echo "${CONTRACTS_JSON_FILE} updated successfully."

}

# Function to extract deployment details from output
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

# --- Argument Parsing ---
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

# --- Set Defaults ---
if [[ -z "$network_name" ]]; then
  network_name="$DEFAULT_NETWORK"
fi
if [[ -z "$source_identity" ]]; then
  source_identity="$DEFAULT_SOURCE"
fi

# --- Validation ---
check_jq

if [[ "$deploy_authority" = false && "$deploy_protocol" = false ]]; then
  echo "Error: No contracts specified for deployment. Use --authority and/or --protocol."
  usage
fi

echo "Selected Network: ${network_name}"
echo "Deployment Identity: ${source_identity}"
echo "Mode: ${mode}"
echo "Deploy Authority: ${deploy_authority}"
echo "Deploy Protocol: ${deploy_protocol}"
echo "Contracts JSON: ${CONTRACTS_JSON_FILE}"
echo ""
read -p "Proceed with deployment? (y/N): " confirm && [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]] || exit 1
echo ""


# --- Ensure we are in the correct directory (contracts/stellar) ---
script_dir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
# workspace_dir=$(dirname "$script_dir") # No longer needed as script is in workspace_dir
cd "$script_dir" # Script is now directly in the workspace dir
echo "Changed directory to: $(pwd)"


# --- Clean & Test (if in clean mode) ---
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


# --- Build ---
log_step "Building Contracts"
stellar contract build
echo "Build completed."


# --- Deployment ---

# Define the deploy_contract function here
deploy_contract() {
  local contract_name=$1
  local wasm_path=$2
  # These will be set globally

  log_step "Deploying ${contract_name} Contract"
  echo "Deploying ${wasm_path}..."

  # Create a temporary file to capture output
  local temp_output
  temp_output=$(mktemp)
  if [[ -z "$temp_output" ]]; then
      echo "Error: Failed to create temporary file."
      return 1
  fi

  # Run the deploy command, tee output to console and capture in temp file
  # Redirect stderr (2) to stdout (1) BEFORE piping to tee
  stellar contract deploy --wasm "${wasm_path}" --source "${source_identity}" --network "${network_name}" 2>&1 | tee "$temp_output"
  local deploy_exit_code=${PIPESTATUS[0]} # Get exit code of the stellar command

  # Check if the command was successful
  if [[ $deploy_exit_code -ne 0 ]]; then
      echo "Error: Deployment command failed for ${contract_name} (Exit Code: $deploy_exit_code)."
      cat "$temp_output" # Show output on error
      rm "$temp_output"
      return 1 # Return non-zero status
  fi

  # Read the captured output from the temp file
  local deploy_output
  deploy_output=$(cat "$temp_output")
  rm "$temp_output" # Clean up temp file

  # Extract transaction hash from output
  local tx_hash=$(echo "$deploy_output" | grep "Transaction hash is" | awk '{print $NF}')

  # Extract contract ID from URL
  local contract_id=$(echo "$deploy_output" | grep "stellar.expert/explorer/.*/contract/" | sed -E 's|.*contract/([A-Z0-9]+).*|\1|')

  # Create timestamp
  local deploy_timestamp=$(date -u +'%Y-%m-%dT%H:%M:%SZ')

  # Validate contract ID format
  if [[ ! "$contract_id" =~ ^C[A-Z0-9]{55}$ ]]; then
      echo "Error: Failed to extract valid contract ID for ${contract_name}."
      echo "Extracted ID: '$contract_id' from output:"
      echo "$deploy_output"
      return 1 # Return non-zero status
  fi

  # Validate transaction hash
  if [[ -z "$tx_hash" || ${#tx_hash} -ne 64 ]]; then
      echo "Warning: Could not reliably extract transaction hash for ${contract_name}. Storing empty hash."
      tx_hash=""
  fi

  echo "${contract_name} Contract ID: ${contract_id}"
  echo "${contract_name} Tx Hash: ${tx_hash:-Not Found}"
  echo "${contract_name} Timestamp: ${deploy_timestamp}"

  # Update JSON with extracted details using the internal function
  update_contracts_json "$network_name" "$contract_name" "$contract_id" "$tx_hash" "$deploy_timestamp" # Removed 2>&1 as it might hide errors
  local update_exit_code=$?
  if [[ $update_exit_code -ne 0 ]]; then
      echo "Error: update_contracts_json failed for ${contract_name} (Exit Code: $update_exit_code)."
      return 1 # Propagate failure
  fi

  # Set global variables 
  DEPLOYED_CONTRACT_ID="$contract_id"
  DEPLOYED_TX_HASH="$tx_hash"
  
  return 0 # Indicate success
}

# Temporarily disable exit on error before calling deploy_contract
set +e

DEPLOYED_CONTRACT_ID=""
DEPLOYED_TX_HASH=""
authority_contract_id=""
authority_tx_hash=""
protocol_contract_id=""
protocol_tx_hash=""

if [[ "$deploy_authority" = true ]]; then
  deploy_contract "$AUTHORITY_CONTRACT_NAME" "$AUTHORITY_WASM_PATH"
  if [[ $? -eq 0 ]]; then # Check if deploy_contract succeeded
    authority_contract_id="$DEPLOYED_CONTRACT_ID"
    authority_tx_hash="$DEPLOYED_TX_HASH"
  else
    echo "ERROR: Authority contract deployment failed. Aborting summary."
  fi
fi

DEPLOYED_CONTRACT_ID="" # Reset for next potential call
DEPLOYED_TX_HASH=""

if [[ "$deploy_protocol" = true ]]; then
  deploy_contract "$PROTOCOL_CONTRACT_NAME" "$PROTOCOL_WASM_PATH"
  if [[ $? -eq 0 ]]; then # Check if deploy_contract succeeded
    protocol_contract_id="$DEPLOYED_CONTRACT_ID"
    protocol_tx_hash="$DEPLOYED_TX_HASH"
  else
    echo "ERROR: Protocol contract deployment failed. Aborting summary."
  fi
fi

# Re-enable exit on error
set -e

# --- Summary ---
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