import BigNumber from "bignumber.js";
import { CurrencyConfig, Tx } from "@bundlr-network/client/build/esm/common/types";
import BaseWebCurrency from "@bundlr-network/client/build/esm/web/currency";
import WebBundlr from "@bundlr-network/client/build/esm/web/index";
import { getRedstonePrice } from "@bundlr-network/client/build/cjs/node/currency";
import InjectedCosmosSigner from "./InjectedCosmosSigner";

import * as stargate from "@cosmjs/stargate";
import * as amino from "@cosmjs/amino";
import * as proto from "@cosmjs/proto-signing";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { DirectSecp256k1HdWallet, TxBodyEncodeObject } from "@cosmjs/proto-signing";
import { HdPath, Slip10RawIndex, Secp256k1, EnglishMnemonic, Bip39, Slip10, Slip10Curve, Secp256k1Keypair } from "@cosmjs/crypto";
import { Int53 } from "@cosmjs/math";
import { fromBase64 } from "@cosmjs/encoding";
import { BroadcastMode } from "@cosmjs/launchpad";
import { Keplr, Key } from "@keplr-wallet/types";
import { getKeplrFromWindow } from "@keplr-wallet/stores";
import { TxResponse } from "cosmjs-types/cosmos/base/abci/v1beta1/abci";

export interface CosmosCurrencyConfig extends CurrencyConfig { 
    localConfig: {
        prefix: string,
        derivePath: string,
        fee: string,
        denomination: string,
        decimals: number,
        chainId: string
    };
}
export default class CosmosConfig extends BaseWebCurrency {

    // declare protected keyPair: Secp256k1Keypair;
    declare protected providerInstance: stargate.SigningStargateClient;
    declare protected wallet: Keplr;
    declare signerInstance: InjectedCosmosSigner;
    private localConfig: {
        prefix: string,
        derivePath: string,
        fee: string,
        denomination: string,
        decimals: number,
        chainId: string
    };
    declare public path: HdPath;

    constructor(config: CosmosCurrencyConfig) {
        super(config);
        this.localConfig = config.localConfig;
        this.base = [this.localConfig.denomination, this.localConfig.decimals];
        setTimeout(async () => {await this.ready()}, 1);
    }

    protected async getProvider(): Promise<any> {
        if (!this.providerInstance) {
            await this.ready();
        }
        return this.providerInstance;
    }

    async getTx(txId: string): Promise<Tx> {
        const provider = await this.getProvider();
        const transaction = await provider.getTx(txId);
        const rawlog = JSON.parse(transaction.rawLog);
        const confirmed = (transaction.code === 0);
        let tx;
         if(this.name === "akash"){
            tx = {
                from: rawlog[0].events[1].attributes[1].value,
                to: rawlog[0].events[1].attributes[0].value,
                amount: new BigNumber(rawlog[0].events[1].attributes[2].value.slice(0,-(this.base[0].length))),
                blockHeight: new BigNumber(transaction.height),
                pending: false,
                confirmed: confirmed
            };
        }else{
            tx = {
                from: rawlog[0].events[3].attributes[1].value,
                to: rawlog[0].events[3].attributes[0].value,
                amount: new BigNumber(rawlog[0].events[3].attributes[2].value.slice(0,-(this.base[0].length))),
                blockHeight: new BigNumber(transaction.height),
                pending: false,
                confirmed: confirmed
            };
        }
        return tx;
    }
    
    ownerToAddress(owner: any): string {
        const compressed = Secp256k1.compressPubkey(owner);
        const encodePubkey = amino.encodeSecp256k1Pubkey(compressed);
        const address = amino.pubkeyToAddress(encodePubkey, this.localConfig.prefix);
        return address;
    }

    async sign(data: Uint8Array): Promise<Uint8Array> {
        return await this.getSigner().sign(data);
    }

    getSigner(): InjectedCosmosSigner {
        if(!this.signerInstance){
            this.ready();
        }
        return this.signerInstance;
    }

    async verify(pub: Buffer, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
        return InjectedCosmosSigner.verify(pub, data, signature);
    }

    async getCurrentHeight(): Promise<BigNumber> {
        const provider = await this.getProvider();
        return await provider.getHeight();
    }

    async getFee(): Promise<BigNumber> {
        return new BigNumber(this.localConfig.fee);
    }

    async sendTx(data: any): Promise<string> {
        // const send = await (await this.getProvider()).broadcastTx(data, 60000, 3000);
        const send = await this.wallet.sendTx(this.localConfig.chainId, data, BroadcastMode.Block)
        return Buffer.from(send).toString("hex");
    }

    async createTx(amount: BigNumber.Value, to: string): Promise<{ txId: string; tx: any; }> {
            const provider = await this.getProvider();

            const account = this._address;

            const sendingAmount = {
                denom: this.base[0],
                amount: amount.toString(),
            };

            const sendingFee = {
                amount: [
                    {
                    denom: this.base[0],
                    amount: this.localConfig.fee,
                    },
                ],
                gas: "100000",
            };

            const sendMsg: stargate.MsgSendEncodeObject = {
                typeUrl: "/cosmos.bank.v1beta1.MsgSend",
                value: {
                fromAddress: account,
                toAddress: to,
                amount: [sendingAmount],
                }
            };

            const { sequence, accountNumber }: stargate.SequenceResponse = await this.providerInstance.getSequence(this._address);
            console.log({sequence, accountNumber});

            const txBodyEncodeObject: TxBodyEncodeObject = {
                typeUrl: "/cosmos.tx.v1beta1.TxBody",
                value: {
                messages: [sendMsg],
                memo: "",
                },
            };

            const txBodyBytes = provider.registry.encode(txBodyEncodeObject);

            const gasLimit = Int53.fromString(sendingFee.gas).toNumber();

            const pubKey = await this.wallet.getKey(this.localConfig.chainId);
            
            const pubkey = proto.encodePubkey(amino.encodeSecp256k1Pubkey(pubKey.pubKey));

            const authInfoBytes = proto.makeAuthInfoBytes([{ pubkey, "sequence": sequence }, ], sendingFee.amount, gasLimit);
            console.log(`authInfoBytes:${authInfoBytes}`)

            const signDoc = proto.makeSignDoc(txBodyBytes, authInfoBytes, this.localConfig.chainId, accountNumber);
            console.log(`Signdoc:${signDoc}`)
            
            const { signature, signed } = await this.wallet.signDirect(this.localConfig.chainId, this._address, signDoc);

            const txBytes = TxRaw.fromPartial({
            bodyBytes: signed.bodyBytes,
            authInfoBytes: signed.authInfoBytes,
            signatures: [fromBase64(signature.signature)],
            });

            const enc = TxRaw.encode(txBytes).finish();

        return { tx: enc, txId: "" };
    }

    async getPublicKey(): Promise<string | Buffer>{
        // const signer = await this.getSigner();
        // const pk = Secp256k1.compressPubkey(signer.pubKey);
        // // const pk = signer.publicKey;
        const signer = await this.getSigner();
        const pub = await signer.getPublicKey();
        const pk = Secp256k1.uncompressPubkey(pub);

        return Buffer.from(pk);
    }

    public async ready(): Promise<void> {
        const path2number = new BigNumber(this.localConfig.derivePath).toNumber();
        this.path = [
            Slip10RawIndex.hardened(44),
            Slip10RawIndex.hardened(path2number),
            Slip10RawIndex.hardened(0),
            Slip10RawIndex.normal(0),
            Slip10RawIndex.normal(0),
          ];
        
        const k = await getKeplrFromWindow();
        console.log(k);
        if(k !== undefined){
            await k.enable(this.localConfig.chainId);        
            this.wallet ??= k;

            const offlineSigner = k.getOfflineSigner(this.localConfig.chainId);
        
            this.providerInstance = await stargate.SigningStargateClient.connectWithSigner(
                    this.providerUrl,
                    offlineSigner
            );
            const key = await (await this.wallet.getKey(this.localConfig.chainId));
            console.log(key);

            // this._address = key.bech32Address;
            this.signerInstance ??= new InjectedCosmosSigner(this.wallet, this.localConfig.chainId, this.localConfig.prefix);
            this._address = this.ownerToAddress(await this.getPublicKey());

        }
        return;
    }

    public async getGas(): Promise<[BigNumber, number]> {
        return [new BigNumber(await getRedstonePrice("ATOM")), 1e6]
    }

}

export class CosmosBundlr extends WebBundlr {
    public static readonly currency = "cosmos"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new CosmosConfig({ name: "cosmos", ticker: "ATOM", providerUrl: config?.providerUrl ?? "https://cosmoshub.validator.network/", wallet, localConfig: { prefix: "cosmos", "derivePath": "118", "fee": "2500", "denomination": "uatom", "decimals": 1e6, "chainId": "cosmoshub-4" } })
        super(url, currencyConfig, config)
    }
}
export class AkashBundlr extends WebBundlr {
    public static readonly currency = "akash"
    constructor(url: string, wallet?: any, config?: { timeout?: number, providerUrl?: string, contractAddress?: string }) {
        const currencyConfig = new CosmosConfig({ name: "akash", ticker: "AKT", providerUrl: config?.providerUrl ?? "https://rpc.akash.forbole.com", wallet, localConfig: { prefix: "akash", "derivePath": "118", "fee": "100", "denomination": "uakt", "decimals": 1e6, "chainId": "akashnet-2" } })
        super(url, currencyConfig, config)
    }
}
