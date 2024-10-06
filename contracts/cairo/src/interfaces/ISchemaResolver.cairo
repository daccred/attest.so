use starknet::ContractAddress;
use attestme::interfaces::ISemver;
use attestme::helpers::common;

#[starknet::interface]
trait ISchemaResolver<TContractState> {
    /// @notice Checks if the resolver can be sent ETH.
    /// @return Whether the resolver supports ETH transfers.
    fn isPayable(self: @TContractState) -> bool;

    /// @notice Processes an attestation and verifies whether it's valid.
    /// @param attestation The new attestation.
    /// @return Whether the attestation is valid.
    fn attest(ref self: TContractState, attestation: common::Attestation) -> bool;

    /// @notice Processes multiple attestations and verifies whether they are valid.
    /// @param attestations The new attestations.
    /// @param values Explicit ETH amounts which were sent with each attestation.
    /// @return Whether all the attestations are valid.
    fn multiAttest(ref self: TContractState, attestations: Array<common::Attestation>, values: Array<felt252>) -> bool;

    /// @notice Processes an attestation revocation and verifies if it can be revoked.
    /// @param attestation The existing attestation to be revoked.
    /// @return Whether the attestation can be revoked.
    fn revoke(ref self: TContractState,  attestation: common::Attestation) -> bool;

    /// @notice Processes revocation of multiple attestation and verifies they can be revoked.
    /// @param attestations The existing attestations to be revoked.
    /// @param values Explicit ETH amounts which were sent with each revocation.
    /// @return Whether the attestations can be revoked.
    fn multiRevoke(ref self: TContractState, attestations: Array<common::Attestation>, values: Array<felt252>) -> bool;

}



