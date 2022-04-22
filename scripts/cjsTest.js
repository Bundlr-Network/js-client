
async function main() {
    const ArweaveBundlr = require("@bundlr-network/arweave").ArweaveBundlr
    const readFileSync = require("fs").readFileSync
    const keys = JSON.parse(readFileSync("wallet.json").toString());
    const bundlr = new ArweaveBundlr("https://devnet.bundlr.network", keys.arweave)
    console.log(`Balance: ${await bundlr.getLoadedBalance()}`)
}

main()
console.log("done")