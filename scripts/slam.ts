import Bundlr from "../src";
import { readFileSync } from "fs";
import { performance } from "perf_hooks"

//const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// this is a test script to see how many parallell upload operations a node can handle 
// DO NOT USE THIS ON A NODE YOU DO NOT OWN/OPERATE. EVER.
async function a() {
    const start = performance.now();
    let p = []
    const keys = JSON.parse(readFileSync("wallet.json").toString());
    const bundler = await Bundlr.init("http://devnet.bundlr.network", "arweave", keys.arweave)
    console.log(await bundler.getLoadedBalance());
    for (let i = 0; i < 4000; i++) {
        console.log(i)

        p.push(
            new Promise((r, _e) => {
                const now = performance.now()
                bundler.uploadFile("./a.txt").then(res => {
                    r({ "start": now, "end": performance.now(), ...res })
                })
            })
        )

    }
    const ress = await Promise.allSettled(p)
    const end = performance.now()
    const total = end - start
    console.log(`total time taken: ${total}`)
    const failed = ress.filter((v: any) => {
        return v.value.status !== 200
    })
    console.log(`${failed.length} requests failed!`);
    const steps = Math.ceil(end / 1000)
    let a = [];
    let b = [];

    for (let i = 0; i < (steps * 1000); i += 1000) {
        a.push(ress.filter((v: any) => {
            return (v.value.status == 200) && (v.value.end < (i + 1000)) && (v.value.end >= i)
        }))
        b.push(ress.filter((v: any) => {
            return (v.value.status == 200) && (v.value.start < (i + 1000)) && (v.value.start >= i)
        }))
        console.log(`${b[i / 1000].length} requests started in interval ${i} - ${i + 1000}`)
        console.log(`${a[i / 1000].length} requests finished in interval ${i} - ${i + 1000}`)
    }
    console.log(`tps: ${1000 / (total / ress.length)}`)
    console.log(await bundler.getLoadedBalance())
}
a();




