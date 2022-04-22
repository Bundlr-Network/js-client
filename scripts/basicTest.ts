// eslint-disable-file @typescript-eslint/no-unused-vars

// import Bundlr from "../"; //testing built code
import Bundlr from "../src/index" //testing direct from TS source

import { promises, readFileSync, writeFileSync } from 'fs';
import * as v8 from "v8-profiler-next"
import Crypto from "crypto"
import { checkManifest } from "./checkManifest";
import { genData } from "./genData";

// import { ArweaveBundlr } from "@bundlr-network/arweave";

const profiling = false;
async function main() {
    const title = new Date().toUTCString()
    try {
        if (profiling) {
            v8.setGenerateType(1); // set profile type
            v8.startProfiling(title, true); // cpu
            v8.startSamplingHeapProfiling(); // heap
            setInterval(() => {
                for (const [key, value] of Object.entries(process.memoryUsage())) {
                    console.log(`Memory usage by ${key}, ${value / 1000000}MB `)
                }
            }, 2000)
            console.log("profiling configured");
        }


        const keys = JSON.parse(readFileSync("wallet.json").toString());

        let bundlr = await Bundlr.init("https://devnet.bundlr.network", "arweave", keys.arweave)
        //let bundlr = new ArweaveBundlr("https://devnet.bundlr.network", keys.arweave)
        console.log(bundlr.address)

        console.log(`balance: ${await bundlr.getLoadedBalance()}`);
        const bAddress = await bundlr.utils.getBundlerAddress(bundlr.currency);
        console.log(`bundlr address: ${bAddress}`);
        const tags = [{ name: "Content-Type", value: "text/plain" }]
        const transaction = bundlr.createTransaction("Hello, Bundlr!", { tags });
        await transaction.sign();

        console.log(transaction.id)
        console.log(await transaction.isValid());
        const res = await transaction.upload();
        console.log(`Upload: ${JSON.stringify(res.data)}`);

        let rec = await bundlr.uploadFile("a.txt");
        console.log(JSON.stringify(rec.data));
        console.log(JSON.stringify(rec.status));


        const ctx = bundlr.createTransaction(Crypto.randomBytes(15_000_000).toString("base64"))
        await ctx.sign()

        bundlr.uploader.useChunking = true
        const cres = await ctx.upload()
        console.log(cres)
        bundlr.uploader.useChunking = false

        await promises.rm("testFolder-manifest.json", { force: true })
        await promises.rm("testFolder-manifest.csv", { force: true })
        await promises.rm("testFolder-id.txt", { force: true })
        await promises.rm("./testFolder", { recursive: true, force: true })

        const concurrency = 10
        await genData("./testFolder", 10, 1_000, 10_000)

        const resu = await bundlr.uploader.uploadFolder("./testFolder", "0.json", concurrency, false, true, async (log): Promise<void> => { console.log(log) })
        console.log(resu);

        await checkManifest("./testFolder", concurrency)

        console.log(`balance: ${await bundlr.getLoadedBalance()}`);

        let tx = await bundlr.fund(1, 1);
        console.log(tx);
        console.log(`balance: ${await bundlr.getLoadedBalance()}`);

        let resw = await bundlr.withdrawBalance(1);
        console.log(`withdrawal: ${JSON.stringify(resw.data)}`);
        console.log(`balance: ${await bundlr.getLoadedBalance()}`);


    } catch (e) {
        console.log(e);
    } finally {
        console.log("done!");
        if (!profiling) {
            return
        };

        const cpuprofile = v8.stopProfiling(title)
        cpuprofile.export((_err, res) => {
            writeFileSync(`./profiles/cpu/${title}.cpuprofile`, res ?? Buffer.alloc(0))
        })
        cpuprofile.delete();
        const heapProfile = v8.stopSamplingHeapProfiling();
        heapProfile.export((_err, res) => {
            writeFileSync(`./profiles/heap/${title}.heapprofile`, res ?? Buffer.alloc(0))
        })
    }
}
main();
