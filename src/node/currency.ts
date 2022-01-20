import { FileDataItem } from "arbundles/file";
import { Signer } from "arbundles/src/signing";
import Arweave from "arweave";
import base64url from "base64url";
import BigNumber from "bignumber.js";
import { Tx, CurrencyConfig } from "../common/types"
import redstone from "redstone-api";
import { NodeCurrency } from "./types";

export default abstract class BaseNodeCurrency implements NodeCurrency {
    public base: [string, number];
    protected wallet: any
    protected _address: string
    protected providerUrl: any;
    protected providerInstance?: any
    protected ticker: string;
    protected name: string;
    protected minConfirm: number

    constructor(config: CurrencyConfig) {
        Object.assign(this, config);
        // this._address = 
    }

    // common methods

    async getAddress(): Promise<string> {
        return this.wallet ? this.ownerToAddress(await this.getPublicKey()) : undefined;
    }


    async getId(item: FileDataItem): Promise<string> {
        return base64url.encode(Buffer.from(await Arweave.crypto.hash(await item.rawSignature())));
    }
    async price(): Promise<number> {
        return getRedstonePrice(this.ticker);
    }
    abstract getTx(_txId: string): Promise<Tx>
    abstract ownerToAddress(_owner: any): Promise<string>
    abstract sign(_data: Uint8Array): Promise<Uint8Array>
    abstract getSigner(): Signer
    abstract verify(_pub: any, _data: Uint8Array, _signature: Uint8Array): Promise<boolean>
    abstract getCurrentHeight(): Promise<BigNumber>
    abstract getFee(_amount: BigNumber.Value, _to?: string): Promise<BigNumber>
    abstract sendTx(_data: any): Promise<any>
    abstract createTx(_amount: BigNumber.Value, _to: string, _fee?: string): Promise<{ txId: string; tx: any; }>
    abstract getPublicKey(): Promise<string>
}

export async function getRedstonePrice(currency: string): Promise<number> {
    return (await redstone.getPrice(currency)).value;
}
