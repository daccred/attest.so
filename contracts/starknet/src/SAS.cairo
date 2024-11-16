// import { EIP1271Verifier } from "./eip1271/EIP1271Verifier.sol";

use starknet::{ContractAddress, contract_address_const, get_caller_address, get_block_timestamp};
use core::keccak::keccak_u256s_be_inputs;
use alexandria_storage::{List, ListTrait};


/// @notice A struct representing the full arguments of the attestation request.
#[derive(Drop, Serde)]
pub struct AttestationRequest {
    pub schema: u256, // The unique identifier of the schema.
    pub data: AttestationRequestData // The arguments of the attestation request.
}

/// @notice A struct representing an internal attestation result.
#[derive(Copy, Drop, Serde)]
pub struct AttestationsResult {
    usedValue: u256, // Total ETH amount that was sent to resolvers.
    uids: u256 // UIDs of the new attestations.
}

/// @notice A struct representing the arguments of the attestation request.
#[derive(Drop, Serde)]
pub struct AttestationRequestData {
    pub recipient: ContractAddress, // The recipient of the attestation.
    pub expirationTime: u64, // The time when the attestation expires (Unix timestamp).
    pub revocable: bool, // Whether the attestation is revocable.
    pub refUID: u256, // The UID of the related attestation.
    pub data: ByteArray, // Custom attestation data.
    pub value: u256 // An explicit ETH amount to send to the resolver. This is important to prevent accidental user errors.
}

#[derive(Drop, Serde, starknet::Store)]
pub struct Attestation {
    pub uid: u256,
    pub schema: u256, // string
    pub time: u64,
    pub expirationTime: u64,
    pub revocationTime: u64,
    pub refUID: u256,
    pub recipient: ContractAddress,
    pub attester: ContractAddress,
    pub data: ByteArray,
    pub revocable: bool,
    pub isRevoked: bool
}

/// @notice A struct representing the arguments of the revocation request.
#[derive(Drop, Serde)]
pub struct RevocationRequestData {
    uid: u256, // The UID of the attestation to revoke.
    value: u256 // An explicit ETH amount to send to the resolver. This is important to prevent accidental user errors.
}

/// @notice A struct representing the full arguments of the revocation request.
#[derive(Drop, Serde)]
pub struct RevocationRequest {
    schema: u256, // The unique identifier of the schema.
    data: RevocationRequestData // The arguments of the revocation request.
}

use starknet_attestso::schema_registry::{ISchemaRegistryDispatcher, SchemaRecord};
use starknet_attestso::schema_registry::ISchemaRegistryDispatcherTrait;
use starknet_attestso::{
    semver,
    helpers::common::{
        EMPTY_UID,
        Errors::{
            AccessDenied, InvalidRegistry, InvalidLength, NotFound, InvalidSchema,
            InvalidExpirationTime, Irrevocable, NotPayable, InsufficientValue, InvalidRevocation,
            InvalidAttestation, AlreadyRevoked, AlreadyTimestamped
        },
        NO_EXPIRATION_TIME
    },
    interfaces::{ISchemaResolver},
};

/// @title ISas
/// @notice The interface of global attestation schemas for the Attestation Service protocol.
#[starknet::interface]
pub trait ISAS<TContractState> {
    /// @notice Returns the address of the global schema registry.
    /// @return The address of the global schema registry.
    fn getSchemaRegistry(self: @TContractState) -> ContractAddress; // ISchemaRegistry
    /// @notice Attests to a specific schema.
    /// @param request The arguments of the attestation request.
    /// @return The UID of the new attestation.
    fn attest(ref self: TContractState, request: AttestationRequest) -> u256; // bytes32

    /// @notice Attests to a specific schema via the provided ECDSA signature.
    /// @param delegatedRequest The arguments of the delegated attestation request.
    /// @return The UID of the new attestation.
    // fn attestByDelegation(
    // ref self: TContractState, delegatedRequest: DelegatedAttestationRequest
    // ) -> u128; // bytes32
    /// @notice Attests to multiple schemas.
    /// @param multiRequests The arguments of the multi attestation requests. The requests should be grouped by distinct
    ///     schema ids to benefit from the best batching optimization.
    /// @return The UIDs of the new attestations.
    // fn multiAttest(
    //     ref self: TContractState, multiRequests: Array<MultiAttestationRequest>
    // ) -> Array<u128>;
    /// @notice Attests to multiple schemas using via provided ECDSA signatures.
    /// @param multiDelegatedRequests The arguments of the delegated multi attestation requests. The requests should be
    ///     grouped by distinct schema ids to benefit from the best batching optimization.
    /// @return The UIDs of the new attestations.
    // fn multiAttestByDelegation(
    //     ref self: TContractState, multiDelegatedRequests: Array<MultiDelegatedAttestationRequest>
    // ) -> Array<u128>; // bytes32[]

    /// @notice Revokes an existing attestation to a specific schema.
    /// @param request The arguments of the revocation request.
    fn revoke(ref self: TContractState, request: RevocationRequest);

    /// @notice Revokes an existing attestation to a specific schema via the provided ECDSA signature.
    /// @param delegatedRequest The arguments of the delegated revocation request.
    // fn revokeByDelegation(ref self: TContractState, delegatedRequest: DelegatedRevocationRequest);

    /// @notice Revokes existing attestations to multiple schemas.
    /// @param multiRequests The arguments of the multi revocation requests. The requests should be grouped by distinct
    ///     schema ids to benefit from the best batching optimization.

    // fn multiRevoke(ref self: TContractState, multiRequests: Array<MultiRevocationRequest>);

    /// @notice Revokes existing attestations to multiple schemas via provided ECDSA signatures.
    /// @param multiDelegatedRequests The arguments of the delegated multi revocation attestation requests. The requests
    ///     should be grouped by distinct schema ids to benefit from the best batching optimization.
    // fn multiRevokeByDelegation(
    //     ref self: TContractState, multiDelegatedRequests: Array<MultiDelegatedRevocationRequest>
    // );

    /// @notice Timestamps the specified bytes32 data.
    /// @param data The data to timestamp. // bytes32
    /// @return The timestamp the data was timestamped with.
    fn timestamp(ref self: TContractState, data: u256) -> u64;

    /// @notice Timestamps the specified multiple bytes32 data.
    /// @param data The data to timestamp.
    /// @return The timestamp the data was timestamped with.
    fn multiTimestamp(ref self: TContractState, data: Array<u256>) -> u64;

    // /// @notice Revokes the specified bytes32 data.
    // /// @param data The data to timestamp.
    // /// @return The timestamp the data was revoked with.
    // fn revokeOffchain(ref self: TContractState, data: felt252) -> u64;

    // /// @notice Revokes the specified multiple bytes32 data.
    // /// @param data The data to timestamp.
    // /// @return The timestamp the data was revoked with.
    // fn multiRevokeOffchain(ref self: TContractState, data: Array<felt252>) -> u64;

    /// @notice Returns an existing attestation by UID.
    /// @param uid The UID of the attestation to retrieve.
    /// @return The attestation data members.
    fn getAttestation(self: @TContractState, uid: u256) -> Attestation;

    /// @notice Returns all existing attestation.
    /// @return The attestation data members.
    fn getAllAttestations(self: @TContractState) -> Array<Attestation>;

    /// @notice Checks whether an attestation exists.
    /// @param uid The UID of the attestation to retrieve.
    /// @return Whether an attestation exists.
    fn isAttestationValid(self: @TContractState, uid: u256) -> bool;

    /// @notice Returns the timestamp that the specified data was timestamped with.
    /// @param data The data to query.
    /// @return The timestamp the data was timestamped with.
    fn getTimestamp(self: @TContractState, data: u256) -> u64;

    /// @notice Returns the timestamp that the specified data was timestamped with.
    /// @param data The data to query.
    /// @return The timestamp the data was timestamped with.
    // fn getRevokeOffchain(self: @TContractState, revoker: ContractAddress, data: u256) -> u64;
    fn getNoOfAttestation(self: @TContractState, schemaUID: u256) -> u256;
}

#[starknet::contract]
mod SAS {
    use core::array::SpanTrait;
    use core::serde::Serde;
    // use super::debug::PrintTrait;
    use core::panic_with_felt252;

    use core::traits::Into;
    use core::array::ArrayTrait;
    use super::{
        ContractAddress, contract_address_const, SchemaRecord, Attestation, AttestationRequest,
        AttestationRequestData, InvalidRegistry, InvalidSchema, get_caller_address,
        ISchemaRegistryDispatcher, InvalidExpirationTime, Irrevocable,
        ISchemaRegistryDispatcherTrait, EMPTY_UID, NO_EXPIRATION_TIME, get_block_timestamp,
        keccak_u256s_be_inputs, NotFound, AttestationsResult, NotPayable, InsufficientValue,
        InvalidAttestation, InvalidRevocation, RevocationRequest, RevocationRequestData,
        AccessDenied, AlreadyRevoked, AlreadyTimestamped, List, ListTrait
    };
    #[storage]
    struct Storage {
        // The global mapping between schema records and their IDs.
        _registry: LegacyMap::<u256, SchemaRecord>, // bytes4 => SchemaRecord
        _schemaRegistry: ContractAddress, // The global schema registry, ISchemaRegistry
        _db: LegacyMap::<
            u256, Attestation
        >, // The global mapping between attestations and their UIDs.
        _timestamps: LegacyMap::<
            u256, u64
        >, // The global mapping between data and their timestamps.
        // _revocationsOffchain: LegacyMap::<
        //     (ContractAddress, u256), u64
        // >, // The global mapping between data and their revocation timestamps.
        _noOfAttestation: LegacyMap::<u256, u256>,
        _all_attestation_uids: List<u256>
    }

    /// @dev Creates a new EAS instance.
    /// @param registry The address of the global schema registry.
    #[constructor]
    fn constructor(ref self: ContractState, registry: ContractAddress) {
        if (registry == contract_address_const::<0>()) {
            panic_with_felt252(InvalidRegistry);
        }

        self._schemaRegistry.write(registry);
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Attested: Attested,
        Revoked: Revoked,
        Timestamped: Timestamped,
        // RevokedOffchain: RevokedOffchain
    }

    /// @notice Emitted when an attestation has been made.
    /// @param recipient The recipient of the attestation.
    /// @param attester The attesting account.
    /// @param uid The UID of the new attestation.
    /// @param schemaUID The UID of the schema.
    #[derive(Drop, starknet::Event)]
    struct Attested {
        // #[key]
        recipient: ContractAddress, // bytes32
        // #[key]
        attester: ContractAddress,
        uid: u256,
        // #[key]
        schemaUID: u256,
        timestamp: u64
    }

    /// @notice Emitted when an attestation has been revoked.
    /// @param recipient The recipient of the attestation.
    /// @param revoker The revoker account.
    /// @param schemaUID The UID of the schema.
    /// @param uid The UID the revoked attestation.
    #[derive(Drop, starknet::Event)]
    struct Revoked {
        // #[key]
        recipient: ContractAddress, // bytes32
        // #[key]
        revoker: ContractAddress,
        uid: u256,
        // #[key]
        schemaUID: u256
    }

    /// @notice Emitted when a data has been timestamped.
    /// @param data The data.
    /// @param timestamp The timestamp.
    #[derive(Drop, starknet::Event)]
    struct Timestamped {
        // #[key]
        timestamp: u64,
        data: u256, // bytes32
    // #[key]
    }

    /// @notice Emitted when a data has been revoked.
    /// @param revoker The address of the revoker.
    /// @param data The data.
    /// @param timestamp The timestamp.
    // #[derive(Drop, starknet::Event)]
    // struct RevokedOffchain {
    //     // #[key]
    //     revoker: ContractAddress, // bytes32
    //     // #[key]
    //     timestamp: u64,
    //     data: u256,
    // // #[key]
    // }

    #[abi(embed_v0)]
    impl SASImpl of super::ISAS<ContractState> {
        /// @notice Returns the address of the global schema registry.
        /// @return The address of the global schema registry.
        fn getSchemaRegistry(self: @ContractState) -> ContractAddress {
            return self._schemaRegistry.read();
        }
        /// @notice Attests to a specific schema.
        /// @param request The arguments of the attestation request.
        /// @return The UID of the new attestation.
        fn attest(ref self: ContractState, request: AttestationRequest) -> u256 {
            let mut _attestationRequestData: AttestationRequestData = request.data;
            let mut _attestationsResult: AttestationsResult = self
                ._attest(request.schema, _attestationRequestData, get_caller_address(), 0, true);
            let mut _all_attestation_uids: List<u256> = self._all_attestation_uids.read();
            _all_attestation_uids.append(_attestationsResult.uids).unwrap();
            self._all_attestation_uids.write(_all_attestation_uids);
            return _attestationsResult.uids;
        }
        /// @notice Attests to a specific schema via the provided ECDSA signature.
        /// @param delegatedRequest The arguments of the delegated attestation request.
        /// @return The UID of the new attestation.
        // fn attestByDelegation(
        //     ref self: ContractState, delegatedRequest: DelegatedAttestationRequest
        // ) -> u128 {
        //     return 0_u128;
        // }
        /// @notice Attests to multiple schemas.
        /// @param multiRequests The arguments of the multi attestation requests. The requests should be grouped by distinct
        ///     schema ids to benefit from the best batching optimization.
        /// @return The UIDs of the new attestations.
        // fn multiAttest(
        //     ref self: ContractState, multiRequests: Array<MultiAttestationRequest>
        // ) -> Array<u128> {
        //     let array: Array<u128> = ArrayTrait::new();
        //     return array;
        // }
        /// @notice Attests to multiple schemas using via provided ECDSA signatures.
        /// @param multiDelegatedRequests The arguments of the delegated multi attestation requests. The requests should be
        ///     grouped by distinct schema ids to benefit from the best batching optimization.
        /// @return The UIDs of the new attestations.
        // fn multiAttestByDelegation(
        //     ref self: ContractState, multiDelegatedRequests: Array<MultiDelegatedAttestationRequest>
        // ) -> Array<u128> {
        //     let array: Array<u128> = ArrayTrait::new();
        //     return array;
        // }

        /// @notice Revokes an existing attestation to a specific schema.
        /// @param request The arguments of the revocation request.
        fn revoke(ref self: ContractState, request: RevocationRequest) {
            let _revocationRequestData: RevocationRequestData = request.data;
            self._revoke(request.schema, _revocationRequestData, get_caller_address(), 0, true);
        }

        /// @notice Revokes an existing attestation to a specific schema via the provided ECDSA signature.
        /// @param delegatedRequest The arguments of the delegated revocation request.
        // fn revokeByDelegation(
        //     ref self: ContractState, delegatedRequest: DelegatedRevocationRequest
        // ) {}

        /// @notice Revokes existing attestations to multiple schemas.
        /// @param multiRequests The arguments of the multi revocation requests. The requests should be grouped by distinct
        ///     schema ids to benefit from the best batching optimization.
        // fn multiRevoke(ref self: ContractState, multiRequests: Array<MultiRevocationRequest>) {}

        /// @notice Revokes existing attestations to multiple schemas via provided ECDSA signatures.
        /// @param multiDelegatedRequests The arguments of the delegated multi revocation attestation requests. The requests
        ///     should be grouped by distinct schema ids to benefit from the best batching optimization.
        // fn multiRevokeByDelegation(
        //     ref self: ContractState, multiDelegatedRequests: Array<MultiDelegatedRevocationRequest>
        // ) {}

        /// @notice Timestamps the specified bytes32 data.
        /// @param data The data to timestamp. // bytes32
        /// @return The timestamp the data was timestamped with.
        fn timestamp(ref self: ContractState, data: u256) -> u64 {
            let time: u64 = get_block_timestamp(); // _time();

            self._timestamp(data, time);

            return time;
        }
        /// @notice Timestamps the specified multiple bytes32 data.
        /// @param data The data to timestamp.
        /// @return The timestamp the data was timestamped with.
        fn multiTimestamp(ref self: ContractState, data: Array<u256>) -> u64 {
            0_u64
        }

        /// @notice Revokes the specified bytes32 data.
        /// @param data The data to timestamp.
        /// @return The timestamp the data was revoked with.
        // fn revokeOffchain(ref self: ContractState, data: felt252) -> u64 {
        //     0_u64
        // }

        /// @notice Revokes the specified multiple bytes32 data.
        /// @param data The data to timestamp.
        /// @return The timestamp the data was revoked with.
        // fn multiRevokeOffchain(ref self: ContractState, data: Array<felt252>) -> u64 {
        //     0_u64
        // }

        /// @notice Returns an existing attestation by UID.
        /// @param uid The UID of the attestation to retrieve.
        /// @return The attestation data members.
        // fn getAttestation(ref self: ContractState, uid: felt252) -> Attestation {
        //     let mut _attestation: Attestation = Attestation {
        //         uid: 1_u256,
        //         schema: 0, // string
        //         time: 0_u64, // IResolver
        //         expirationTime: 0_u64,
        //         refUID: 1,
        //         recipient: contract_address_const::<1>(),
        //         attester: contract_address_const::<1>(),
        //         revocable: true,
        //         data: 1
        //     };
        //     _attestation
        // }

        /// @notice Checks whether an attestation exists.
        /// @param uid The UID of the attestation to retrieve.
        /// @return Whether an attestation exists.
        fn isAttestationValid(self: @ContractState, uid: u256) -> bool {
            return self._isAttestationValid(uid);
        }

        /// @notice Returns the timestamp that the specified data was timestamped with.
        /// @param data The data to query.
        /// @return The timestamp the data was timestamped with.
        fn getTimestamp(self: @ContractState, data: u256) -> u64 {
            return self._timestamps.read(data);
        }

        /// @notice Returns the timestamp that the specified data was timestamped with.
        /// @param data The data to query.
        /// @return The timestamp the data was timestamped with.
        // fn getRevokeOffchain(self: @ContractState, revoker: ContractAddress, data: u256) -> u64 {
        //     return self._revocationsOffchain.read((revoker, data));
        // }

        fn getAttestation(self: @ContractState, uid: u256) -> Attestation {
            return self._db.read(uid);
        }

        fn getAllAttestations(self: @ContractState) -> Array<Attestation> {
            let mut _allAttestations: Array<Attestation> = ArrayTrait::new();
            let _getAllAttestationUids: List<u256> = self._all_attestation_uids.read();
            let mut i: u32 = 0;
            loop {
                let _attestation: Attestation = self._db.read(_getAllAttestationUids[i]);
                _allAttestations.append(_attestation);
                i += 1;
                if (i == _getAllAttestationUids.len()) {
                    break;
                }
            };

            return _allAttestations;
        }

        fn getNoOfAttestation(self: @ContractState, schemaUID: u256) -> u256 {
            return self._noOfAttestation.read(schemaUID);
        }
    }

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        /// @dev Attests to a specific schema.
        /// @param schemaUID The unique identifier of the schema to attest to.
        /// @param data The arguments of the attestation requests.
        /// @param attester The attesting account.
        /// @param availableValue The total available ETH amount that can be sent to the resolver.
        /// @param last Whether this is the last attestations/revocations set.
        /// @return The UID of the new attestations and the total sent ETH amount.
        fn _attest(
            ref self: ContractState,
            schemaUID: u256,
            data: AttestationRequestData,
            attester: ContractAddress,
            availableValue: u256,
            last: bool
        ) -> AttestationsResult {
            let (_schemaRecord, _schema) = ISchemaRegistryDispatcher {
                contract_address: self._schemaRegistry.read()
            }
                .get_schema(schemaUID);
            if (_schemaRecord.uid == EMPTY_UID) {
                panic_with_felt252(InvalidSchema);
            }

            // Ensure that either no expiration time was set or that it was set in the future.
            if (data.expirationTime != NO_EXPIRATION_TIME
                && data.expirationTime <= get_block_timestamp()) {
                panic_with_felt252(InvalidExpirationTime);
            }

            // Ensure that we aren't trying to make a revocable attestation for a non-revocable schema.
            if (!_schemaRecord.revocable && data.revocable) {
                panic_with_felt252(Irrevocable);
            }

            let mut _attestation: Attestation = Attestation {
                uid: EMPTY_UID,
                schema: schemaUID,
                refUID: data.refUID,
                time: get_block_timestamp(),
                expirationTime: data.expirationTime,
                revocationTime: 0_u64,
                recipient: data.recipient,
                attester: attester,
                data: data.data,
                revocable: data.revocable,
                isRevoked: false
            };

            // Look for the first non-existing UID (and use a bump seed/nonce in the rare case of a conflict).
            let mut uid: u256 = 0;
            let mut bump: u32 = 0;
            loop {
                uid = self
                    ._getUID(
                        Attestation {
                            uid: EMPTY_UID,
                            schema: schemaUID,
                            refUID: data.refUID,
                            time: get_block_timestamp(),
                            expirationTime: data.expirationTime,
                            revocationTime: 0_u64,
                            recipient: data.recipient,
                            attester: attester,
                            data: "",
                            revocable: data.revocable,
                            isRevoked: false
                        },
                        bump
                    );
                if (self._db.read(uid).uid == EMPTY_UID) {
                    break;
                }

                bump += 1;
            };
            _attestation.uid = uid;
            self._db.write(uid, _attestation);
            self._timestamps.write(uid, get_block_timestamp()); // Need to review it

            if (data.refUID != EMPTY_UID) {
                // Ensure that we aren't trying to attest to a non-existing referenced UID.
                let uid: u256 = self._db.read(data.refUID).uid;
                if (uid == EMPTY_UID) {
                    panic_with_felt252(NotFound);
                }
            }

            // attestations[i] = attestation;
            // values[i] = request.value;

            // let usedValue: u256 = self
            //     ._resolveAttestation(
            //         _schemaRecord, _attestation, data.value, false, availableValue, last
            //     );

            // let mut _uids: Array<u256> = ArrayTrait::new();
            // _uids.append(uid);
            let mut result: AttestationsResult = AttestationsResult { usedValue: 0, uids: uid };
            let mut lastAttastationCount: u256 = self._noOfAttestation.read(schemaUID);
            self._noOfAttestation.write(schemaUID, lastAttastationCount + 1);
            self
                .emit(
                    Event::Attested(
                        Attested {
                            recipient: data.recipient,
                            attester: attester,
                            uid: uid,
                            schemaUID: schemaUID,
                            timestamp: get_block_timestamp()
                        }
                    )
                );

            return result;
        }
        /// @dev Calculates a UID for a given schema.
        /// @param schemaRecord The input schema.
        /// @return schema UID.
        fn _getUID(ref self: ContractState, _attestaion: Attestation, _bump: u32) -> u256 {
            let mut input_array: Array<u256> = ArrayTrait::new();
            let schema: u256 = _attestaion.schema;
            // let recipient = _attestaion.recipient;
            // let attester: u256 = _attestaion.attester.into();
            let time: u256 = _attestaion.time.into();
            let expirationTime: u256 = _attestaion.expirationTime.into();
            // let revocable: u256 = _attestaion.revocable.into();
            let refUID: u256 = _attestaion.refUID;
            // let data: u256 = _attestaion.data.into();
            input_array.append(schema);
            // input_array.append(recipient);
            // input_array.append(attester);
            input_array.append(time);
            input_array.append(expirationTime);
            // input_array.append(revocable);
            input_array.append(refUID);
            // input_array.append(data);
            input_array.append(_bump.into());

            let inputs: Span<u256> = input_array.span();
            return keccak_u256s_be_inputs(inputs);
        }

        fn _isAttestationValid(self: @ContractState, uid: u256) -> bool {
            let uid: u256 = self._db.read(uid).uid;
            if (uid == EMPTY_UID) {
                return false;
            } else {
                return true;
            }
        }

        /// @dev Resolves a new attestation or a revocation of an existing attestation.
        /// @param schemaRecord The schema of the attestation.
        /// @param attestation The data of the attestation to make/revoke.
        /// @param value An explicit ETH amount to send to the resolver.
        /// @param isRevocation Whether to resolve an attestation or its revocation.
        /// @param availableValue The total available ETH amount that can be sent to the resolver.
        /// @param last Whether this is the last attestations/revocations set.
        /// @return Returns the total sent ETH amount.
        fn _resolveAttestation(
            self: @ContractState,
            schemaRecord: SchemaRecord,
            attestation: Attestation,
            value: u256,
            isRevocation: bool,
            availableValue: u256,
            last: bool
        ) -> u256 {
            let resolver: ContractAddress = schemaRecord.resolver;
            if (resolver == contract_address_const::<0>()) {
                // Ensure that we don't accept payments if there is no resolver.
                if (value != 0) {
                    panic_with_felt252(NotPayable);
                }

                if (last) {
                    self._refund(availableValue);
                }

                return 0;
            }
            let mut _availableValue: u256 = availableValue;

            // let isResolverPayable: bool = ISchemaResolverDispatcherTrait { contract_address: resolver}.isPayable();
            let isResolverPayable: bool = true;

            // Ensure that we don't accept payments which can't be forwarded to the resolver.
            if (value != 0) {
                if (isResolverPayable == false) {
                    panic_with_felt252(NotPayable);
                }

                // Ensure that the attester/revoker doesn't try to spend more than available.
                if (value > availableValue) {
                    panic_with_felt252(InsufficientValue);
                }

                // Ensure to deduct the sent value explicitly.
                _availableValue -= value;
            }

            if (isRevocation) {
                // send value
                // let isRevoke: bool = ISchemaResolverDispatcherTrait { contract_address: resolver}.revoke();
                let isRevoke: bool = true;
                if (isRevoke == false) {
                    panic_with_felt252(InvalidRevocation);
                }
            } else {
                // send value
                // let isAttest: bool = ISchemaResolverDispatcherTrait { contract_address: resolver}.attest(attestation);
                let isAttest: bool = true;
                if (isAttest == false) {
                    panic_with_felt252(InvalidAttestation);
                }
            }

            if (last) {
                self._refund(availableValue);
            }

            return value;
        }

        /// @dev Refunds remaining ETH amount to the attester.
        /// @param remainingValue The remaining ETH amount that was not sent to the resolver.

        fn _refund(self: @ContractState, remainingValue: u256) {
            if (remainingValue > 0) { // IERC20DispatcherTrait { contract_address: ETH}.transfer(get_caller_address(), remainingValue);
            }
        }

        /// @dev Revokes an existing attestation to a specific schema.
        /// @param schemaUID The unique identifier of the schema to attest to.
        /// @param data The arguments of the revocation requests.
        /// @param revoker The revoking account.
        /// @param availableValue The total available ETH amount that can be sent to the resolver.
        /// @param last Whether this is the last attestations/revocations set.
        /// @return Returns the total sent ETH amount.
        fn _revoke(
            ref self: ContractState,
            schemaUID: u256,
            data: RevocationRequestData,
            revoker: ContractAddress,
            availableValue: u256,
            last: bool
        ) -> u256 {
            // Ensure that a non-existing schema ID wasn't passed by accident.
            let (_schemaRecord, _schema) = ISchemaRegistryDispatcher {
                contract_address: self._schemaRegistry.read()
            }
                .get_schema(schemaUID);
            if (_schemaRecord.uid == EMPTY_UID) {
                panic_with_felt252(InvalidSchema);
            }

            let mut attestation: Attestation = self._db.read(data.uid);

            // Ensure that we aren't attempting to revoke a non-existing attestation.
            if (attestation.uid == EMPTY_UID) {
                panic_with_felt252(NotFound);
            }

            // Ensure that a wrong schema ID wasn't passed by accident.
            if (attestation.schema != schemaUID) {
                panic_with_felt252(InvalidSchema);
            }
            // Allow only original attesters to revoke their attestations.
            if (attestation.attester != revoker) {
                panic_with_felt252(AccessDenied);
            }
            // Please note that also checking of the schema itself is revocable is unnecessary, since it's not possible to
            // make revocable attestations to an irrevocable schema.
            if (!attestation.revocable) {
                panic_with_felt252(Irrevocable);
            }

            // Ensure that we aren't trying to revoke the same attestation twice.
            if (attestation.revocationTime != 0) {
                panic_with_felt252(AlreadyRevoked);
            }
            // let mut _attestation: Attestation = attestation;
            attestation.revocationTime = get_block_timestamp();
            attestation.isRevoked = true;

            //     attestations[i] = attestation;
            //     values[i] = request.value;

            self
                .emit(
                    Event::Revoked(
                        Revoked {
                            recipient: attestation.recipient,
                            revoker: revoker,
                            uid: data.uid,
                            schemaUID: schemaUID
                        }
                    )
                );
            // return self
            //     ._resolveAttestation(
            //         _schemaRecord, _attestation, data.value, true, availableValue, last
            //     );
            return 0_u256;
        }
        /// @dev Timestamps the specified bytes32 data.
        /// @param data The data to timestamp.
        /// @param time The timestamp.
        fn _timestamp(ref self: ContractState, _data: u256, _time: u64) {
            if (self._timestamps.read(_data) != 0) {
                panic_with_felt252(AlreadyTimestamped);
            }

            self._timestamps.write(_data, _time);

            self.emit(Event::Timestamped(Timestamped { data: _data, timestamp: _time }));
        }
    }
}
