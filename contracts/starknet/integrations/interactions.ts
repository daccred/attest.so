// Declare a contract.
// launch with npx ts-node src/scripts/9.declareContract.ts
// Coded with Starknet.js v5.16.0, Starknet-devnet-rs v0.1.0

import { Account, json, RpcProvider, Contract, ec, number } from "starknet";
import fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();


async function main() {
    // const provider = new RpcProvider({ nodeUrl: "http://127.0.0.1:5050/rpc" }); // only for starknet-devnet-rs
    // const provider = new RpcProvider({ nodeUrl: `https://starknet-sepolia.infura.io/v3/${process.env.STARKNET_API_KEY}` }); // only for starknet-devnet-rs
    const provider = new RpcProvider({ nodeUrl: `https://starknet-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_STARKNET_API_KEY}` });

    console.log("Provider connected");

    // initialize existing predeployed account 0 of Devnet
    const privateKey = process.env.PRIVATE_KEY ?? "";
    const accountAddress: string = process.env.ACCOUNT_ADDRESS ?? "";
    const account = new Account(provider, accountAddress, privateKey, '1');
    console.log("Account connected\n");


    // Connect the deployed Test contract in Testnet
    const SchemaRegistryAddress = '0x79bf4b90f4447d4abc7a1b6d6f6482090ed3811b63bedb3efad3fe911cb9f5c';
    const SASAddress = '0x12b9a64d418c069178961307941089504e7cb399807fd05d0a96bf624a28d81';

    // read abi of Test contract
    const { abi: testAbi } = await provider.getClassAt(SchemaRegistryAddress);
    if (testAbi === undefined) {
        throw new Error('no abi.');
    }
    const SchemaRegistryAddressContract = new Contract(testAbi, SchemaRegistryAddress, provider);

    const { abi: testAbi2 } = await provider.getClassAt(SASAddress);
    if (testAbi2 === undefined) {
        throw new Error('no abi.');
    }
    const SASAddressContract = new Contract(testAbi2, SASAddress, provider);

    // Connect account with the contract
    SchemaRegistryAddressContract.connect(account);

    // Interactions with the contract with meta-class
    const schema = await SchemaRegistryAddressContract.get_schema("47841256495611306172632419073618970397106759766749817516740915818487381023792"); // decimal
    console.log('uid: ', schema[0].uid.toString());
    console.log('resolver: ', schema[0].resolver.toString());
    console.log('revocable: ', schema[0].revocable.toString());
    console.log('schema: ', schema[1]);

    SASAddressContract.connect(account);
    const getSchemaRegistry = await SASAddressContract.getSchemaRegistry();
    console.log('getSchemaRegistry =', getSchemaRegistry.toString());

    // Define the AttestationRequestData
    const attestationRequestData = {
        recipient: "0x0124f678b5b285a9c88b7283dcd19bf9e2a5f7d89afe0a7cd7ed5da3f3257212", // Replace with the recipient address
        expirationTime: 1719207030, // Replace with the expiration time (Unix timestamp)
        revocable: true,
        refUID: "0", // Replace with the UID of the related attestation
        data: "felt252 name rajeeb, felt252 address bangalore", // Replace with custom attestation data
        value: "0" // Replace with the explicit ETH amount to send to the resolver
    };

    // Define the AttestationRequest
    const attestationRequest = {
        schema: "47841256495611306172632419073618970397106759766749817516740915818487381023792", // Replace with the unique identifier of the schema
        data: attestationRequestData
    };

    // Convert the attestation request data to the format expected by the contract
    const attestationRequestFormatted = {
        schema: attestationRequest.schema.toString(),
        data: {
            recipient: attestationRequest.data.recipient,
            expirationTime: attestationRequest.data.expirationTime,
            revocable: attestationRequest.data.revocable ? 1 : 0, // Convert boolean to integer
            refUID: attestationRequest.data.refUID.toString(),
            data: attestationRequest.data.data,
            value: attestationRequest.data.value.toString()
        }
    };


 
    const res = await SASAddressContract.attest(attestationRequestFormatted);
    await provider.waitForTransaction(res.transaction_hash);
    console.log("Transaction Completed", res.transaction_hash);


}

   // // increase_balance needs 2 felts, to add them to the balance.
    // const myCall = SASAddressContract.populate('attest', attestationRequestFormatted);
    // const res = await SASAddressContract.attest(myCall.calldata);
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

