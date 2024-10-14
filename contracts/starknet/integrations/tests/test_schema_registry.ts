// Declare a contract.
// launch with npx ts-node src/scripts/9.declareContract.ts
// Coded with Starknet.js v5.16.0, Starknet-devnet-rs v0.1.0

import { Account, json, RpcProvider, Contract } from "starknet";
import fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();


async function main() {
    // const provider = new RpcProvider({ nodeUrl: "http://127.0.0.1:5050/rpc" }); // only for starknet-devnet-rs
    const provider = new RpcProvider({ nodeUrl: `https://starknet-sepolia.infura.io/v3/${process.env.STARKNET_API_KEY}` }); // only for starknet-devnet-rs
    console.log("Provider connected");

    // initialize existing predeployed account 0 of Devnet
    const privateKey = process.env.PRIVATE_KEY ?? "";
    const accountAddress: string = process.env.ACCOUNT_ADDRESS ?? "";
    const account = new Account(provider, accountAddress, privateKey, '1');
    console.log("Account connected.\n");

    // Deploy Test contract in specified network (Sepolia)
    // ClassHash of the already declared contract
    const classHash = "0x6e73948c38ab1dccfda3713a1410f1778aabe307cd0f77a19f02ca076ded32d"; // Schema Registry

    // read abi of contract
    const { abi: ABI } = await provider.getClassByHash(classHash);
    if (ABI === undefined) {
        throw new Error('no abi.');
    }

    const contract_address = "0x657b03e10f5ef499f4be9654edbc805cf9297ece435dfa0cc8b96112d3b3b55";

    // Connect the new contract instance:
    const myTestContract = new Contract(ABI, contract_address, provider);
    console.log('✅ Test Contract connected at =', myTestContract.address);
    console.log(myTestContract);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });