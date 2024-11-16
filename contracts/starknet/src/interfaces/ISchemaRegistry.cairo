use starknet::ContractAddress;
use starknet_attestso::interfaces::ISchemaResolver;

/// @notice A struct representing a record for a submitted schema.
#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct SchemaRecord {
    uid: felt252, // The unique identifier of the schema.
    schema: felt252, // Custom specification of the schema (e.g., an ABI). // string
    resolver: ContractAddress, // Optional schema resolver. // ISchemaResolver
    revocable: bool // Whether the schema allows revocations explicitly.
}

/// @title ISchemaRegistry
/// @notice The interface of global attestation schemas for the Attestation Service protocol.
#[starknet::interface]
trait ISchemaRegistry<TContractState> {
    /// @notice Submits and reserves a new schema
    /// @param schema The schema data schema. // string
    /// @param resolver An optional schema resolver. // ISchemaResolver
    /// @param revocable Whether the schema allows revocations explicitly.
    /// @return The UID of the new schema. // bytes32
    fn register(ref self: TContractState, schema: felt252, resolver: ContractAddress, revocable: bool) -> u128;

    /// @notice Returns an existing schema by UID
    /// @param uid The UID of the schema to retrieve.
    /// @return The schema data members.
    fn get_schema(self: @TContractState, uid: u128) -> SchemaRecord;
}