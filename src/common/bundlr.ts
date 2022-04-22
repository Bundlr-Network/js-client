import Utils from "./utils";
import { withdrawBalance } from "./withdrawal";
import Uploader from "./upload";
import Fund from "./fund";
import { AxiosResponse } from "axios";
import { DataItemCreateOptions } from "arbundles";
import BundlrTransaction from "./transaction";
import Api from "./api";
import BigNumber from "bignumber.js";
import { Currency, FundData } from "./types";
import { Signer } from "./signing";

export default abstract class Bundlr {
    public api!: Api;
    public utils!: Utils;
    public uploader!: Uploader;
    public funder!: Fund;
    public address!: string;
    public currency!: string;
    public currencyConfig!: Currency;

    constructor() { return }


    async withdrawBalance(amount: BigNumber.Value): Promise<AxiosResponse<any>> {
        return await withdrawBalance(this.utils, this.api, amount);
    }

    /**
     * Gets the balance for the loaded wallet
     * @returns balance (in winston)
     */
    async getLoadedBalance(): Promise<BigNumber> {
        return this.utils.getBalance(this.address)
    }
    /**
     * Gets the balance for the specified address
     * @param address address to query for
     * @returns the balance (in winston)
     */
    async getBalance(address: string): Promise<BigNumber> {
        return this.utils.getBalance(address)
    }

    /**
     * Sends amount atomic units to the specified bundler
     * @param amount amount to send in atomic units
     * @returns details about the fund transaction
     */
    async fund(amount: BigNumber.Value, multiplier?: number): Promise<FundData> {
        return this.funder.fund(amount, multiplier)
    }

    /**
     * Calculates the price for [bytes] bytes for the loaded currency and Bundlr node.
     * @param bytes 
     * @returns 
     */
    public async getPrice(bytes: number): Promise<BigNumber> {
        return this.utils.getPrice(this.currency, bytes)
    }

    /**
     * Create a new BundlrTransactions (flex currency arbundles dataItem)
     * @param data 
     * @param opts - dataItemCreateOptions
     * @returns - a new BundlrTransaction instance
     */
    createTransaction(data: string | Uint8Array, opts?: DataItemCreateOptions): BundlrTransaction {
        return new BundlrTransaction(data, this, opts);
    }

    /**
     * Returns the signer for the loaded currency
     */
    getSigner(): Signer {
        return this.currencyConfig.getSigner()
    }
}