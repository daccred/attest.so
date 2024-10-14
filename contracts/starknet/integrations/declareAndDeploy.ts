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

    // Declare Test contract in specified network (Sepolia)
    const testSierra = json.parse(fs.readFileSync("./target/dev/starknet_attestso_SAS.contract_class.json").toString("ascii"));
    const testCasm = json.parse(fs.readFileSync("./target/dev/starknet_attestso_SAS.compiled_contract_class.json").toString("ascii"));
    const { suggestedMaxFee: fee1 } = await account.estimateDeclareFee({ contract: testSierra, casm: testCasm });
    console.log("suggestedMaxFee =", fee1.toString(), "wei");
    const declareResponse = await account.declare({ contract: testSierra, casm: testCasm }, { maxFee: fee1 * 11n / 10n });

    console.log('Contract Class Hash =', declareResponse.class_hash);
    await provider.waitForTransaction(declareResponse.transaction_hash);
    console.log('✅ Contract Class Hash completed.');

    // Deploy Test contract in specified network (Sepolia)
    // ClassHash of the already declared contract
    const testClassHash = declareResponse.class_hash;

    const deployResponse = await account.deployContract({ classHash: testClassHash });
    await provider.waitForTransaction(deployResponse.transaction_hash);

    // read abi of Test contract
    const { abi: testAbi } = await provider.getClassByHash(testClassHash);
    if (testAbi === undefined) {
        throw new Error('no abi.');
    }


    // Connect the new contract instance:
    const myTestContract = new Contract(testAbi, deployResponse.contract_address, provider);
    console.log('✅ Test Contract connected at =', myTestContract.address);
    console.log(myTestContract);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });