import { Account, json, RpcProvider } from "starknet";
import fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

async function main(contract_name: string) {
    // const provider = new RpcProvider({ nodeUrl: `https://starknet-sepolia.infura.io/v3/${process.env.STARKNET_API_KEY}` });
    const provider = new RpcProvider({ nodeUrl: `https://starknet-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_STARKNET_API_KEY}` });
    console.log("Provider connected");

    const privateKey = process.env.PRIVATE_KEY ?? "";
    const accountAddress: string = process.env.ACCOUNT_ADDRESS ?? "";
    const account = new Account(provider, accountAddress, privateKey, '1');
    console.log("Account connected\n");

    const testSierra = json.parse(fs.readFileSync(`./target/dev/starknet_attestso_${contract_name}.contract_class.json`).toString("ascii"));
    const testCasm = json.parse(fs.readFileSync(`./target//dev/starknet_attestso_${contract_name}.compiled_contract_class.json`).toString("ascii"));

    const { suggestedMaxFee: fee1 } = await account.estimateDeclareFee({ contract: testSierra, casm: testCasm });
    console.log("suggestedMaxFee =", fee1.toString(), "wei");
    const declareResponse = await account.declare({ contract: testSierra, casm: testCasm }, { maxFee: fee1 * 11n / 10n });
    console.log('Declare Response:', declareResponse);

    console.log('Contract Class Hash =', declareResponse.class_hash);
    await provider.waitForTransaction(declareResponse.transaction_hash);
    console.log('✅ Contract Class Hash completed.');
}

// const contract_name = "SchemaRegistry";
const contract_name = "SAS";
main(contract_name)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
