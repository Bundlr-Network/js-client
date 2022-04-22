import { Signer } from "@bundlr-network/client/build/esm/common/signing/index"
import BigNumber from "bignumber.js";
import { CreatedTx, CurrencyConfig, Tx } from "@bundlr-network/client/build/esm/common/types"
import { KeyPair, utils, transactions, providers, WalletConnection, Near, keyStores } from "near-api-js"
import { decode, encode } from "bs58";
import BN from "bn.js"
import { sha256 } from "js-sha256";
import BaseWebCurrency from "@bundlr-network/client/build/esm/web/currency";
import WebBundlr from "@bundlr-network/client/build/esm/web/index";
import NearSigner from "./NearSigner";


export default class NearConfig extends BaseWebCurrency {
    // protected keyStore: KeyPair
    protected keyPair!: KeyPair
    declare protected wallet: WalletConnection
    protected near: Near
    declare protected providerInstance: providers.Provider


    constructor(config: CurrencyConfig) {
        super(config);
        this.near = this.wallet._near
        this.base = ["yoctoNEAR", 1e25]
        // this.keyPair = KeyPair.fromString(this.wallet)

    }

    async ready(): Promise<void> {
        if (!this.wallet.isSignedIn()) {
            throw new Error("Wallet has not been signed in!")
        }
        const keystore = new keyStores.BrowserLocalStorageKeyStore()
        const account = this.wallet.account();
        // console.log(this.address)
        // console.log(await account.getAccessKeys())
        // this._address = this.wallet.getAccountId()
        // this.keyPair = KeyPair.fromString(this.wallet)
        // console.log(await account.getAccessKeys())
        this.keyPair = await keystore.getKey(this.wallet._networkId, account.accountId)
        if (!this.keyPair) {
            this.keyPair = KeyPair.fromRandom("ed25519");
            const publicKey = this.keyPair.getPublicKey().toString();
            // this.wallet._networkId
            await keystore.setKey(this.wallet._networkId, account.accountId, this.keyPair)
            // console.log(publicKey)
            await account.addKey(publicKey);
        }
        // console.log(this.keyPair.getPublicKey().toString());
        // this._address = this.ownerToAddress(Buffer.from(this.keyPair.getPublicKey().data));
        this._address = await this.wallet.getAccountId();
        // this.providerInstance = new providers.JsonRpcProvider({ url: this.providerUrl });
        this.providerInstance = this.wallet._near.connection.provider
        // console.log(this.keyPair);
    }



    /**
     * NEAR wants both the sender ID and tx Hash, so we have to concatenate to keep with the interface.
     * @param txId assumes format senderID:txHash
     */
    async getTx(txId: string): Promise<Tx> {
        // NOTE: their type defs are out of date with their actual API (23-01-2022)... beware the expect-error when debugging! 
        const provider = await this.providerInstance
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

        // console.log(decode(status.receipts_outcome[0].block_hash))

        // // const routcometx = await provider.txStatusReceipts(decode(status.receipts_outcome[0].block_hash), status.receipts_outcome[0].id)
        // console.log({ blockHeight, status, latestBlockHeight })
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
        // should just return the loaded address?
        const pubkey = typeof owner === "string" ? owner : encode(owner)
        return Buffer.from(decode(pubkey.replace("ed25519:", ""))).toString("hex")
    }


    async sign(data: Uint8Array): Promise<Uint8Array> {
        return this.getSigner().sign(data)
    }

    getSigner(): Signer {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        return new NearSigner(this.keyPair.secretKey)
    }

    async verify(pub: any, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
        return NearSigner.verify(pub, data, signature)
    }

    async getCurrentHeight(): Promise<BigNumber> {
        // const provider = await this.getProvider();
        const res = await this.providerInstance.status();
        return new BigNumber(res.sync_info.latest_block_height);
    }

    async getFee(_amount: BigNumber.Value, _to?: string): Promise<BigNumber> {
        // const provider = await this.getProvider();
        // one unit of gas
        // const res = await provider.connection.provider.gasPrice(await (await this.getCurrentHeight()).toNumber())
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error 
        const res = await this.providerInstance.gasPrice(null) // null == gas price as of latest block
        // multiply by action cost in gas units (assume only action is transfer)
        // 4.5x10^11 gas units for fund transfers
        return new BigNumber(res.gas_price).multipliedBy(450_000_000_000)
    }

    async sendTx(data: any): Promise<any> {
        data as transactions.SignedTransaction;
        const res = await this.providerInstance.sendTransaction(data)
        return `${this.address}:${res.transaction.hash}` // encode into compound format
    }

    async createTx(amount: BigNumber.Value, to: string, _fee?: string): Promise<CreatedTx> {

        const accessKey = await this.providerInstance.query({ request_type: "view_access_key", finality: "final", account_id: this.address, public_key: this.keyPair.getPublicKey().toString() })
        // console.log(accessKey);
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


    async getPublicKey(): Promise<string | Buffer> {
        return Buffer.from(this.keyPair.getPublicKey().data)

    }
}

export class NearBundlr extends WebBundlr {
    public static readonly currency = "near"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new NearConfig({ name: "near", ticker: "NEAR", providerUrl: config?.providerUrl ?? "https://rpc.mainnet.near.org", wallet })
        super(url, currencyConfig, config)
    }
}