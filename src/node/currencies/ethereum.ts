import keccak256 from "keccak256";
import { publicKeyCreate } from "secp256k1";
import { ethers, Wallet } from "ethers";
import BigNumber from "bignumber.js";
import { signers } from "arbundles";
import { Signer } from "arbundles/src/signing";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Tx } from "../../common/types";
import { CurrencyConfig } from "../types";
import BaseCurrency from "../../common/currency";


const EthereumSigner = signers.EthereumSigner;

export default class EthereumConfig extends BaseCurrency {
    protected providerInstance: JsonRpcProvider;

    constructor(config: CurrencyConfig) {
        super(config);
        this.base = ["wei", 1e18];

    }
    public async ready(): Promise<void> {
        this.providerInstance = new ethers.providers.JsonRpcProvider(this.provider);
        await this.providerInstance._ready()
        await super.ready();
    }

    // private async getProvider(): Promise<JsonRpcProvider> {
    //     if (!this.providerInstance) {
    //         this.providerInstance = new ethers.providers.JsonRpcProvider(this.provider);
    //         await this.providerInstance._ready()
    //     }
    //     return this.providerInstance;
    // }

    async getTx(txId: string): Promise<Tx> {
        const provider = this.providerInstance

        const response = await provider.getTransaction(txId);

        if (!response) throw new Error("Tx doesn't exist");

        return {
            from: response.from,
            to: response.to,
            blockHeight: response.blockNumber ? new BigNumber(response.blockNumber) : null,
            amount: new BigNumber(response.value.toHexString(), 16),
            pending: response.blockNumber ? false : true,
            confirmed: response.confirmations >= this.minConfirm,
        };
    }

    ownerToAddress(owner: any): string {
        return "0x" + keccak256(owner.slice(1)).slice(-20).toString("hex");
    }

    async sign(data: Uint8Array): Promise<Uint8Array> {
        const signer = new EthereumSigner(this.wallet);
        return signer.sign(data);
    }

    getSigner(): Signer {
        return new EthereumSigner(this.wallet);
    }

    verify(pub: any, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
        return EthereumSigner.verify(pub, data, signature);
    }

    async getCurrentHeight(): Promise<BigNumber> {
        const provider = this.providerInstance
        const response = await provider.send("eth_blockNumber", []);
        return new BigNumber(response, 16);
    }

    async getFee(amount: number | BigNumber, to?: string): Promise<BigNumber> {
        const provider = this.providerInstance
        const tx = {
            to,
            value: "0x" + amount.toString(16),
        };

        const estimatedGas = await provider.estimateGas(tx);
        const gasPrice = await provider.getGasPrice();

        return new BigNumber(estimatedGas.mul(gasPrice).toString());
    }

    async sendTx(data: any): Promise<void> {
        try {
            const provider = this.providerInstance
            await provider.sendTransaction(data);
        } catch (e) {
            console.error(`Error occurred while sending a MATIC tx - ${e}`);
            throw e;
        }
    }

    async createTx(amount: number | BigNumber, to: string, _fee?: string): Promise<{ txId: string; tx: any; }> {
        const provider = this.providerInstance

        const wallet = new Wallet(this.wallet, provider);
        let bigNumberAmount: BigNumber;
        if (BigNumber.isBigNumber(amount)) {
            bigNumberAmount = amount;
        } else {
            bigNumberAmount = new BigNumber(amount);
        }
        const _amount = "0x" + bigNumberAmount.toString(16);

        const estimatedGas = await provider.estimateGas({ to, value: _amount });
        const gasPrice = await provider.getGasPrice();

        const tx = await wallet.populateTransaction({
            to,
            value: _amount,
            gasPrice,
            gasLimit: estimatedGas,
        });

        const signedTx = await wallet.signTransaction(tx);
        const txId = "0x" + keccak256(Buffer.from(signedTx.slice(2), "hex")).toString("hex");
        return { txId, tx: signedTx };

    }

    async getPublicKey(): Promise<string | Buffer> {
        return Buffer.from(publicKeyCreate(Buffer.from(this.wallet, "hex"), false));
    }

}