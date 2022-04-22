import { MessageSignerWalletAdapter } from "@solana/wallet-adapter-base";
import InjectedSolanaSigner from "./injectedSolanaSigner";

export default class HexSolanaSigner extends InjectedSolanaSigner {
  signatureType = 4; // for solana sig type

  constructor(provider: MessageSignerWalletAdapter) {
    super(provider);
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    return super.sign(Buffer.from(Buffer.from(message).toString("hex")));
  }

  static async verify(
    pk: Buffer,
    message: Uint8Array,
    signature: Uint8Array,
  ): Promise<boolean> {
    return super.verify(
      pk,
      Buffer.from(Buffer.from(message).toString("hex")),
      signature,
    );
  }
}
