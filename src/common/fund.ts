import BigNumber from "bignumber.js";
import { FundData } from "./types";
import Utils from "./utils";

export default class Fund {
    protected utils: Utils;

    constructor(utils: Utils) {
        this.utils = utils;
    }

    /**
     * Function to Fund (send funds to) a Bundlr node - inherits instance currency and node
     * @param amount - amount in base units to send
     * @param multiplier - network tx fee multiplier - only works for specific currencies
     * @returns  - funding receipt
     */
    public async fund(amount: BigNumber.Value, multiplier = 1.0): Promise<FundData> {
        const _amount = new BigNumber(amount)
        if (!_amount.isInteger()) { throw new Error("must use an integer for funding amount") }
        const c = this.utils.currencyConfig;
        const to = await this.utils.getBundlerAddress(this.utils.currency);
        // winston's fee is actually for amount of data, not funds, so we have to 0 this.
        const baseFee = await c.getFee(c.base[0] === "winston" ? 0 : _amount, to)
        const fee = (baseFee.multipliedBy(multiplier)).toFixed(0).toString();
        const tx = await c.createTx(_amount, to, fee.toString())
        const nres = await c.sendTx(tx.tx);
        if(this.utils.currency === "polkadot"){
            tx.txId = nres
        }
        Utils.checkAndThrow(nres, `Sending transaction to the ${this.utils.currency} network`);
        await this.utils.confirmationPoll(tx.txId)
        const bres = await this.utils.api.post(`/account/balance/${this.utils.currency}`, { tx_id: tx.txId })
            .catch(_ => { throw new Error(`failed to post funding tx - ${tx.txId} - keep this id!`) })
        Utils.checkAndThrow(bres, `Posting transaction ${tx.txId} information to the bundler`);
        return { reward: fee, target: to, quantity: _amount.toString(), id: tx.txId };
    }
}
