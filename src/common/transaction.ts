import { createData, DataItem, DataItemCreateOptions } from "arbundles";
import { Signer } from "./signing";
import Bundlr from "./bundlr";
import Crypto from "crypto"

/**
 * Extended DataItem that allows for seamless bundlr operations, such as signing and uploading.
 * Takes the same parameters as a regular DataItem.
 */
export default class BundlrTransaction extends DataItem {
    private bundlr: Bundlr;
    private signer: Signer;

    constructor(data: string | Uint8Array, bundlr: Bundlr, opts?: DataItemCreateOptions) {
        super(createData(data, bundlr.currencyConfig.getSigner(), {
            ...opts, anchor: opts?.anchor ?? Crypto.randomBytes(32).toString("base64").slice(0, 32)
        }).getRaw())
        this.bundlr = bundlr;
        this.signer = bundlr.currencyConfig.getSigner();
    }

    public sign(): Promise<Buffer> {
        return super.sign(this.signer);
    }

    get size(): number {
        return this.getRaw().length
    }

    async upload(): Promise<any> {
        return this.bundlr.uploader.transactionUploader(this);
    }
}