/* eslint-disable @typescript-eslint/ban-ts-comment */
// import *  as util from "util"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment

// globalThis.util ??= util;

// // shim for loading in NodeJS deps
// import * as buffer from "buffer/";
// import * as crypto from "crypto-browserify";

// import * as stream from "stream-browserify";
// import * as path from "path-browserify";
// /** @ts-ignore */
// globalThis.Buffer ??= buffer.default.Buffer;
// globalThis.Crypto ??= crypto;
// globalThis.process ??= { env: {} };
// globalThis.stream ??= stream;
// globalThis.path ??= path;
// /** @ts-ignore */

import { default as WebBundlr } from "./bundlr"
export { WebBundlr, WebBundlr as default }
// export { default } from "./bundlr"

// on demand injection.
const currencies: Array<[Array<string>, Array<string>]> = [
    [["@bundlr-network/ethereum-web", "BundlrEthereumWeb"], ["ethereum", "matic", "bnb", "fantom", "avalanche", "boba-eth", "arbitrum"]],
    [["@bundlr-network/near-web", "BundlrNearWeb"], ["near"]],
    [["@bundlr-network/solana-web", "BundlrSolanaWeb"], ["solana"]],
    [["@bundlr-network/erc20-web", "BundlrErc20Web"], ["boba", "chainlink"]]
]
// @ts-ignore
globalThis.Bundlr?.currencyArrayMap ? (globalThis.Bundlr.currencyArrayMap.concat(currencies)) : (globalThis.Bundlr = { currencyArrayMap: currencies })
// @ts-ignore
globalThis.BundlrClient ??= WebBundlr