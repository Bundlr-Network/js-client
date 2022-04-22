import { readFileSync, promises, PathLike, createReadStream, createWriteStream } from "fs";
import { AxiosResponse } from "axios";
import { Currency } from "../common/types";
import Uploader from "../common/upload";
import Api from "../common/api";
import Utils from "../common/utils";
import * as p from "path"
import mime from "mime-types";
import { createData, DataItem } from "arbundles";
import inquirer from "inquirer";
import { Readable } from "stream";
import * as csv from "csv"
import { readFile } from "fs/promises";
import Crypto from "crypto"

export const checkPath = async (path: PathLike): Promise<boolean> => { return promises.stat(path).then(_ => true).catch(_ => false) }

export default class NodeUploader extends Uploader {

    constructor(api: Api, utils: Utils, currency: string, currencyConfig: Currency) {
        super(api, utils, currency, currencyConfig);
    }
    /**
     * Uploads a file to the bundler
     * @param path to the file to be uploaded
     * @returns the response from the bundler
     */
    public async uploadFile(path: string): Promise<AxiosResponse<any>> {
        if (!promises.stat(path).then(_ => true).catch(_ => false)) {
            throw new Error(`Unable to access path: ${path}`);
        }
        const mimeType = mime.contentType(mime.lookup(path) || "application/octet-stream")
        const tags = [{ name: "Content-Type", value: this.contentTypeOverride ?? mimeType }]
        // TODO: re-enable once arbundles' file API is ready
        // if (this.forceUseChunking || (await promises.stat(path)).size >= 25_000_000) {
        //     // make a tmp stream data item
        //     return await 
        // }
        const data = readFileSync(path);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return await this.upload(data, tags)
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    private async* walk(dir: string): any {
        for await (const d of await promises.opendir(dir)) {
            const entry = p.join(dir, d.name);
            if (d.isDirectory()) yield* await this.walk(entry);
            else if (d.isFile()) yield entry;
        }
    }

    /**
     * Preprocessor for folder uploads, ensures the rest of the system has a correct operating environment.
     * @param path - path to the folder to be uploaded
     * @param indexFile - path to the index file (i.e index.html)
     * @param batchSize - number of items to upload concurrently
     * @param interactivePreflight - whether to interactively prompt the user for confirmation of upload (CLI ONLY)
     * @param keepDeleted - Whether to keep previously uploaded (but now deleted) files in the manifest
     * @param logFunction - for handling logging from the uploader for UX
    * @returns 
     */
    // eslint-disable-next-line @typescript-eslint/ban-types
    public async uploadFolder(path: string, indexFile?: string, batchSize = 10, interactivePreflight?: boolean, keepDeleted = true, logFunction?: (log: string) => Promise<unknown>,): Promise<string> {
        path = p.resolve(path);
        const alreadyProcessed = new Map();

        if (! await checkPath(path)) {
            throw new Error(`Unable to access path: ${path}`);
        }

        // fallback to console.log if no logging function is given and interactive preflight is on.
        if (!logFunction && interactivePreflight) {
            logFunction = async (log): Promise<void> => { console.log(log) }
        } else if (!logFunction) { // blackhole logs
            logFunction = async (_: any): Promise<any> => { return }
        }

        // manifest with folder name placed in parent directory of said folder - keeps contamination down.
        const manifestPath = p.join(p.join(path, `${p.sep}..`), `${p.basename(path)}-manifest.csv`)
        const csvHeader = "path,id\n"
        if (await checkPath(manifestPath)) {
            const rstrm = createReadStream(manifestPath)
            // check if empty
            if ((await promises.stat(manifestPath)).size === 0) {
                await promises.writeFile(manifestPath, csvHeader)
            }
            // validate header
            await new Promise(res => {
                createReadStream(manifestPath).once("data", async (d) => {
                    const fl = d.toString().split("\n")[0]
                    if (`${fl}\n` !== csvHeader) {
                        await promises.writeFile(manifestPath, csvHeader)
                    }
                    res(d)
                })
            })
            const csvStream = Readable.from(rstrm
                .pipe(csv.parse({ delimiter: ",", columns: true })));

            for await (const record of csvStream) {
                record as { path: string, id: string }
                if (record.path && record.id) {
                    alreadyProcessed.set(record.path, null)
                }
            }
        } else {
            await promises.writeFile(manifestPath, csvHeader)
        }


        const files = []
        let total = 0;
        let i = 0
        for await (const f of this.walk(path)) {
            const relPath = p.relative(path, f)
            if (!alreadyProcessed.has(relPath)) {
                files.push(f)
                total += (await promises.stat(f)).size
            } else {
                alreadyProcessed.delete(relPath)
            }
            if (++i % batchSize == 0) {
                logFunction(`Checked ${i} files...`)
            }
        }

        if (!keepDeleted) {
            alreadyProcessed.clear()
        }

        // TODO: add logic to detect changes (MD5/other hash)
        if (files.length == 0 && alreadyProcessed.size === 0) {
            logFunction("No items to process")
            // return the txID of the upload
            const idpath = p.join(p.join(path, `${p.sep}..`), `${p.basename(path)}-id.txt`)
            if (await checkPath(idpath)) {
                return (await promises.readFile(idpath)).toString();
            }
            return "none";
        }

        const zprice = (await this.utils.getPrice(this.currency, 0)).multipliedBy(files.length);

        const price = (await this.utils.getPrice(this.currency, total)).plus(zprice).toFixed(0)


        if (interactivePreflight) {
            if (!(await confirmation(`Authorize upload?\nTotal amount of data: ${total} bytes over ${files.length} files - cost: ${price} ${this.currencyConfig.base[0]} (${this.utils.unitConverter(price).toFixed()} ${this.currency})\n Y / N`))) { throw new Error("Confirmation failed") }
        }


        const stringifier = csv.stringify({
            header: false,
            columns: {
                path: "path",
                id: "id"
            }
        })
        const wstrm = createWriteStream(manifestPath, { flags: "a+" })
        stringifier.pipe(wstrm)

        const processor = async (data: any): Promise<void> => {
            if (data?.res?.data?.id) {
                stringifier.write([p.relative(path, data.item), data.res.data.id])
            }
        }
        const processingResults = await this.concurrentUploader(files, batchSize, processor, logFunction)

        if (processingResults.errors.length > 0) {
            await logFunction(`${processingResults.errors.length} Errors detected, skipping manifest upload...`)
            const ewstrm = createWriteStream(p.join(p.join(path, `${p.sep}..`), `${p.basename(path)}-errors.txt`), { flags: "a+" })
            ewstrm.write(`Errors from upload at ${new Date().toString()}:\n`)
            processingResults.errors.forEach(e =>
                ewstrm.write(`${e?.stack ?? JSON.stringify(e)}\n`)
            )
            await new Promise(res => ewstrm.close(res))
            throw new Error(`${processingResults.errors.length} Errors detected - check ${p.basename(path)}-errors.txt for more information.`)
        }
        await logFunction(`Finished processing ${files.length} Items`)

        await new Promise(r => wstrm.close(r))
        // generate JSON
        await logFunction("Generating JSON manifest...")
        const jsonManifestPath = await this.generateManifestFromCsv(path, alreadyProcessed, indexFile)
        // upload the manifest
        await logFunction("Uploading JSON manifest...")
        const tags = [{ name: "Type", value: "manifest" }, { name: "Content-Type", value: "application/x.arweave-manifest+json" }]
        const mres = await this.upload(Buffer.from(readFileSync(jsonManifestPath)), tags).catch((e) => { throw new Error(`Failed to upload manifest: ${e.message}`) })
        await logFunction("Done!")
        if (mres?.data?.id) {
            await promises.writeFile(p.join(p.join(path, `${p.sep}..`), `${p.basename(path)}-id.txt`), mres.data.id)
        }
        return mres.data?.id ?? "none"
    }


    /**
     * processes an item to convert it into a DataItem, and then uploads it.
     * @param item can be a string value, a path to a file, a Buffer of data or a DataItem
     * @returns A dataItem
     */
    protected async processItem(item: string | Buffer | DataItem): Promise<any> {
        let tags;
        // let returnVal;
        if (typeof item === "string") {
            if (await checkPath(item)) {
                const mimeType = mime.contentType(mime.lookup(item) || "application/octet-stream")
                tags = [{ name: "Content-Type", value: this.contentTypeOverride ?? mimeType }]
                // returnVal = item;
                item = await readFile(item)

            } else {
                item = Buffer.from(item)
                if (this.contentTypeOverride) {
                    tags = [{ name: "Content-Type", value: this.contentTypeOverride }]
                }
            }
        }
        if (Buffer.isBuffer(item)) {
            const signer = await this.currencyConfig.getSigner();
            item = createData(item, signer, { tags, anchor: Crypto.randomBytes(32).toString("base64").slice(0, 32) })
            await item.sign(signer)
        }
        // if(returnVal){
        //     return {path: returnVal, }
        // }
        return await this.transactionUploader(item);
    }


    /**
     * Stream-based CSV parser and JSON assembler
     * @param path base path of the upload
     * @param indexFile optional path to an index file
     * @returns the path to the generated manifest
     */
    private async generateManifestFromCsv(path: string, nowRemoved?: Map<string, true>, indexFile?: string): Promise<string> {
        const csvstrm = csv.parse({ delimiter: ",", columns: true })
        const csvPath = p.join(p.join(path, `${p.sep}..`), `${p.basename(path)}-manifest.csv`)
        const manifestPath = p.join(p.join(path, `${p.sep}..`), `${p.basename(path)}-manifest.json`)
        const wstrm = createWriteStream(manifestPath, { flags: "w+" })
        createReadStream(csvPath).pipe(csvstrm) // pipe csv
        /* eslint-disable quotes */
        // "header"
        wstrm.write(`{\n"manifest": "arweave/paths",\n"version": "0.1.0",\n"paths": {\n`)
        const csvs = Readable.from(csvstrm)
        let firstValue = true;

        for await (const d of csvs) {
            if (nowRemoved?.has(d.path)) {
                nowRemoved.delete(d.path)
                continue;
            }
            const prefix = firstValue ? "" : ",\n"
            wstrm.write(`${prefix}"${d.path}":{"id":"${d.id}"}`)
            firstValue = false;
        }
        console.log("done with writing items")
        // "trailer"
        wstrm.write(`\n}`)
        // add index
        if (indexFile) {
            wstrm.write(`,\n"index":{"path":"${indexFile}"}`)
        }

        wstrm.write(`\n}`)
        await new Promise(r => wstrm.close(r))
        return manifestPath
    }

}

async function confirmation(message: string): Promise<boolean> {
    const answers = await inquirer.prompt([
        { type: "input", name: "confirmation", message }
    ]);
    return answers.confirmation.toLowerCase() == "y";
}
