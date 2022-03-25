// eslint-disable-file @typescript-eslint/no-unused-vars
import Bundlr from "../";
import { promises, readFileSync, writeFileSync } from 'fs';
import * as v8 from "v8-profiler-next"
import Crypto from "crypto"


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
        let bundlr = new Bundlr("http://devnet.bundlr.network", "arweave", keys.arweave)
        console.log(bundlr.address)

        console.log(`balance: ${await bundlr.getLoadedBalance()}`);
        const bAddress = await bundlr.utils.getBundlerAddress(bundlr.currency);
        console.log(`bundlr address: ${bAddress}`);

        const transaction = await bundlr.createTransaction("aaa");
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

        const resu = await bundlr.uploader.uploadFolder("./testFolder", null, 10, false, true, async (log): Promise<void> => { console.log(log) })
        console.log(resu);

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
        if (!profiling) {
            console.log("done!");
            return
        };

        const cpuprofile = v8.stopProfiling(title)
        cpuprofile.export((_err, res) => {
            writeFileSync(`./profiles/cpu/${title}.cpuprofile`, res)
        })
        cpuprofile.delete();
        const heapProfile = v8.stopSamplingHeapProfiling();
        heapProfile.export((_err, res) => {
            writeFileSync(`./profiles/heap/${title}.heapprofile`, res)
        })
    }
}
main();
