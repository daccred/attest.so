use starknet::ContractAddress;

#[starknet::interface]
trait ISemver<TContractState> {
    fn version(self: @TContractState) -> felt252;
}
