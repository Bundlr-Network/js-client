import { DataItem } from "arbundles";
import { Signer } from "../common/signing/index";
import Arweave from "arweave";
import base64url from "base64url";
import BigNumber from "bignumber.js";
import { Tx, CurrencyConfig, CreatedTx } from "../common/types"
import axios from "axios";
import { WebCurrency } from "./types";
import utils from "../common/utils";

export default abstract class BaseWebCurrency implements WebCurrency {
    public base!: [string, number];
    protected wallet!: any
    protected _address!: string
    protected providerUrl!: string;
    protected providerInstance?: any
    public ticker!: string;
    public name!: string;

    public minConfirm = 5;
    public isSlow = false;
    public needsFee = false;

    constructor(config: CurrencyConfig) {
        Object.assign(this, config);
    }

    // common methods

    get address(): string {
        return this._address
    }

    public async ready(): Promise<void> {
        this._address = this.wallet ? this.ownerToAddress(await this.getPublicKey()) : "";
    }

    async getId(item: DataItem): Promise<string> {
        return base64url.encode(Buffer.from(await Arweave.crypto.hash(item.rawSignature)));
    }
    async price(): Promise<number> {
        return getRedstonePrice(this.ticker);
    }
    abstract getTx(_txId: string): Promise<Tx>
    abstract ownerToAddress(_owner: any): string
    abstract sign(_data: Uint8Array): Promise<Uint8Array>
    abstract getSigner(): Signer
    abstract verify(_pub: any, _data: Uint8Array, _signature: Uint8Array): Promise<boolean>
    abstract getCurrentHeight(): Promise<BigNumber>
    abstract getFee(_amount: BigNumber.Value, _to?: string): Promise<BigNumber>
    abstract sendTx(_data: any): Promise<any>
    abstract createTx(_amount: BigNumber.Value, _to: string, _fee?: string): Promise<CreatedTx>
    abstract getPublicKey(): Promise<string | Buffer>
}


export async function getRedstonePrice(currency: string): Promise<number> {
    const res = await axios.get<any>(`https://api.redstone.finance/prices?symbol=${currency}&provider=redstone&limit=1`)
    await utils.checkAndThrow(res, "Getting price data")
    return res.data[0].value;
}
// export const registeredCurrencies: Record<string, WebCurrency> = {}
// eslint-disable-next-line @typescript-eslint/naming-convention

