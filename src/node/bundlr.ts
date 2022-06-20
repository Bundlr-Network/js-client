import { AxiosResponse } from "axios";
import Api from "../common/api";
import Bundlr from "../common/bundlr";
import Fund from "../common/fund";
import Utils from "../common/utils";
import getCurrency from "./currencies";
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
    constructor(url: string, currency: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string, currencyOpts?: any }) {
        super();
        const parsed = new URL(url);
        this.api = new Api({ protocol: parsed.protocol.slice(0, -1), port: parsed.port, host: parsed.hostname, timeout: config?.timeout ?? 100000 });
        this.currency = currency.toLowerCase();
        this.currencyConfig = getCurrency(this.currency, wallet, parsed.toString(), config?.providerUrl, config?.contractAddress, config?.currencyOpts)
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
     * Readies the bundlr's selected currency (if applicable)
     */
    async ready(): Promise<void> {
        await this.currencyConfig.ready?.()
    }

}

