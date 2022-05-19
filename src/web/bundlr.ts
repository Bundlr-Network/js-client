// import { BundlrConfig } from "common/types";
import { BundlrConfig } from "../common/types";
import Api from "../common/api";
import Bundlr from "../common/bundlr";
import Fund from "../common/fund";
import Uploader from "../common/upload";
import Utils, { importAndGetBundlrFlavour } from "../common/utils";
// import EthereumConfig from "./currencies/ethereum";
// import NearConfig from "./currencies/near";
// import SolanaConfig from "./currencies/solana";
// import CosmosConfig from "./currencies/cosmos";
import { WebCurrency } from "./types";

export default class WebBundlr extends Bundlr {
    public currencyConfig: WebCurrency;
    constructor(url: string, currencyConfig: WebCurrency, config?: BundlrConfig) {
        super();
        const parsed = new URL(url);
        this.api = new Api({ protocol: parsed.protocol.slice(0, -1), port: parsed.port, host: parsed.hostname, timeout: config?.timeout ?? 100000 });
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        if (config?.minConfirm) {
            currencyConfig.minConfirm = config?.minConfirm
        }
        this.currencyConfig = currencyConfig
        this.currency = this.currencyConfig.name
        this.utils = new Utils(this.api, this.currency, this.currencyConfig);
        this.uploader = new Uploader(this.api, this.utils, this.currency, this.currencyConfig);
        this.funder = new Fund(this.utils)
    }

    // async initialisation 
    public async ready(): Promise<void> {
        if (this.currencyConfig.ready) {
            await this.currencyConfig.ready()
        }
        this.address = this.currencyConfig.address
    }

    static async init(url: string, currency: string, wallet: any, config?: BundlrConfig): Promise<WebBundlr> {
        const bundlr = await importAndGetBundlrFlavour(currency)
        const newBundlr = new bundlr(url, wallet, config) as WebBundlr
        await newBundlr.ready()
        return newBundlr
    }
}
