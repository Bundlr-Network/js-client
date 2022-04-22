import BigNumber from "bignumber.js";
import { Signer } from "./signing";
import { DataItem } from "arbundles";
// common types shared between web and node versions

export interface CreateTxData { amount: BigNumber.Value, to: string, fee?: string }

export interface Tx {
    from: string | undefined;
    to: string | undefined;
    amount: BigNumber;
    blockHeight?: BigNumber;
    pending: boolean;
    confirmed: boolean
}
export interface CurrencyConfig { name: string, ticker: string, minConfirm?: number, wallet: any, providerUrl: string, isSlow?: boolean }

export interface Currency {
    isSlow: boolean
    needsFee: boolean

    base: [string, number];

    name: string

    minConfirm: number

    get address(): string;

    ticker: string

    getTx(txId: string): Promise<Tx>;

    ownerToAddress(owner: any): string;

    getId(item: DataItem): Promise<string>;

    price(): Promise<number>;

    sign(data: Uint8Array): Promise<Uint8Array>;

    getSigner(): Signer;

    verify(pub: any, data: Uint8Array, signature: Uint8Array): Promise<boolean>;

    getCurrentHeight(): Promise<BigNumber>;

    getFee(amount: BigNumber.Value, to?: string): Promise<BigNumber>;

    sendTx(data: any): Promise<any>; // TODO: make signature(s) more specific

    createTx(amount: BigNumber.Value, to: string, fee?: string): Promise<CreatedTx>;

    getPublicKey(): Promise<string | Buffer> | (string | Buffer);
}

export interface CreatedTx { txId: string | undefined, tx: any }

export interface FundData { reward: string, target: string, quantity: string, id: string }

export interface Manifest {
    manifest: string,
    version: string,
    paths: Record<string, Record<string, Record<"id", string>>>,
    index?: Record<"path", string>
}

export interface Withdrawal {
    publicKey: string | Buffer,
    currency: string,
    amount: string,
    nonce: number,
    signature: Buffer | string,
    sigType: number
}

export interface BundlrConfig { timeout?: number, providerUrl?: string, contractAddress?: string, minConfirm?: number }
