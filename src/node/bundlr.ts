import { AxiosResponse } from "axios";
// import BigNumber from "bignumber.js";
import { BundlrConfig } from "../common/types";
import Api from "../common/api";
import Bundlr from "../common/bundlr";
import Fund from "../common/fund";
import Utils, { importAndGetBundlrFlavour } from "../common/utils";

import { NodeCurrency } from "./types";
import NodeUploader from "./upload";


export default class NodeBundlr extends Bundlr {
    public uploader: NodeUploader; // re-define type
    public currencyConfig: NodeCurrency;
    /**
     * Constructs a new Bundlr instance, as well as supporting subclasses
     * @param url - URL to the bundler
     * @param wallet - private key (in whatever form required)
     */
    constructor(url: string, currencyConfig: NodeCurrency, config?: BundlrConfig) {
        super();
        const parsed = new URL(url);
        this.api = new Api({ protocol: parsed.protocol.slice(0, -1), port: parsed.port, host: parsed.hostname, timeout: config?.timeout ?? 100000 });
        if (config?.minConfirm) {
            currencyConfig.minConfirm = config?.minConfirm
        }
        this.currencyConfig = currencyConfig // getCurrency(this.currency, wallet, config?.providerUrl, config?.contractAddress) 
        this.currency = this.currencyConfig.name
        this.address = this.currencyConfig.address;
        this.utils = new Utils(this.api, this.currency, this.currencyConfig);
        this.funder = new Fund(this.utils);
        this.uploader = new NodeUploader(this.api, this.utils, this.currency, this.currencyConfig)
    }

    /**
     * Upload a file at the specified path to the bundler
     * @param path path to the file to upload
     * @returns bundler response
     */
    async uploadFile(path: string): Promise<AxiosResponse<any>> {
        return this.uploader.uploadFile(path);
    };

    /**
     * Optional ready method for currencies that require asynchronous initialisation.
     */
    async ready(): Promise<void> {
        if (this.currencyConfig.ready) {
            await this.currencyConfig.ready();
            this.address = this.currencyConfig.address
        }
    }

    static async init(url: string, currency: string, wallet: any, config?: BundlrConfig): Promise<NodeBundlr> {
        const bundlr = await importAndGetBundlrFlavour(currency)
        const newBundlr = new bundlr(url, wallet, config) as NodeBundlr
        await newBundlr.ready()
        return newBundlr
    }

}

/**
 * For more dynamic usecases
 * WARNING: this cripples tree shaking, use at your own risk!
 * @param currency
 * @param wallet
 * @param providerUrl
 * @param contractAddress
 * @returns
 */
// export function getCurrency(currency: string, wallet: any, providerUrl?: string, contractAddress?: string): NodeCurrency {
//     switch (currency) {
//         case "arweave":
//             return new ArweaveConfig({ name: "arweave", ticker: "AR", minConfirm: 10, providerUrl: providerUrl ?? "arweave.net", wallet, isSlow: true })
//         case "ethereum":
//             return new EthereumConfig({ name: "ethereum", ticker: "ETH", providerUrl: providerUrl ?? "https://main-light.eth.linkpool.io/", wallet })
//         case "matic":
//             return new EthereumConfig({ name: "matic", ticker: "MATIC", minConfirm: 8, providerUrl: providerUrl ?? "https://morning-hidden-forest.matic.quiknode.pro/2864d4b10b348d1e7799cea5cbab433418741098/", wallet })
//         case "bnb":
//             return new EthereumConfig({ name: "bnb", ticker: "BNB", providerUrl: providerUrl ?? "https://bsc-dataseed.binance.org/", wallet })
//         case "fantom":
//             return new EthereumConfig({ name: "fantom", ticker: "FTM", providerUrl: providerUrl ?? "https://rpc.ftm.tools/", wallet })
//         case "solana":
//             return new SolanaConfig({ name: "solana", ticker: "SOL", providerUrl: providerUrl ?? "https://api.mainnet-beta.solana.com/", wallet })
//         case "avalanche":
//             return new EthereumConfig({ name: "avalanche", ticker: "AVAX", providerUrl: providerUrl ?? "https://api.avax-test.network/ext/bc/C/rpc/", wallet })
//         case "boba":
//             return new EthereumConfig({ name: "boba", ticker: "ETH", providerUrl: providerUrl ?? "https://mainnet.boba.network/", wallet })
//         case "arbitrum":
//             return new EthereumConfig({ name: "arbitrum", ticker: "ETH", providerUrl: providerUrl ?? "https://arb1.arbitrum.io/rpc/", wallet })
//         case "chainlink":
//             return new ERC20Config({ name: "chainlink", ticker: "LINK", providerUrl: providerUrl ?? "https://main-light.eth.linkpool.io/", contractAddress: contractAddress ?? "0x514910771AF9Ca656af840dff83E8264EcF986CA", wallet })
//         case "kyve": {
//             const k = new ERC20Config({ name: "kyve", ticker: "KYVE", minConfirm: 0, providerUrl: providerUrl ?? "https://moonbeam-alpha.api.onfinality.io/public", contractAddress: contractAddress ?? "0x3cf97096ccdb7c3a1d741973e351cb97a2ede2c1", isSlow: true, wallet })
//             k.price = async (): Promise<number> => { return 100 } // TODO: replace for mainnet
//             k.getGas = async (): Promise<[BigNumber, number]> => { return [new BigNumber(100), 1e18] }
//             return k; // TODO: ensure units above are right
//         }
//         case "near": {
//             return new NearConfig({ name: "near", ticker: "NEAR", providerUrl: providerUrl ?? "https://rpc.mainnet.near.org", wallet })
//         }
//         case "algorand": {
//             return new AlgorandConfig({ name: "algorand", ticker: "ALGO", providerUrl: providerUrl ?? "https://algoexplorerapi.io", wallet })
//         }
//         default:
//             throw new Error(`Unknown/Unsupported currency ${currency}`);
//     }
// }


