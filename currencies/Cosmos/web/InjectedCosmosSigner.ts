import { SignatureConfig, SIG_CONFIG, Signer } from "@bundlr-network/client/build/esm/common/signing/index";
import base64url from "base64url";
import { Keplr } from "@keplr-wallet/types";
import * as amino from "@cosmjs/amino";
import { Secp256k1, Secp256k1Signature, sha256 } from "@cosmjs/crypto";
import { fromBase64, toAscii, toBase64 } from "@cosmjs/encoding";


export default class InjectedCosmosSigner {
  private signer: Keplr;
  private chainId: string;
  public publicKey!: Buffer;
  declare static prefix: string;

  readonly ownerLength: number = SIG_CONFIG[SignatureConfig.COSMOS].pubLength;
  readonly signatureLength: number =
    SIG_CONFIG[SignatureConfig.COSMOS].sigLength;
  readonly signatureType: SignatureConfig = SignatureConfig.COSMOS;

  constructor(wallet: Keplr, chainId: string, prefix: string ) {
    this.signer = wallet;
    this.chainId = chainId;
    InjectedCosmosSigner.prefix = prefix;
  }

  async getPublicKey(): Promise<Buffer> {
    if (!this.publicKey) {
      await this.setPublicKey();
    }
    return this.publicKey;
  }

  async setPublicKey(): Promise<void> {
    const address = "sign this message to connect to Bundlr.Network";
    const offlineSigner = this.signer.getOfflineSigner(this.chainId);
    const accounts = await offlineSigner.getAccounts();
    let signed = await this.signer.signArbitrary(this.chainId, accounts[0].address , address);
    const sign = amino.decodeSignature(signed);
    const uncompressed = Secp256k1.uncompressPubkey(sign.pubkey);
    this.publicKey = Buffer.from(uncompressed);
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    if (!this.publicKey) {
      await this.setPublicKey();
    }
    //sign
    const offlineSigner = this.signer.getOfflineSigner(this.chainId)
    const accounts = await offlineSigner.getAccounts();
    let signed = await this.signer.signArbitrary(this.chainId, accounts[0].address, toBase64(message));
    //returns
    const sign = amino.decodeSignature(signed);

    const prefix = Buffer.from(InjectedCosmosSigner.prefix);
    const newSignature = new Uint8Array(96);

    newSignature.set(prefix, 0);
    newSignature.set(sign.signature, 32);

    return Buffer.from(newSignature);
  }

  static async verify(
    pk: string | Buffer,
    message: Uint8Array,
    signature: Uint8Array
  ): Promise<boolean> {
    let p = pk;
    if (typeof pk === "string") p = base64url.toBuffer(pk);

    let verified = false;

    const prefixBuffer = Buffer.from(signature.slice(0, 32));
    const prefixHex = prefixBuffer.toString("hex");
    const regex = /00/ig;
    const bufferRemove00s = prefixHex.replace(regex, "");
    const newPrefixBuffer = Buffer.from(bufferRemove00s, "hex").toString("utf-8");
    
    const newSignature = signature.slice(-64);
    
    try {      
      verified = await InjectedCosmosSigner.verifyADR036Signature(toBase64(message), toBase64(Secp256k1.compressPubkey(Buffer.from(p))), toBase64(Buffer.from(newSignature)), newPrefixBuffer)
      //eslint-disable-next-line no-empty
    } catch (e) {
      console.log(e);
    }
    console.log(`Is Verified: ${verified}`);
    return verified;
  }

  static makeADR036AminoSignDoc(message: string, pubKey: string, prefix: string): amino.StdSignDoc {
    const signer = amino.pubkeyToAddress(
      {
        type: "tendermint/PubKeySecp256k1",
        value: pubKey,
      },
      prefix,
    );

    return amino.makeSignDoc(
      [
        {
          type: "sign/MsgSignData",
          value: {
            signer,
            data: toBase64(toAscii(message)),
          },
        },
      ],
      {
        gas: "0",
        amount: [],
      },
      "",
      "",
      0,
      0,
    );
  }

  static async verifyADR036Signature(
    message: string,
    pubKey: string,
    signature: string,
    prefix: string,
  ): Promise<boolean> {
    const signBytes = amino.serializeSignDoc(InjectedCosmosSigner.makeADR036AminoSignDoc(message, pubKey, prefix));
    const messageHash = sha256(signBytes);

    const parsedSignature = Secp256k1Signature.fromFixedLength(
      fromBase64(signature),
    );
    const parsedPubKey = fromBase64(pubKey);

    return await Secp256k1.verifySignature(
      parsedSignature,
      messageHash,
      parsedPubKey,
    );
  }
}
