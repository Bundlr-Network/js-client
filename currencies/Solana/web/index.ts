import { Signer } from "@bundlr-network/client/build/esm/common/signing/index";
import BigNumber from "bignumber.js";
import HexInjectedSolanaSigner from "./HexInjectedSolanaSigner"
import { CreatedTx, CurrencyConfig, Tx } from "@bundlr-network/client/build/esm/common/types";
import BaseWebCurrency from "@bundlr-network/client/build/esm/web/currency"
import * as web3 from "@solana/web3.js";
import bs58 from "bs58";
import { MessageSignerWalletAdapter } from "@solana/wallet-adapter-base";
import retry from "async-retry";
import WebBundlr from "@bundlr-network/client/build/esm/web/index";

export default class SolanaConfig extends BaseWebCurrency {
    private signer!: HexInjectedSolanaSigner
    declare protected wallet: MessageSignerWalletAdapter

    constructor(config: CurrencyConfig) {
        super(config);
        this.base = ["lamports", 1e9];
    }

    private async getProvider(): Promise<web3.Connection> {
        if (!this.providerInstance) {
            this.providerInstance = new web3.Connection(
                this.providerUrl,
                {
                    confirmTransactionInitialTimeout: 60_000,
                    commitment: "confirmed"
                }
            );
        }
        return this.providerInstance;
    }


    async getTx(txId: string): Promise<Tx> {
        const connection = await this.getProvider()
        const stx = await connection.getTransaction(txId, { commitment: "confirmed" });
        if (!stx) throw new Error("Confirmed tx not found");

        const currentSlot = await connection.getSlot("confirmed");

        const amount = new BigNumber(stx?.meta?.postBalances[1] ?? 0).minus(
            new BigNumber(stx?.meta?.preBalances[1] ?? 0),
        );

        const tx: Tx = {
            from: stx.transaction.message.accountKeys[0].toBase58(),
            to: stx.transaction.message.accountKeys[1].toBase58(),
            amount: amount,
            blockHeight: new BigNumber(stx.slot),
            pending: false,
            confirmed: currentSlot - stx.slot >= 10,
        };
        return tx;
    }

    ownerToAddress(owner: any): string {
        if (typeof owner === "string") {
            owner = Buffer.from(owner)
        }
        return bs58.encode(owner);
    }

    async sign(data: Uint8Array): Promise<Uint8Array> {
        return await (await this.getSigner()).sign(data);
    }

    getSigner(): Signer {
        if (!this.signer) {
            this.signer = new HexInjectedSolanaSigner(this.wallet)
        }
        return this.signer;
    }

    verify(pub: any, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
        return HexInjectedSolanaSigner.verify(pub, data, signature);
    }

    async getCurrentHeight(): Promise<BigNumber> {
        const bh = await retry(
            async (bail) => {
                try {
                    return (await (await this.getProvider()).getEpochInfo()).blockHeight
                } catch (e: any) {
                    if (e.message?.includes("blockheight")) throw e;
                    else bail(e);
                    throw new Error("Unreachable");
                }
            },
            { retries: 3, minTimeout: 1000 }
        );
        if (bh) {
            return new BigNumber(bh)
        }
        throw new Error("Solana BlockHash is null")
    }

    async getFee(_amount: BigNumber.Value, _to?: string): Promise<BigNumber> {
        // const connection = await this.getProvider()
        // const block = await connection.getRecentBlockhash();
        // const feeCalc = await connection.getFeeCalculatorForBlockhash(
        //     block.blockhash,
        // );
        // return new BigNumber(feeCalc.value.lamportsPerSignature);
        return new BigNumber(5000) // hardcode it for now
    }

    async sendTx(data: any): Promise<string> {

        return await this.wallet.sendTransaction(data, await this.getProvider(), { skipPreflight: true })

    }

    async createTx(
        amount: BigNumber.Value,
        to: string,
        _fee?: string,
    ): Promise<CreatedTx> {
        // TODO: figure out how to manually set fees
        const pubkey = new web3.PublicKey(await this.getPublicKey())
        const hash = await retry(
            async (bail) => {
                try {
                    return (await (await this.getProvider()).getRecentBlockhash()).blockhash
                } catch (e: any) {
                    if (e.message?.includes("blockhash")) throw e;
                    else bail(e);
                    throw new Error("Unreachable");
                }
            },
            { retries: 3, minTimeout: 1000 }
        );

        const transaction = new web3.Transaction({
            recentBlockhash: hash,
            feePayer: pubkey
        });

        transaction.add(
            web3.SystemProgram.transfer({
                fromPubkey: pubkey,
                toPubkey: new web3.PublicKey(to),
                lamports: +new BigNumber(amount).toNumber(),
            }),
        );

        return { tx: transaction, txId: undefined };
    }

    async getPublicKey(): Promise<string | Buffer> {
        const pkey = this.wallet?.publicKey?.toBuffer()
        if (!pkey) {
            throw new Error("Public Key is undefined!")
        }
        return pkey
    }

}

export class SolanaBundlr extends WebBundlr {
    public static readonly currency = "solana"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new SolanaConfig({ name: "solana", ticker: "SOL", providerUrl: config?.providerUrl ?? "https://api.mainnet-beta.solana.com/", wallet })
        super(url, currencyConfig, config)
    }
}