import Arweave from "arweave";
import ArweaveSigner from "./ArweaveSigner";
import BigNumber from "bignumber.js";
import crypto from "crypto";
import base64url from "base64url";
import { CurrencyConfig, Tx } from "@bundlr-network/client/build/cjs/common/types";
import { Signer } from "@bundlr-network/client/build/cjs/common/signing/index"
import BaseNodeCurrency from "@bundlr-network/client/build/cjs/node/currency";
import NodeBundlr from "@bundlr-network/client/build/cjs/node/index";


export default class ArweaveConfig extends BaseNodeCurrency {
    declare protected providerInstance: Arweave;

    constructor(config: CurrencyConfig) {
        super(config)
        this.base = ["winston", 1e12];
        this.needsFee = true;
    }


    private async getProvider(): Promise<Arweave> {
        if (!this.providerInstance) {
            this.providerInstance = await Arweave.init({ host: this.providerUrl ?? "arweave.net", protocol: "https", port: 443 });
        }
        return this.providerInstance;
    }

    async getTx(txId: string): Promise<Tx> {
        const arweave = await this.getProvider()
        const txs = await arweave.transactions.getStatus(txId);
        let tx;
        if (txs.status == 200) {
            tx = await arweave.transactions.get(txId)
        }
        const confirmed = (txs.status !== 202 && txs.confirmed && txs?.confirmed?.number_of_confirmations >= this.minConfirm) ? true : false
        let owner;
        if (tx?.owner) {
            owner = this.ownerToAddress(tx.owner);
        }
        return {
            from: owner ?? undefined,
            to: tx?.target ?? undefined,
            amount: new BigNumber(tx?.quantity ?? 0),
            pending: (txs.status == 202),
            confirmed
        }
    }

    ownerToAddress(owner: any): string {

        return Arweave.utils.bufferTob64Url(crypto
            .createHash("sha256")
            .update((Arweave.utils.b64UrlToBuffer((Buffer.isBuffer(owner) ? base64url(owner) : owner))))
            .digest()
        )
    }

    async sign(data: Uint8Array): Promise<Uint8Array> {
        return Arweave.crypto.sign(this.wallet, data);
    }

    getSigner(): Signer {
        return new ArweaveSigner(this.wallet);
    }

    async verify(pub: any, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
        if (Buffer.isBuffer(pub)) {
            pub = pub.toString();
        }
        return Arweave.crypto.verify(pub, data, signature);
    }

    async getCurrentHeight(): Promise<BigNumber> {
        return (await this.getProvider()).network.getInfo().then(r => new BigNumber(r.height))
    }

    async getFee(amount: BigNumber.Value, to?: string): Promise<BigNumber> {
        return new BigNumber(await (await this.getProvider()).transactions.getPrice((new BigNumber(amount)).toNumber(), to)).integerValue(BigNumber.ROUND_CEIL)
    }

    async sendTx(data: any): Promise<void> {
        await (await this.getProvider()).transactions.post(data);
    }

    async createTx(amount: BigNumber.Value, to: string, fee?: string): Promise<{ txId: string; tx: any; }> {
        const arweave = await this.getProvider();
        const tx = await arweave.createTransaction({ quantity: (new BigNumber(amount)).toString(), reward: fee, target: to }, this.wallet)
        await arweave.transactions.sign(tx, this.wallet)
        return { txId: tx.id, tx };
    }

    getPublicKey(): string {
        return this.wallet.n
    }


}

export class ArweaveBundlr extends NodeBundlr {
    public static readonly currency = "arweave"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new ArweaveConfig({ name: "arweave", ticker: "AR", minConfirm: 10, providerUrl: config?.providerUrl ?? "arweave.net", wallet, isSlow: true })
        super(url, currencyConfig, config)
    }
}