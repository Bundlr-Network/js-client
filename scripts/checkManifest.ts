import * as p from "path";
import { promises, readFileSync } from "fs";
import axios from "axios";
import PromisePool from "@supercharge/promise-pool/dist";
import { ArweaveBundlr } from "@bundlr-network/arweave-node"
import { genData } from "./genData";

export async function checkManifest(path: string, concurrency = 100, id?: string) {
    path = p.resolve(path)
    const basePath = p.join(p.join(path, `${p.sep}..`), `${p.basename(path)}-`)
    const manifestID = id ? id : (await promises.readFile(`${basePath}id.txt`)).toString()
    console.log(`validating manifest with ID ${manifestID}`);
    // const tmpDir = await tmp.dir({ unsafeCleanup: true })
    const manifest = Object.entries((await axios.get(`https://gateway.bundlr.network/tx/${manifestID}/data`)).data.paths)
    console.log(`Validating all ${manifest.length} items`)
    const results = await PromisePool
        .for(manifest)
        .withConcurrency(concurrency)
        .process(async (entry: [string, any], i) => {
            if (i % 10 == 0) {
                console.log(`processed ${i} items`)
            }
            const itemPath = p.resolve(path, entry[0])
            const id = entry[1].id
            const fsData = await promises.readFile(itemPath)
            const req = await axios.get(`https://gateway.bundlr.network/tx/${id}/data`, { responseType: "arraybuffer" })
            const wData = Buffer.from(req.data, "binary")
            if (Buffer.compare(fsData, wData) != 0) {
                throw { id, path: itemPath }
            }
            return true;
        })
    console.log(`Processed ${results.results.length + results.errors.length} items\n ${results.results.length} OK\n ${results.errors.length} BAD`)

    if (results.errors.length > 0) {
        console.log("Errors detected")
        results.errors.forEach(e => {
            console.log(e.stack ?? e.message ?? JSON.stringify(e))
        })
    }

}


// // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
// async function* walk(dir: string) {
//     for await (const d of await promises.opendir(dir)) {
//         const entry = p.join(dir, d.name);
//         if (d.isDirectory()) yield* await walk(entry);
//         else if (d.isFile()) yield entry;
//     }
// }

export async function runFullTest() {
    // console.log("running full test")
    // // await promises.rm("./testFolder", { recursive: true, force: true })
    // await promises.rm("./testFolder-manifest.json", { force: true })
    // await promises.rm("./testFolder-manifest.csv", { force: true })
    // await promises.rm("./testFolder-id.txt", { force: true })
    // console.log("generating data")
    // await genData("./testFolder", 50_000, 1_000, 9_000)
    const keys = JSON.parse(readFileSync("wallet.json").toString());
    let bundlr = new ArweaveBundlr("https://devnet.bundlr.network", keys.arweave)
    const resu = await bundlr.uploader.uploadFolder("./testFolder", "0.json", 100, false, true, async (log): Promise<void> => { console.log(log) })
    console.log(resu)
    await checkManifest("./testFolder")
}

// runFullTest()