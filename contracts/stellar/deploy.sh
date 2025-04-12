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
CONTRACTS_JSON_FILE="contracts.json" # File to store deployed contract IDs
AUTHORITY_CONTRACT_NAME="authority"
PROTOCOL_CONTRACT_NAME="protocol"
AUTHORITY_WASM_PATH="target/wasm32-unknown-unknown/release/${AUTHORITY_CONTRACT_NAME}.wasm"
PROTOCOL_WASM_PATH="target/wasm32-unknown-unknown/release/${PROTOCOL_CONTRACT_NAME}.wasm"

# --- Script Variables ---
deploy_authority=false
deploy_protocol=false
network_name=""
source_identity=""

# --- Helper Functions ---
usage() {
  echo "Usage: $0 [--authority] [--protocol] [--network <network_name>] [--source <identity_name>] [-h|--help]"
  echo ""
  echo "Builds, tests, and deploys Soroban contracts, storing IDs in ${CONTRACTS_JSON_FILE}."
  echo ""
  echo "Options:"
  echo "  --authority         Deploy the authority contract."
  echo "  --protocol          Deploy the protocol contract."
  echo "  --network <name>    Specify the network (e.g., testnet, mainnet). Default: ${DEFAULT_NETWORK}"
  echo "  --source <identity> Specify the source identity for deployment. Default: ${DEFAULT_SOURCE}"
  echo "  -h, --help          Display this help message."
  exit 1
}

log_step() {
  echo ""
  echo "----------------------------------------"
  echo "STEP: $1"
  echo "----------------------------------------"
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
    local tmp_json_file="${CONTRACTS_JSON_FILE}.tmp"

    echo "Updating ${CONTRACTS_JSON_FILE} for network '${network}' with ${contract_name} ID: ${contract_id}"

    # Read existing JSON or initialize if file doesn't exist
    local current_json
    if [[ -f "$CONTRACTS_JSON_FILE" ]]; then
        current_json=$(cat "$CONTRACTS_JSON_FILE")
    else
        current_json="{}"
    fi

    # Use jq to update the JSON structure
    # Creates the network object if it doesn't exist
    # Updates the specific contract ID within that network
    echo "$current_json" | jq \
        --arg net "$network" \
        --arg name "$contract_name" \
        --arg id "$contract_id" \
        '.[$net] |= (if . == null then {} else . end) | .[$net][$name] = $id' \
        > "$tmp_json_file"

    # Check if jq command was successful
    if [[ $? -ne 0 ]]; then
      echo "Error: Failed to update JSON using jq."
      rm -f "$tmp_json_file" # Clean up temp file
      exit 1
    fi

    # Replace the old file with the new one
    mv "$tmp_json_file" "$CONTRACTS_JSON_FILE"
    echo "${CONTRACTS_JSON_FILE} updated successfully."
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


# --- Build & Test ---
log_step "Running Tests"
cargo test --workspace
echo "Tests completed."

log_step "Building Contracts"
stellar contract build
echo "Build completed."


# --- Deployment ---
authority_id=""
protocol_id=""

if [[ "$deploy_authority" = true ]]; then
  log_step "Deploying Authority Contract"
  echo "Deploying ${AUTHORITY_WASM_PATH}..."
  deploy_output=$(stellar contract deploy --wasm "${AUTHORITY_WASM_PATH}" --source "${source_identity}" --network "${network_name}")
  echo "$deploy_output" # Print the full output
  # Extract the last line which contains the contract ID
  authority_id=$(echo "$deploy_output" | tail -n 1)
  if [[ ! "$authority_id" =~ ^C[A-Z0-9]{55}$ ]]; then
      echo "Error: Failed to extract valid contract ID for authority."
      exit 1
  fi
  echo "Authority Contract ID: ${authority_id}"
  update_contracts_json "$network_name" "$AUTHORITY_CONTRACT_NAME" "$authority_id"
fi

if [[ "$deploy_protocol" = true ]]; then
  log_step "Deploying Protocol Contract"
   echo "Deploying ${PROTOCOL_WASM_PATH}..."
  deploy_output=$(stellar contract deploy --wasm "${PROTOCOL_WASM_PATH}" --source "${source_identity}" --network "${network_name}")
  echo "$deploy_output" # Print the full output
   # Extract the last line which contains the contract ID
  protocol_id=$(echo "$deploy_output" | tail -n 1)
   if [[ ! "$protocol_id" =~ ^C[A-Z0-9]{55}$ ]]; then
      echo "Error: Failed to extract valid contract ID for protocol."
      exit 1
  fi
  echo "Protocol Contract ID: ${protocol_id}"
  update_contracts_json "$network_name" "$PROTOCOL_CONTRACT_NAME" "$protocol_id"
fi

log_step "Deployment Summary"
echo "Network: ${network_name}"
[[ "$deploy_authority" = true ]] && echo "Authority Contract ID: ${authority_id:-Not Deployed}"
[[ "$deploy_protocol" = true ]] && echo "Protocol Contract ID: ${protocol_id:-Not Deployed}"
echo "Contract IDs saved to ${CONTRACTS_JSON_FILE}"
echo "Deployment script finished successfully."

exit 0 