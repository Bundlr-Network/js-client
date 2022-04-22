// import Api from "arweave/node/lib/api";
import { AxiosResponse } from "axios";
import BigNumber from "bignumber.js";
import { NodeBundlr } from "node";
import { WebBundlr } from "web";
import Api from "./api";
import { Currency } from "./types";
BigNumber.set({ DECIMAL_PLACES: 50 })

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export default class Utils {
    public api: Api;
    public currency: string;
    public currencyConfig: Currency;
    constructor(api: Api, currency: string, currencyConfig: Currency) {
        this.api = api;
        this.currency = currency;
        this.currencyConfig = currencyConfig;
    };

    /**
     * Throws an error if the provided axios reponse has a status code != 200
     * @param res an axios response
     * @returns nothing if the status code is 200
     */
    public static checkAndThrow(res: AxiosResponse<any>, context?: string, exceptions?: number[]): void {
        if (res?.status && !(exceptions ?? []).includes(res.status) && res.status != 200) {
            throw new Error(`HTTP Error: ${context}: ${res.status} ${typeof res.data !== "string" ? res.statusText : res.data}`);
        }
        return;
    }

    /**
     * Gets the nonce used for withdrawal request validation from the bundler
     * @returns nonce for the current user
     */
    public async getNonce(): Promise<number> {
        const res = await this.api.get(`/account/withdrawals/${this.currency}?address=${this.currencyConfig.address}`);
        Utils.checkAndThrow(res, "Getting withdrawal nonce");
        return (res).data;
    }

    /**
     * Gets the balance on the current bundler for the specified user
     * @param address the user's address to query
     * @returns the balance in winston
     */
    public async getBalance(address: string): Promise<BigNumber> {
        const res = await this.api.get(`/account/balance/${this.currency}?address=${address}`);
        Utils.checkAndThrow(res, "Getting balance");
        return new BigNumber(res.data.balance);
    }

    /**
     * Queries the bundler to get it's address for a specific currency
     * @returns the bundler's address
     */
    public async getBundlerAddress(currency: string): Promise<string> {

        const res = await this.api.get("/info")
        Utils.checkAndThrow(res, "Getting Bundler address");
        const address = res.data.addresses[currency]
        if (!address) {
            throw new Error(`Specified bundler does not support currency ${currency}`);
        }
        return address;
    }

    /**
     * Calculates the price for [bytes] bytes paid for with [currency] for the loaded bundlr node.
     * @param currency
     * @param bytes
     * @returns
     */
    public async getPrice(currency: string, bytes: number): Promise<BigNumber> {
        const res = await this.api.get(`/price/${currency}/${bytes}`)
        Utils.checkAndThrow(res, "Getting storage cost");
        return new BigNumber((res).data);
    }

    /**
     * Polls for transaction confirmation (or at least pending status) - used for fast currencies (i.e not arweave)
     * before posting the fund request to the server (so the server doesn't have to poll)
     * @param txid
     * @returns
     */
    public async confirmationPoll(txid: string): Promise<void> {
        if (this.currencyConfig.isSlow) { return; }
        for (let i = 0; i < 15; i++) {
            await sleep(3000);
            if (await this.currencyConfig.getTx(txid).then(v => { return v?.confirmed }).catch(_ => { return false })) {
                return;
            }
        }

        throw new Error(`Tx ${txid} didn't finalize after 30 seconds`);
    }

    public unitConverter(baseUnits: BigNumber.Value): BigNumber {
        return new BigNumber(baseUnits).dividedBy(this.currencyConfig.base[1]);
    }
}

/**
 * Dynamically (!) imports and returns the requested bundlr flavour
 * @param currency - string name of the currency, i.e "matic" or "solana"
 * @returns the constructor for the requested currencys' bundlr flavour
 */
export async function importAndGetBundlrFlavour(currency: string): Promise<{ new(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }): NodeBundlr | WebBundlr }> {

    globalThis as any;
    // @ts-ignore
    if (!globalThis?.Bundlr?.currencyArrayMap) {
        throw new Error("required global 'Bundlr.currencyArrayMap' is not initialised")
    }
    currency = currency.toLowerCase()
    // @ts-ignore
    const pkgNames = globalThis.Bundlr.currencyArrayMap.find(e => e[1].some(v => v === currency)) as [[string, string], Array<string>]
    if (!pkgNames) {
        throw new Error(`No package found for currency ${currency}`)
    }
    currency = currency.charAt(0).toUpperCase() + currency.substring(1).toLowerCase()
    while (currency.includes("-")) {
        const index = currency.indexOf("-");
        currency = currency.substring(0, index) + currency.charAt(index + 1).toUpperCase() + currency.substring(index + 2)
    }
    try {
        // check global
        // @ts-ignore
        let pkg = globalThis[pkgNames[0][1]]
        if (!pkg) {
            // @ts-ignore
            pkg = await import(pkgNames[0][0]).catch(_ => { return })
        }
        if (!pkg) {
            pkg = require(pkgNames[0][0])
        }
        // @ts-ignore
        const flavour = pkg[`${currency}Bundlr`]
        if (!flavour) throw new Error(`Invalid flavour ${currency} - keys: ${Object.keys(pkg)}`)
        return flavour
    } catch (e) {
        throw new Error(`Unable to load Bundlr flavour ${currency} from ${pkgNames[0][0]} or from global ${pkgNames[0][1]} - please install it:\n 'npm i ${pkgNames[0][0]}'\n ${e}`)
    }
}