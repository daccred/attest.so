use starknet::ContractAddress;
use attestme::{schema_registry::SchemaRecord};

#[starknet::interface]
trait ISemver<TContractState> {
    fn version(self: @TContractState) -> felt252;
}

#[starknet::contract]
mod Semver {
    use super::{ContractAddress, SchemaRecord, ISemver};
    #[storage]
    struct Storage {
        // Contract's major version number.
        major: felt252, //uint256 private immutable _major;
        // Contract's minor version number.
        minor: felt252, // uint256 private immutable _minor;
        // Contract's patch version number.
        patch: felt252, // uint256 private immutable _patch;
    }

    /// @dev Create a new Semver instance.
    /// @param major Major version number.
    /// @param minor Minor version number.
    /// @param patch Patch version number.
    #[constructor]
    fn constructor(ref self: ContractState, _major: felt252, _minor: felt252, _patch: felt252) {
        self.major.write(_major);
        self.minor.write(_minor);
        self.patch.write(_patch);
    }

    #[abi(embed_v0)]
    impl SemverImpl of ISemver<ContractState> {
        /// @notice Returns the full semver contract version.
        /// @return Semver contract version as a string.
        fn version(self: @ContractState) -> felt252 {
            return 0;
        // return string(abi.encodePacked(Strings.toString(_major), ".", Strings.toString(_minor), ".", Strings.toString(_patch)));
        }
    }
}
