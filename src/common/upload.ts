import { createData, DataItem } from "arbundles";
import { AxiosResponse } from "axios";
import Utils from "./utils"
import Api from "./api";
import { Currency, Manifest } from "./types";
import PromisePool from "@supercharge/promise-pool";
import retry from "async-retry";
import { Readable } from "stream";
import SizeChunker from "./chunker";
import Crypto from "crypto"
// import mime from "mime-types";

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// eslint-disable-next-line @typescript-eslint/naming-convention
export default class Uploader {
    protected readonly api: Api
    protected currency: string;
    protected currencyConfig: Currency;
    protected utils: Utils
    protected contentTypeOverride!: string
    protected forceUseChunking!: boolean

    constructor(api: Api, utils: Utils, currency: string, currencyConfig: Currency) {
        this.api = api;
        this.currency = currency;
        this.currencyConfig = currencyConfig;
        this.utils = utils;
    }


    /**
     * Uploads data to the bundler
     * @param data
     * @param tags
     * @returns the response from the bundler
     */
    public async upload(data: Buffer, tags?: { name: string, value: string }[]): Promise<AxiosResponse<any>> {

        const signer = await this.currencyConfig.getSigner();
        const dataItem = createData(
            data,
            signer,
            { tags }
        );
        await dataItem.sign(signer);
        return await this.transactionUploader(dataItem);
    }


    /**
     * Uploads a given transaction to the bundler
     * @param transaction
     */
    public async transactionUploader(transaction: DataItem): Promise<AxiosResponse<any>> {
        let res: AxiosResponse<any>
        const length = transaction.getRaw().byteLength
        if (this.forceUseChunking || length > 190_000_000) {
            res = await this.chunkedTransactionUploader(Readable.from(transaction.getRaw()), transaction.id, length)
        } else {
            const { protocol, host, port, timeout } = this.api.getConfig();
            res = await this.api.post(`${protocol}://${host}:${port}/tx/${this.currency}`, transaction.getRaw(), {
                headers: { "Content-Type": "application/octet-stream" },
                timeout,
                maxBodyLength: Infinity
            })
        }
        switch (res.status) {
            case 201:
                res.data = { id: transaction.id }
                return res;
            case 402:
                throw new Error("Not enough funds to send data")
            default:
                if (res.status >= 400) {
                    throw new Error(`whilst uploading DataItem: ${res.status} ${res.statusText}`)
                }
        }
        return res;
    }




    public async concurrentUploader(data: (DataItem | Buffer | string)[], concurrency = 5, resultProcessor?: (res: any) => Promise<any>, logFunction = async (_: any): Promise<any> => { return }): Promise<{ errors: Array<any>, results: Array<any> }> {
        const errors: any[] = []
        const results = await PromisePool
            .for(data)
            .withConcurrency(concurrency >= 1 ? concurrency : 5)
            .handleError(async (error, _) => {
                errors.push(error)
                if (error.message === "Not enough funds to send data") {
                    throw error;
                }
            })
            .process(async (item, i, _) => {
                await retry(
                    async (bail) => {
                        try {
                            const res = await this.processItem(item)
                            if (i % concurrency == 0) {
                                await logFunction(`Processed ${i} Items`)
                            }
                            if (resultProcessor) {
                                return await resultProcessor({ item, res, i })
                            } else {
                                return { item, res, i }
                            }
                        } catch (e: any) {
                            if (e.message === "Not enough funds to send data") {
                                bail(e)
                            }
                            throw e
                        }
                    },
                    { retries: 3, minTimeout: 1000, maxTimeout: 10_000 }
                );

            }) as any
        return { errors, results: results.results }
    }

    protected async processItem(item: string | Buffer | DataItem): Promise<any> {
        if (typeof item === "string") {
            item = Buffer.from(item)
        }
        if (Buffer.isBuffer(item)) {
            const signer = await this.currencyConfig.getSigner();
            item = createData(item, signer, { anchor: Crypto.randomBytes(32).toString("base64").slice(0, 32) })
            await item.sign(signer)
        }
        return await this.transactionUploader(item);
    }

    /**
     * geneates a manifest JSON object 
     * @param config.items mapping of logical paths to item IDs
     * @param config.indexFile optional logical path of the index file for the manifest 
     * @returns 
     */
    public async generateManifest(config: { items: Map<string, string>, indexFile?: string }): Promise<Manifest> {
        const { items, indexFile } = config
        const manifest = {
            manifest: "arweave/paths",
            version: "0.1.0",
            paths: {}
        }
        if (indexFile) {

            if (!items.has(indexFile)) {
                throw new Error(`Unable to access item: ${indexFile}`)
            }
            // manifest["index"] = { path: indexFile };
            Object.assign(manifest, { "index": { path: indexFile } })
        }
        items.forEach((v, _k) => {
            // manifest.paths[k] = { id: v }
            Object.assign(manifest.paths, { _k: { id: v } })
        })
        return manifest

    }



    /**
     * Chunking data uploader
     * @param dataStream - Readble of a pre-signed dataItem
     * @param id - the ID of the dataItem
     * @param size - the size of the dataItem
     * @param chunkSize - optional size to chunk the file - min 100_000, max 190_000_000 (in bytes)
     * @param batchSize - number of chunks to concurrently upload
     */
    public async chunkedTransactionUploader(dataStream: Readable, id: string, size: number, chunkSize = 25_000_000, batchSize = 5,): Promise<any> {

        if (chunkSize < 1_000_000 || chunkSize > 190_000_000) {
            throw new Error("Invalid chunk size - must be betweem 100,000 and 190,000,000 bytes")
        }
        if (batchSize < 1) {
            throw new Error("batch size too small! must be >=1")
        }

        const promiseFactory = (d: Buffer, o: number): Promise<Record<string, any>> => {
            return new Promise((r, e) => {
                retry(
                    async () => {
                        this.api.post(`/chunks/${this.currency}/${id}/${o}`, d, {
                            headers: { "Content-Type": "application/octet-stream" },
                            maxBodyLength: Infinity, // 
                            maxContentLength: Infinity,
                        }).then(re => r({ o, d: re })).catch(er => e({ o, e: er }))
                    }
                ),
                    { retries: 3, minTimeout: 1000, maxTimeout: 10_000 }
            })

        }


        const getres = await this.api.get(`/chunks/${this.currency}/${id}/${size}`)
        await Utils.checkAndThrow(getres, "Getting chunk info")
        const present = getres.data.map((v: string) => +v) as Array<number>

        const remainder = size % chunkSize;
        const chunks = (size - remainder) / chunkSize;

        const missing = [];
        for (let i = 0; i < chunks + 1; i++) {
            const s = i * chunkSize
            if (!present.includes(s)) {
                missing.push(s);
            }
        }
        // console.log(missing);

        let offset = 0;
        const processing = []

        const ckr = new SizeChunker({
            chunkSize: chunkSize,
            flushTail: true
        })

        dataStream.pipe(ckr)

        for await (const chunk of ckr) {
            const data = chunk.data

            if (chunk.id % batchSize == 0) {
                await Promise.allSettled(processing)
            }
            // console.log(`posting chunk ${chunk.id} - ${offset} (${offset + data.length})`)
            if (missing.includes(offset)) {
                processing.push(promiseFactory(data, offset))
            }
            offset += data.length
        }

        await Promise.allSettled(processing);
        const finishUpload = await this.api.post(`/chunks/${this.currency}/${id}/-1`, "", {
            headers: { "Content-Type": "application/octet-stream" },
            timeout: (this.api.config.timeout ?? 100_000) * 10 // server side reconstruction can take a while
        })
        if (finishUpload.status === 402) {
            throw new Error("Not enough funds to send data")
        }
        // this will throw if the dataItem reconstruction fails
        await Utils.checkAndThrow(finishUpload, "Finalising upload")
        return finishUpload
    }

    set useChunking(state: boolean) {
        if (typeof state === "boolean") {
            this.forceUseChunking = state
        }
    }

    set contentType(type: string) {
        // const fullType = mime.contentType(type)
        // if(!fullType){
        //     throw new Error("Invali")
        // }
        this.contentTypeOverride = type;
    }
}

