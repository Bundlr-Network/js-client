import keccak256 from "./keccak256";
import { publicKeyCreate } from "secp256k1";
import { ethers, Wallet, providers } from "ethers";
import BigNumber from "bignumber.js";
import { Signer } from "@bundlr-network/client/build/cjs/common/signing/index"
// import { JsonRpcProvider } from "ethers";
import { CurrencyConfig, Tx } from "@bundlr-network/client/build/cjs/common/types";
import BaseNodeCurrency from "@bundlr-network/client/build/cjs/node/currency";
import NodeBundlr from "@bundlr-network/client/build/cjs/node/index";
import EthereumSigner from "./EthereumSigner"

export default class EthereumConfig extends BaseNodeCurrency {
    declare protected providerInstance: providers.JsonRpcProvider;

    constructor(config: CurrencyConfig) {
        super(config);
        this.base = ["wei", 1e18];

    }

    protected async getProvider(): Promise<providers.JsonRpcProvider> {
        if (!this.providerInstance) {
            this.providerInstance = new ethers.providers.JsonRpcProvider(this.providerUrl);
            await this.providerInstance.ready
        }
        return this.providerInstance;
    }

    async getTx(txId: string): Promise<Tx> {
        const provider = await this.getProvider()

        const response = await provider.getTransaction(txId);

        if (!response) throw new Error("Tx doesn't exist");

        // console.log(response.confirmations);

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
        const response = await (await this.getProvider()).send("eth_blockNumber", []);
        return new BigNumber(response, 16);
    }

    async getFee(amount: BigNumber.Value, to?: string): Promise<BigNumber> {
        const provider = await this.getProvider()
        const _amount = new BigNumber(amount)
        const tx = {
            from: this.address,
            to,
            value: "0x" + _amount.toString(16),
        };

        const estimatedGas = await provider.estimateGas(tx);
        const gasPrice = await provider.getGasPrice();

        // const b = await provider.send("eth_maxPriorityFeePerGas", [])
        // console.log(b)
        return new BigNumber(estimatedGas.mul(gasPrice).toString());
    }


    async sendTx(data: any): Promise<any> {
        return (await (await this.getProvider()).sendTransaction(data).catch(e => { console.error(`Error occurred while sending a tx - ${e}`); throw e }));
    }

    async createTx(amount: BigNumber.Value, to: string, _fee?: string): Promise<{ txId: string; tx: any; }> {
        const provider = await this.getProvider()
        const wallet = new Wallet(this.wallet, provider);

        const _amount = "0x" + new BigNumber(amount).toString(16);

        let gasPrice = await provider.getGasPrice();
        // const estimatedGas = await provider.estimateGas({ from: this.address, to, value: _amount });

        // console.log({ gasPrice, estimatedGas })

        // if (fee) {
        //     gasPrice = ethers.BigNumber.from(Math.ceil(+fee / estimatedGas.toNumber()))
        // }

        if (this.name === "matic") {
            gasPrice = ethers.BigNumber.from(new BigNumber(gasPrice.toString()).multipliedBy(7).decimalPlaces(0).toString())
        }

        const tx = await wallet.populateTransaction({
            to,
            value: _amount,
            from: this.address,
            gasPrice
            // gasLimit: estimatedGas,
            // nonce: b // await provider.getTransactionCount(this.address),
            // chainId: await (await provider.getNetwork()).chainId
        });
        // tx.gasLimit = ethers.BigNumber.from(+(tx.gasLimit.toString()) * 4)
        const signedTx = await wallet.signTransaction(tx);
        const txId = "0x" + keccak256(Buffer.from(signedTx.slice(2), "hex")).toString("hex");
        // const c = await provider.call(tx);
        // console.log(c)
        return { txId, tx: signedTx };
    }

    getPublicKey(): string | Buffer {
        return Buffer.from(publicKeyCreate(Buffer.from(this.wallet, "hex"), false));
    }

}


export class EthereumBundlr extends NodeBundlr {
    public static readonly currency = "ethereum"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "ethereum", ticker: "ETH", providerUrl: config?.providerUrl ?? "https://main-light.eth.linkpool.io/", wallet })
        super(url, currencyConfig, config)
    }
}

export class MaticBundlr extends NodeBundlr {
    public static readonly currency = "matic"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "matic", ticker: "MATIC", minConfirm: 8, providerUrl: config?.providerUrl ?? "https://morning-hidden-forest.matic.quiknode.pro/2864d4b10b348d1e7799cea5cbab433418741098/", wallet })
        super(url, currencyConfig, config)
    }
}

export class BnbBundlr extends NodeBundlr {
    public static readonly currency = "bnb"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "bnb", ticker: "BNB", providerUrl: config?.providerUrl ?? "https://bsc-dataseed.binance.org/", wallet })
        super(url, currencyConfig, config)
    }
}

export class FantomBundlr extends NodeBundlr {
    public static readonly currency = "fantom"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "fantom", ticker: "FTM", providerUrl: config?.providerUrl ?? "https://rpc.ftm.tools/", wallet })
        super(url, currencyConfig, config)
    }
}

export class AvalancheBundlr extends NodeBundlr {
    public static readonly currency = "avalanche"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "avalanche", ticker: "AVAX", providerUrl: config?.providerUrl ?? "https://api.avax-test.network/ext/bc/C/rpc/", wallet })
        super(url, currencyConfig, config)
    }
}

export class BobaEthBundlr extends NodeBundlr {
    public static readonly currency = "boba-eth"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "boba-eth", ticker: "ETH", providerUrl: config?.providerUrl ?? "https://mainnet.boba.network/", wallet })
        super(url, currencyConfig, config)
    }
}

export class ArbitrumBundlr extends NodeBundlr {
    public static readonly currency = "arbitrum"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new EthereumConfig({ name: "arbitrum", ticker: "ETH", providerUrl: config?.providerUrl ?? "https://arb1.arbitrum.io/rpc/", wallet })
        super(url, currencyConfig, config)
    }
}