import { Signer } from "@bundlr-network/client/build/cjs/common/signing/index"
import BigNumber from "bignumber.js";
import { CurrencyConfig, Tx } from "@bundlr-network/client/build/cjs/common/types"
import BaseNodeCurrency from "@bundlr-network/client/build/cjs/node/currency";
import { KeyPair, utils, transactions, providers } from "near-api-js"
import { decode, encode } from "bs58";
import BN from "bn.js"
import { sha256 } from "js-sha256";
import { JsonRpcProvider } from "near-api-js/lib/providers";
import NearSigner from "./NearSigner";
import { NodeBundlr } from "@bundlr-network/client/build/cjs/node/index";


export default class NearConfig extends BaseNodeCurrency {
    protected keyPair: KeyPair

    declare protected providerInstance?: JsonRpcProvider


    constructor(config: CurrencyConfig) {
        super(config);
        this.base = ["yoctoNEAR", 1e25]
        this.keyPair = KeyPair.fromString(this.wallet)
    }

    protected async getProvider(): Promise<JsonRpcProvider> {
        if (!this.providerInstance) {
            this.providerInstance = new providers.JsonRpcProvider({ url: this.providerUrl });
        }
        return this.providerInstance;
    }



    /**
     * NEAR wants both the sender ID and tx Hash, so we have to concatenate to keep with the interface.
     * @param txId assumes format senderID:txHash
     */
    async getTx(txId: string): Promise<Tx> {
        // NOTE: their type defs are out of date with their actual API (23-01-2022)... beware the expect-error when debugging! 
        const provider = await this.getProvider()
        const [id, hash] = txId.split(":");
        const status = await provider.txStatusReceipts(decode(hash), id)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error

        const blockHeight = (await provider.block(status.transaction_outcome.block_hash));
        const latestBlockHeight = (await provider.block({ finality: "final" })).header.height
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        if (status.receipts_outcome[0].outcome.status.SuccessValue !== "") { throw new Error("Transaction failed!") }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const deposit = status.receipts[0].receipt.Action.actions[0].Transfer.deposit ?? 0
        return {
            from: id,
            to: status.transaction.receiver_id,
            amount: new BigNumber(deposit),
            blockHeight: new BigNumber(blockHeight.header.height),
            pending: false,
            confirmed: latestBlockHeight - blockHeight.header.height >= this.minConfirm
        }
    }


    /**
     * address = accountID
     * @param owner // assumed to be the "ed25519:" header + b58 encoded key 
     */
    ownerToAddress(owner: any): string {
        return (typeof owner === "string")
            ? Buffer.from(decode(owner.replace("ed25519:", ""))).toString("hex")
            : Buffer.from(decode(encode(owner))).toString("hex")
    }


    async sign(data: Uint8Array): Promise<Uint8Array> {
        return this.getSigner().sign(data)
    }

    getSigner(): Signer {
        return new NearSigner(this.wallet)
    }

    async verify(pub: any, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
        return NearSigner.verify(pub, data, signature)
    }

    async getCurrentHeight(): Promise<BigNumber> {
        const provider = await this.getProvider()
        const res = await provider.status();
        return new BigNumber(res.sync_info.latest_block_height);
    }
    /**
     * NOTE: assumes only operation is transfer
     * @param _amount 
     * @param _to 
     * @returns 
     */
    async getFee(_amount: BigNumber.Value, _to?: string): Promise<BigNumber> {
        // TODO: use https://docs.near.org/docs/concepts/gas and https://docs.near.org/docs/api/rpc/protocol#genesis-config
        // to derive cost from genesis config to generalise support.
        const provider = await this.getProvider()
        const res = await provider.gasPrice(null) // null == gas price as of latest block
        // multiply by action cost in gas units (assume only action is transfer)
        // 4.5x10^11 gas units for fund transfers
        return new BigNumber(res.gas_price).multipliedBy(450_000_000_000)
    }

    async sendTx(data: any): Promise<any> {
        data as transactions.SignedTransaction;
        const res = await (await this.getProvider()).sendTransaction(data)
        return `${this.address}:${res.transaction.hash}` // encode into compound format
    }

    async createTx(amount: BigNumber.Value, to: string, _fee?: string): Promise<{ txId: string | undefined; tx: any; }> {
        const provider = await this.getProvider()
        const accessKey = await provider.query(({ request_type: "view_access_key", finality: "final", account_id: this.address, public_key: this.keyPair.getPublicKey().toString() }))
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const nonce = ++accessKey.nonce
        const recentBlockHash = utils.serialize.base_decode(accessKey.block_hash)
        const actions = [transactions.transfer(new BN(new BigNumber(amount).toString()))];
        const tx = transactions.createTransaction(this.address, this.keyPair.getPublicKey(), to, nonce, actions, recentBlockHash)
        const serialTx = utils.serialize.serialize(transactions.SCHEMA, tx);
        const serialTxHash = new Uint8Array(sha256.array(serialTx))
        const signature = this.keyPair.sign(serialTxHash);
        const signedTx = new transactions.SignedTransaction({
            transaction: tx,
            signature: new transactions.Signature({
                keyType: tx.publicKey.keyType,
                data: signature.signature,
            }),
        });
        return { tx: signedTx, txId: undefined }
    }
    getPublicKey(): string | Buffer {
        this.keyPair = KeyPair.fromString(this.wallet)
        return Buffer.from(this.keyPair.getPublicKey().data)

    }
}

export class NearBundlr extends NodeBundlr {
    public static readonly currency = "near"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new NearConfig({ name: "near", ticker: "NEAR", providerUrl: config?.providerUrl ?? "https://rpc.mainnet.near.org", wallet })
        super(url, currencyConfig, config)
    }
}