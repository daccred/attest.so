use core::serde::Serde;
use core::traits::Destruct;
use starknet::ContractAddress;
use starknet::contract_address_const;

use snforge_std::{
    declare, ContractClassTrait, start_cheat_caller_address, stop_cheat_caller_address
};

use starknet_attestso::schema_registry::ISchemaRegistrySafeDispatcher;
use starknet_attestso::schema_registry::ISchemaRegistrySafeDispatcherTrait;
use starknet_attestso::schema_registry::ISchemaRegistryDispatcher;
use starknet_attestso::schema_registry::ISchemaRegistryDispatcherTrait;
use starknet_attestso::SAS::ISASSafeDispatcher;
use starknet_attestso::SAS::ISASSafeDispatcherTrait;
use starknet_attestso::SAS::ISASDispatcher;
use starknet_attestso::SAS::ISASDispatcherTrait;
use starknet_attestso::SAS::{AttestationRequest, AttestationRequestData, Attestation};

fn deploy_contract_schema_registry(name: ByteArray) -> ContractAddress {
    let contract = declare(name).unwrap();
    let (contract_address, _) = contract.deploy(@ArrayTrait::new()).unwrap();
    contract_address
}

fn deploy_contract_sas(name: ByteArray, schema_registry: ContractAddress) -> ContractAddress {
    let contract = declare(name).unwrap();
    let mut constructor_calldata: Array<felt252> = ArrayTrait::new();
    constructor_calldata.append(schema_registry.into());
    let (contract_address, _) = contract.deploy(@constructor_calldata).unwrap();
    contract_address
}

#[test]
fn test_schema_registry() {
    let contract_address = deploy_contract_schema_registry("SchemaRegistry");

    let dispatcher = ISchemaRegistryDispatcher { contract_address };

    let (_schemaRecord, _schema) = dispatcher.get_schema(0_u256);
    assert(_schemaRecord.uid == 0_u256, 'Invalid schema UID');
    assert(_schemaRecord.resolver == contract_address_const::<0>(), 'Invalid resolver');
    assert(_schemaRecord.revocable == false, 'Invalid revocable');
}

#[test]
#[feature("safe_dispatcher")]
fn test_cannot_register_same_schema_again() {
    let contract_address = deploy_contract_schema_registry("SchemaRegistry");

    let safe_dispatcher = ISchemaRegistrySafeDispatcher { contract_address };

    let schema: ByteArray = "felt252 name, u256 age, felt252 address";
    let resolver: ContractAddress = contract_address_const::<1>();
    let revocable: bool = true;

    let _uid: u256 = safe_dispatcher.register(schema, resolver, revocable).unwrap();

    let (_schemaRecord, _schema) = safe_dispatcher.get_schema(_uid).unwrap();
    assert(_schemaRecord.uid == _uid, 'Invalid uid');
    assert(_schemaRecord.resolver == resolver, 'Invalid resolver');
    assert(_schemaRecord.revocable == revocable, 'Invalid revocable');

    let _schema: ByteArray = "felt252 name, u256 age, felt252 address";
    let _resolver: ContractAddress = contract_address_const::<1>();
    let _revocable: bool = true;

    match safe_dispatcher.register(_schema, _resolver, _revocable) {
        Result::Ok(_) => core::panic_with_felt252('Should have panicked'),
        Result::Err(panic_data) => {
            assert(*panic_data.at(0) == 'AlreadyExists', *panic_data.at(0));
        }
    };
}

#[test]
fn test_sas() {
    let contract_address_schema_registry = deploy_contract_schema_registry("SchemaRegistry");

    let dispatcher_schema_registry = ISchemaRegistryDispatcher {
        contract_address: contract_address_schema_registry
    };
    let contract_address_sas = deploy_contract_sas("SAS", contract_address_schema_registry);

    let dispatcher_sas = ISASDispatcher { contract_address: contract_address_sas };

    let (_schemaRecord, _schema) = dispatcher_schema_registry.get_schema(0_u256);
    assert(_schemaRecord.uid == 0_u256, 'Invalid schema UID');
    assert(_schemaRecord.resolver == contract_address_const::<0>(), 'Invalid resolver');
    assert(_schemaRecord.revocable == false, 'Invalid revocable');

    let schema: ByteArray = "felt252 name, u256 age, felt252 address";
    let resolver: ContractAddress = contract_address_const::<1>();
    let revocable: bool = true;

    let _uid: u256 = dispatcher_schema_registry.register(schema, resolver, revocable);

    let (_schemaRecord, _schema) = dispatcher_schema_registry.get_schema(_uid);
    assert(_schemaRecord.uid == _uid, 'Invalid uid');
    assert(_schemaRecord.resolver == resolver, 'Invalid resolver');
    assert(_schemaRecord.revocable == revocable, 'Invalid revocable');

    let _attestationRequestData: AttestationRequestData = AttestationRequestData {
        recipient: contract_address_const::<2>(),
        expirationTime: 1719207030,
        revocable: true,
        refUID: 0,
        data: "123",
        value: 0
    };
    let _attestationRequest: AttestationRequest = AttestationRequest {
        schema: _uid, data: _attestationRequestData
    };
    let attestUID: u256 = dispatcher_sas.attest(_attestationRequest);
    println!("attestUID 1: {}", attestUID);

    let noOfAttestation: u256 = dispatcher_sas.getNoOfAttestation(_uid);
    println!("noOfAttestation: {}", noOfAttestation);

    start_cheat_caller_address(contract_address_sas, contract_address_const::<3>());

    let _attestationRequestData: AttestationRequestData = AttestationRequestData {
        recipient: contract_address_const::<4>(),
        expirationTime: 1719207030,
        revocable: true,
        refUID: 0,
        data: "123",
        value: 0
    };
    let _attestationRequest: AttestationRequest = AttestationRequest {
        schema: _uid, data: _attestationRequestData
    };
    let attestUID2: u256 = dispatcher_sas.attest(_attestationRequest);
    println!("attestUID 2: {}", attestUID2);

    stop_cheat_caller_address(contract_address_sas);

    let noOfAttestation: u256 = dispatcher_sas.getNoOfAttestation(_uid);
    println!("noOfAttestation: {}", noOfAttestation);
    let _attestation: Attestation = dispatcher_sas.getAttestation(attestUID);
    println!("attestUID 1: {}", _attestation.uid);

    let _attestation: Attestation = dispatcher_sas.getAttestation(attestUID2);
    println!("attestUID 2: {}", _attestation.uid);

    let _allAttestation: Array<Attestation> = dispatcher_sas.getAllAttestations();
    println!("attestUID 1: {}", *_allAttestation.at(0).uid);
    println!("attestUID 2: {}", *_allAttestation.at(1).uid);

}
