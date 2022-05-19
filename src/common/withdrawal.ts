import { deepHash } from "arbundles";
import { stringToBuffer } from "arweave/node/lib/utils.js";
import { AxiosResponse } from "axios";
import Utils from "./utils";
import BigNumber from "bignumber.js";
import Api from "./api";
import base64url from "base64url";
import { Withdrawal } from "./types";


/**
 * Create and send a withdrawal request 
 * @param utils Instance of Utils 
 * @param api Instance of API
 * @param wallet Wallet to use
 * @param amount amount to withdraw in winston
 * @returns the response from the bundler
 */
export async function withdrawBalance(utils: Utils, api: Api, amount: BigNumber.Value): Promise<AxiosResponse<any>> {
    const c = utils.currencyConfig;
    const pkey = await c.getPublicKey();
    const data: Withdrawal = { publicKey: pkey, currency: utils.currency, amount: new BigNumber(amount).toString(), nonce: await utils.getNonce(), signature: Buffer.from([]), sigType: c.getSigner().signatureType }
    const deephash = await deepHash([stringToBuffer(data.currency), stringToBuffer(data.amount.toString()), stringToBuffer(data.nonce.toString())]);
    if (!Buffer.isBuffer(data.publicKey)) {
        data.publicKey = Buffer.from(data.publicKey);
    }

    // const a = data.publicKey.toString(); //fine
    // console.log(a)

    data.signature = Buffer.from(await c.sign(deephash))

    const isValid = await c.verify(data.publicKey, deephash, data.signature)

    // const opk = Buffer.from(data.publicKey)
    // const osig = data.signature; // (uint8array)

    data.publicKey = base64url.encode(data.publicKey)
    data.signature = base64url.encode(data.signature)

    // const b = base64url.decode(data.publicKey)
    // console.log(b) //fine

    const cpk = base64url.toBuffer(data.publicKey)
    const csig = base64url.toBuffer(data.signature)

    // console.log(cpk.toString()) //fine
    // console.log(`bad: ${base64url(cpk)}`)
    // console.log(base64url.decode(data.publicKey))

    // await c.ownerToAddress(await item.rawOwner());

    // should match opk and csig
    const dh2 = await deepHash([stringToBuffer(data.currency), stringToBuffer(data.amount.toString()), stringToBuffer(data.nonce.toString())])
    // console.log(cpk.equals(opk));
    // console.log(csig.equals(osig))
    // TODO: remove check once paranoia is gone
    const isValid2 = await c.verify(cpk, dh2, csig)
    const isValid3 = c.ownerToAddress(c.name == "arweave" ? base64url.decode(data.publicKey) : base64url.toBuffer(data.publicKey)) === c.address
    // console.log({ opk, osig })
    // console.log(isValid2)
    // console.log(isValid)

    if (!(isValid && isValid2 && isValid3)) { throw new Error(`Internal withdrawal validation failed - please report this!\nDebug Info:${JSON.stringify(data)}`) }

    // console.log(JSON.stringify({
    //     ...data,
    //     publicKey: base64url.toBuffer(data.publicKey),
    //     signature: base64url.toBuffer(data.signature)
    // }))
    // console.log(`derived: ${c.ownerToAddress(base64url.decode(data.publicKey))}`)
    const res = await api.post("/account/withdraw", data, { timeout: api.getConfig().timeout ?? 10_000 * 10 })
    Utils.checkAndThrow(res, "Withdrawing balance")
    return res;
}
