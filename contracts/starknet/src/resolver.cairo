use starknet::{ContractAddress, contract_address_const, get_caller_address,};

#[starknet::interface]
pub trait ISchemaResolver<TContractState> {
    fn isPayable(self: @TContractState) -> bool;
// fn attest(ref self: TContractState, attestation: Attestation) -> bool;
// fn multiAttest(ref self: TContractState, attestations: Array<Attestation>, values: Array<u256>) -> bool;
// fn revoke(ref self: TContractState, attestation: Attestation) -> bool;
// fn multiRevoke(ref self: TContractState, attestations: Array<Attestation>, values: Array<u256>) -> bool;
// fn onAttest(ref self: TContractState, attestation: Attestation, values: u256) -> bool;
// fn onRevoke(ref self: TContractState, attestation: Attestation, values: u256) -> bool;
// fn _onlyEAS(self: @TContractState);

}

#[starknet::contract]
mod SchemaResolver {
    use core::result::ResultTrait;
    use core::array::ArrayTrait;
    use super::{ContractAddress};
    #[storage]
    struct Storage {}

    #[constructor]
    fn constructor(ref self: ContractState) {}

    /// @notice Emitted when a new schema has been registered
    /// @param uid The schema UID.
    /// @param registerer The address of the account used to register the schema.
    /// @param schema The schema data.
    // event Registered(bytes32 indexed uid, address indexed registerer, SchemaRecord schema);
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {}

    #[abi(embed_v0)]
    impl SchemaRegistryImpl of super::ISchemaResolver<ContractState> {
        fn isPayable(self: @ContractState) -> bool {
            return true;
        }
    }
}
// import { IEAS, Attestation } from "../IEAS.sol";
// import { AccessDenied, InvalidEAS, InvalidLength, uncheckedInc } from "../Common.sol";
// import { Semver } from "../Semver.sol";

// import { ISchemaResolver } from "./ISchemaResolver.sol";

// /// @title SchemaResolver
// /// @notice The base schema resolver contract.
// abstract contract SchemaResolver is ISchemaResolver, Semver {
//     error InsufficientValue();
//     error NotPayable();

//     // The global EAS contract.
//     IEAS internal immutable _eas;

//     /// @dev Creates a new resolver.
//     /// @param eas The address of the global EAS contract.
//     constructor(IEAS eas) Semver(1, 3, 0) {
//         if (address(eas) == address(0)) {
//             revert InvalidEAS();
//         }

//         _eas = eas;
//     }

//     /// @dev Ensures that only the EAS contract can make this call.
//     modifier onlyEAS() {
//         _onlyEAS();

//         _;
//     }

//     /// @inheritdoc ISchemaResolver
//     function isPayable() public pure virtual returns (bool) {
//         return false;
//     }

//     /// @dev ETH callback.
//     receive() external payable virtual {
//         if (!isPayable()) {
//             revert NotPayable();
//         }
//     }

//     /// @inheritdoc ISchemaResolver
//     function attest(Attestation calldata attestation) external payable onlyEAS returns (bool) {
//         return onAttest(attestation, msg.value);
//     }

//     /// @inheritdoc ISchemaResolver
//     function multiAttest(
//         Attestation[] calldata attestations,
//         uint256[] calldata values
//     ) external payable onlyEAS returns (bool) {
//         uint256 length = attestations.length;
//         if (length != values.length) {
//             revert InvalidLength();
//         }

//         // We are keeping track of the remaining ETH amount that can be sent to resolvers and will keep deducting
//         // from it to verify that there isn't any attempt to send too much ETH to resolvers. Please note that unless
//         // some ETH was stuck in the contract by accident (which shouldn't happen in normal conditions), it won't be
//         // possible to send too much ETH anyway.
//         uint256 remainingValue = msg.value;

//         for (uint256 i = 0; i < length; i = uncheckedInc(i)) {
//             // Ensure that the attester/revoker doesn't try to spend more than available.
//             uint256 value = values[i];
//             if (value > remainingValue) {
//                 revert InsufficientValue();
//             }

//             // Forward the attestation to the underlying resolver and return false in case it isn't approved.
//             if (!onAttest(attestations[i], value)) {
//                 return false;
//             }

//             unchecked {
//                 // Subtract the ETH amount, that was provided to this attestation, from the global remaining ETH amount.
//                 remainingValue -= value;
//             }
//         }

//         return true;
//     }

//     /// @inheritdoc ISchemaResolver
//     function revoke(Attestation calldata attestation) external payable onlyEAS returns (bool) {
//         return onRevoke(attestation, msg.value);
//     }

//     /// @inheritdoc ISchemaResolver
//     function multiRevoke(
//         Attestation[] calldata attestations,
//         uint256[] calldata values
//     ) external payable onlyEAS returns (bool) {
//         uint256 length = attestations.length;
//         if (length != values.length) {
//             revert InvalidLength();
//         }

//         // We are keeping track of the remaining ETH amount that can be sent to resolvers and will keep deducting
//         // from it to verify that there isn't any attempt to send too much ETH to resolvers. Please note that unless
//         // some ETH was stuck in the contract by accident (which shouldn't happen in normal conditions), it won't be
//         // possible to send too much ETH anyway.
//         uint256 remainingValue = msg.value;

//         for (uint256 i = 0; i < length; i = uncheckedInc(i)) {
//             // Ensure that the attester/revoker doesn't try to spend more than available.
//             uint256 value = values[i];
//             if (value > remainingValue) {
//                 revert InsufficientValue();
//             }

//             // Forward the revocation to the underlying resolver and return false in case it isn't approved.
//             if (!onRevoke(attestations[i], value)) {
//                 return false;
//             }

//             unchecked {
//                 // Subtract the ETH amount, that was provided to this attestation, from the global remaining ETH amount.
//                 remainingValue -= value;
//             }
//         }

//         return true;
//     }

//     /// @notice A resolver callback that should be implemented by child contracts.
//     /// @param attestation The new attestation.
//     /// @param value An explicit ETH amount that was sent to the resolver. Please note that this value is verified in
//     ///     both attest() and multiAttest() callbacks EAS-only callbacks and that in case of multi attestations, it'll
//     ///     usually hold that msg.value != value, since msg.value aggregated the sent ETH amounts for all the
//     ///     attestations in the batch.
//     /// @return Whether the attestation is valid.
//     function onAttest(Attestation calldata attestation, uint256 value) internal virtual returns (bool);

//     /// @notice Processes an attestation revocation and verifies if it can be revoked.
//     /// @param attestation The existing attestation to be revoked.
//     /// @param value An explicit ETH amount that was sent to the resolver. Please note that this value is verified in
//     ///     both revoke() and multiRevoke() callbacks EAS-only callbacks and that in case of multi attestations, it'll
//     ///     usually hold that msg.value != value, since msg.value aggregated the sent ETH amounts for all the
//     ///     attestations in the batch.
//     /// @return Whether the attestation can be revoked.
//     function onRevoke(Attestation calldata attestation, uint256 value) internal virtual returns (bool);

//     /// @dev Ensures that only the EAS contract can make this call.
//     function _onlyEAS() private view {
//         if (msg.sender != address(_eas)) {
//             revert AccessDenied();
//         }
//     }
// }


