import * as fs from "fs"
import { PathLike } from "fs"
import Crypto from "crypto"

export const checkPath = async (path: PathLike): Promise<boolean> => { return fs.promises.stat(path).then(_ => true).catch(_ => false) }

function randomNumber(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function genData(path: string, number: number, minSize: number, maxSize: number) {
    if (!await checkPath(path)) {
        fs.mkdirSync(path);
    }
    for (let i = 0; i < number; i++) {
        const strm = await fs.createWriteStream(`${path}/${i}.json`);
        let bytes = randomNumber(minSize, maxSize);
        const chunkSize = 25_000_000
        while (bytes > 0) {
            let toWrite = chunkSize
            if (bytes >= chunkSize) {
                bytes -= chunkSize;
            } else {
                toWrite = bytes
                bytes = 0;
            }
            strm.write(Crypto.randomBytes(toWrite))
        }
        await new Promise(res => strm.close(res))
        if (i % 10 == 0) {
            console.log(`Generated ${i} items`);
        }
    }
    console.log("done")
}


// async function t1() {
//     await genData("./testFolder", 1_000, 1_000, 9_000)
// }

// t1();


