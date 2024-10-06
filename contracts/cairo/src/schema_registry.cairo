use starknet::{ContractAddress, contract_address_const, get_caller_address, get_block_timestamp};
use attestme::helpers::common::{Errors, EMPTY_UID};
use core::panic_with_felt252;
use core::keccak::keccak_u256s_be_inputs;
use alexandria_storage::{List, ListTrait};

/// @notice A struct representing a record for a submitted schema.
#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct SchemaRecord {
    pub uid: u256, // The unique identifier of the schema.
    pub resolver: ContractAddress, // Optional schema resolver. // ISchemaResolver
    pub revocable: bool // Whether the schema allows revocations explicitly.
}

#[starknet::interface]
pub trait ISchemaRegistry<TContractState> {
    fn register(
        ref self: TContractState, schema: ByteArray, resolver: ContractAddress, revocable: bool
    ) -> u256;
    fn get_schema(self: @TContractState, uid: u256) -> (SchemaRecord, ByteArray);
    fn get_all_uids(self: @TContractState) -> Array<u256>;
    fn get_all_schemas_records(self: @TContractState) -> Array<SchemaRecord>;
}

#[starknet::contract]
mod SchemaRegistry {
    use core::result::ResultTrait;
    use core::array::ArrayTrait;
    use super::{
        ContractAddress, SchemaRecord, Errors, EMPTY_UID, get_caller_address,
        contract_address_const, panic_with_felt252, keccak_u256s_be_inputs, List, ListTrait,
        get_block_timestamp
    };
    #[storage]
    struct Storage {
        // The global mapping between schema records and their IDs.
        _registry: LegacyMap::<u256, SchemaRecord>,
        _schema: LegacyMap::<u256, ByteArray>,
        _uids: List<u256>,
        _schemaRecords: List<SchemaRecord>
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    /// @notice Emitted when a new schema has been registered
    /// @param uid The schema UID.
    /// @param registerer The address of the account used to register the schema.
    /// @param schema The schema data.
    // event Registered(bytes32 indexed uid, address indexed registerer, SchemaRecord schema);
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Registered: Registered,
    }

    #[derive(Drop, starknet::Event)]
    struct Registered {
        // #[key]
        timestamp: u64,
        uid: u256, // bytes32
        // #[key]
        registerer: ContractAddress,
        schemaRecord: SchemaRecord,
        schema: ByteArray
    }

    #[abi(embed_v0)]
    impl SchemaRegistryImpl of super::ISchemaRegistry<ContractState> {
        fn register(
            ref self: ContractState, schema: ByteArray, resolver: ContractAddress, revocable: bool
        ) -> u256 {
            let mut _schemaRecord: SchemaRecord = SchemaRecord {
                uid: EMPTY_UID, resolver: resolver, revocable: revocable
            };
            let schema_ = schema.clone();
            let schema_clone = schema.clone();
            // let schema_to_be_inserted = schema.clone();
            let uid: u256 = self._getUID(_schemaRecord, get_caller_address(), schema_);
            if (self._registry.read(uid).uid != EMPTY_UID) {
                panic_with_felt252(Errors::AlreadyExists);
            }
            _schemaRecord.uid = uid;
            self._registry.write(uid, _schemaRecord);

            self._schema.write(uid, schema);

            let mut _uids: List<u256> = self._uids.read();
            _uids.append(uid).unwrap();
            self._uids.write(_uids);

            let mut _schemaRecords: List<SchemaRecord> = self._schemaRecords.read();
            _schemaRecords.append(_schemaRecord).unwrap();
            self._schemaRecords.write(_schemaRecords);

            self
                .emit(
                    Event::Registered(
                        Registered {
                            timestamp: get_block_timestamp(),
                            uid: uid,
                            registerer: get_caller_address(),
                            schemaRecord: _schemaRecord,
                            schema: schema_clone,
                        }
                    )
                );
            return uid;
        }

        fn get_schema(self: @ContractState, uid: u256) -> (SchemaRecord, ByteArray) {
            return (self._registry.read(uid), self._schema.read(uid));
        }

        fn get_all_uids(self: @ContractState) -> Array<u256> {
            let uids: List<u256> = self._uids.read();
            return uids.array().unwrap();
        }

        fn get_all_schemas_records(self: @ContractState) -> Array<SchemaRecord> {
            let _schemaRecords: List<SchemaRecord> = self._schemaRecords.read();
            return _schemaRecords.array().unwrap();
        }
    }

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        /// @dev Calculates a UID for a given schema.
        /// @param schemaRecord The input schema.
        /// @return schema UID.
        fn _getUID(
            self: @ContractState,
            _schemaRecord: SchemaRecord, // registerer: ContractAddress,
            registerer: ContractAddress,
            _schema: ByteArray
        ) -> u256 {
            let mut input_array: Array<u256> = ArrayTrait::new();
            let schema_u256: u256 = _schemaRecord.uid;
            input_array.append(schema_u256);
            let resolver_address: felt252 = _schemaRecord.resolver.into();
            input_array.append(resolver_address.into());
            if (true) {
                input_array.append(1_u256); // true
            } else {
                input_array.append(0_u256); // false
            }
            let _registerer: felt252 = registerer.into();
            input_array.append(_registerer.into());
            let mut schema_length = _schema.len();
            let mut i: u32 = 0_u32;

            if (schema_length != 0) {
                loop {
                    let schema_at: Option = _schema.at(i);
                    if (schema_length != 0) {
                        let unwrapped: u8 = schema_at.unwrap();

                        input_array.append(unwrapped.into());
                        schema_length -= 1_u32;
                        i += 1_u32;
                    }

                    if (schema_length == 0) {
                        break;
                    }
                };
            }
            let inputs: Span<u256> = input_array.span();
            return keccak_u256s_be_inputs(inputs);
        }
    }
}
