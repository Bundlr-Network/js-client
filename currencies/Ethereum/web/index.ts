import keccak256 from "./keccak256";
import { ethers } from "ethers";
import BigNumber from "bignumber.js";
import InjectedEthereumSigner from "./injectedEthereumSigner"
import { Signer } from "@bundlr-network/client/build/esm/common/signing/index";
import { Tx, CurrencyConfig } from "@bundlr-network/client/build/esm/common/types";
import BaseWebCurrency from "@bundlr-network/client/build/esm/web/currency";
import WebBundlr from "@bundlr-network/client/build/esm/web/index";

const ethBigNumber = ethers.BigNumber // required for hexString conversions (w/ 0x padding)

export default class EthereumConfig extends BaseWebCurrency {
    protected signer!: InjectedEthereumSigner;
    declare protected wallet: ethers.providers.Web3Provider;
    protected w3signer!: ethers.providers.JsonRpcSigner;

    constructor(config: CurrencyConfig) {
        super(config)
        this.base = ["wei", 1e18];
    }


    async getTx(txId: string): Promise<Tx> {
        const provider = this.providerInstance
        const response = await provider.getTransaction(txId);

        if (!response) throw new Error("Tx doesn't exist");

        return {
            from: response.from,
            to: response.to,
            blockHeight: response.blockNumber ? new BigNumber(response.blockNumber) : undefined,
            amount: new BigNumber(response.value.toHexString(), 16),
            pending: response.blockNumber ? false : true,
            confirmed: response.confirmations >= this.minConfirm,
        };
    }

    ownerToAddress(owner: any): string {
        return "0x" + keccak256(Buffer.from(owner.slice(1))).slice(-20).toString("hex");
    }

    async sign(data: Uint8Array): Promise<Uint8Array> {
        const signer = await this.getSigner();
        return signer.sign(data);
    }

    getSigner(): Signer {
        if (!this.signer) {
            this.signer = new InjectedEthereumSigner(this.wallet);
        }
        return this.signer
    }


    async verify(pub: any, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
        return InjectedEthereumSigner.verify(pub, data, signature);
    }

    async getCurrentHeight(): Promise<BigNumber> {
        const provider = this.providerInstance
        const response = await provider.send("eth_blockNumber", []);

        return new BigNumber(response, 16);
    }

    async getFee(amount: BigNumber.Value, to?: string): Promise<BigNumber> {
        const provider = this.providerInstance
        await provider._ready();

        const tx = {
            to,
            value: "0x" + (new BigNumber(amount)).toString(16),
        };

        const estimatedGas = await provider.estimateGas(tx);
        const gasPrice = await provider.getGasPrice();
        return new BigNumber(estimatedGas.mul(gasPrice).toString());
    }

    async sendTx(data: ethers.providers.TransactionRequest): Promise<any> {
        const signer = this.w3signer
        const receipt = await signer.sendTransaction(data)// .catch((e) => { console.error(`Sending tx: ${e}`) })
        return receipt ? receipt.hash : undefined
    }

    async createTx(amount: BigNumber.Value, to: string, _fee?: string): Promise<{ txId: string; tx: any; }> {
        const amountc = ethBigNumber.from((new BigNumber(amount)).toString())
        const signer = this.w3signer
        const estimatedGas = await signer.estimateGas({ to, value: amountc.toHexString() })
        const gasPrice = await signer.getGasPrice();
        const txr = await signer.populateTransaction({ to, value: amountc.toHexString(), gasPrice, gasLimit: estimatedGas })
        return { txId: "", tx: txr };
    }

    public async getPublicKey(): Promise<string | Buffer> {
        const signer = await this.getSigner() as InjectedEthereumSigner
        await signer.setPublicKey();
        return signer.publicKey;
    }

    pruneBalanceTransactions(_txIds: string[]): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async ready(): Promise<void> {
        this.w3signer ??= await this.wallet.getSigner();
        this._address ??= this.ownerToAddress(await this.getPublicKey());
        this.providerInstance ??= new ethers.providers.JsonRpcProvider(this.providerUrl);

    }


}


export class EthereumBundlr extends WebBundlr {
    public static readonly currency = "ethereum"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "ethereum", ticker: "ETH", providerUrl: config?.providerUrl ?? "https://main-light.eth.linkpool.io/", wallet })
        super(url, currencyConfig, config)
    }
}
export class MaticBundlr extends WebBundlr {
    public static readonly currency = "matic"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "matic", ticker: "MATIC", providerUrl: config?.providerUrl ?? "https://polygon-rpc.com", wallet })
        super(url, currencyConfig, config)
    }
}

export class BnbBundlr extends WebBundlr {
    public static readonly currency = "bnb"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "bnb", ticker: "BNB", providerUrl: config?.providerUrl ?? "https://bsc-dataseed.binance.org", wallet })
        super(url, currencyConfig, config)
    }
}

export class FantomBundlr extends WebBundlr {
    public static readonly currency = "fantom"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "fantom", ticker: "FTM", providerUrl: config?.providerUrl ?? "https://rpc.ftm.tools/", wallet })
        super(url, currencyConfig, config)
    }
}
export class AvalancheBundlr extends WebBundlr {
    public static readonly currency = "avalanche"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "avalanche", ticker: "AVAX", providerUrl: config?.providerUrl ?? "https://api.avax.network/ext/bc/C/rpc", wallet })
        super(url, currencyConfig, config)
    }
}
export class BobaEthBundlr extends WebBundlr {
    public static readonly currency = "boba-eth"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "boba-eth", ticker: "ETH", providerUrl: config?.providerUrl ?? "https://mainnet.boba.network/", wallet })
        super(url, currencyConfig, config)
    }
}

export class ArbitrumBundlr extends WebBundlr {
    public static readonly currency = "arbitrum"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "arbitrum", ticker: "ETH", providerUrl: config?.providerUrl ?? "https://arb1.arbitrum.io/rpc", wallet })
        super(url, currencyConfig, config)
    }
}