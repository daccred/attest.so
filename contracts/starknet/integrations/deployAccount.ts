// https://www.starknetjs.com/docs/guides/create_account
import { Account, constants, ec, json, stark, Provider, hash, CallData, RpcProvider } from 'starknet';
import * as dotenv from "dotenv";
dotenv.config();

// connect provider
// const provider = new RpcProvider({ nodeUrl: "http://127.0.0.1:5050/rpc" }); // only for starknet-devnet-rs
const provider = new RpcProvider({ nodeUrl: `https://starknet-sepolia.infura.io/v3/${process.env.STARKNET_API_KEY}` }); // only for starknet-devnet-rs
console.log("Provider connected");

// new Open Zeppelin account v0.5.1
// Generate public and private key pair.
const privateKey = stark.randomAddress();
console.log('New OZ account:\nprivateKey=', privateKey);
const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);
console.log('publicKey=', starkKeyPub);

const OZaccountClassHash = '0x2794ce20e5f2ff0d40e632cb53845b9f4e526ebd8471983f7dbd355b721d5a';
// Calculate future address of the account
const OZaccountConstructorCallData = CallData.compile({ publicKey: starkKeyPub });
const OZcontractAddress = hash.calculateContractAddressFromHash(
    starkKeyPub,
    OZaccountClassHash,
    OZaccountConstructorCallData,
    0
);
console.log('Precalculated account address=', OZcontractAddress);

// Deployment after funding to OZcontractAddress
// const OZaccount = new Account(provider, OZcontractAddress, privateKey); // cairo 0
const OZaccount = new Account(provider, OZcontractAddress, privateKey, '1'); // cairo 1

async function deployOZAccount() {
    const { transaction_hash, contract_address } = await OZaccount.deployAccount({
      classHash: OZaccountClassHash,
      constructorCalldata: OZaccountConstructorCallData,
      addressSalt: starkKeyPub,
    });

    await provider.waitForTransaction(transaction_hash);
    console.log(transaction_hash);
    console.log(contract_address);
    return { transaction_hash, contract_address };
}

(async () => {
    try {
        const result = await deployOZAccount();
        console.log('Account deployed:', result);
        console.log('✅ New OpenZeppelin account created.\n   address =', result);

    } catch (error) {
        console.error('Failed to deploy account:', error);
    }
})();

