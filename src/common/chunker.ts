import internal, { Transform } from "stream";

export default class SizeChunker extends Transform {
    protected bytesPassed = 0
    protected currentChunk = -1
    protected lastEmittedChunk: number | undefined = undefined
    protected chunkSize;
    protected flushTail;

    constructor(options: internal.TransformOptions & { chunkSize: number, flushTail: boolean }) {
        super({ ...options, readableObjectMode: true });
        this.chunkSize = options.chunkSize ?? 10_000
        this.flushTail = options.flushTail ?? false
        this.readableObjectMode
        this.once("end", () => {
            if (this.flushTail && (this.lastEmittedChunk !== undefined) && this.bytesPassed > 0) {
                this.emit("chunkEnd", this.currentChunk, () => { return });
            }
        });

    }
    protected finishChunk(done: () => void): void {
        if (this.listenerCount("chunkEnd") > 0) {
            this.emit("chunkEnd", this.currentChunk, (): void => {
                this.bytesPassed = 0;
                this.lastEmittedChunk = undefined;
                done();
            });
        } else {
            this.bytesPassed = 0;
            this.lastEmittedChunk = undefined;
            done();
        }
    }

    protected startChunk(done: () => void): void {
        this.currentChunk++;
        if (this.listenerCount("chunkStart") > 0) {
            this.emit("chunkStart", this.currentChunk, done)
        } else {
            done();
        }
    }

    protected pushData(buf: Buffer): void {
        this.push({
            data: buf,
            id: this.currentChunk
        });

        this.bytesPassed += buf.length;
    };

    protected startIfNeededAndPushData(buf: Buffer): void {
        if (this.lastEmittedChunk != this.currentChunk) {
            this.startChunk((): void => {
                this.lastEmittedChunk = this.currentChunk;
                this.pushData(buf);
            })
        } else {
            this.pushData(buf);
        }
    }

    _transform(chunk: any, _encoding: BufferEncoding, done: internal.TransformCallback): void {
        const doTransform = (): void => {

            const bytesLeave = Math.min(chunk.length, this.chunkSize - this.bytesPassed)
            let remainder;

            if (this.bytesPassed + chunk.length < this.chunkSize) {
                this.startIfNeededAndPushData(chunk);
                done();
            } else {

                remainder = bytesLeave - chunk.length;

                if (remainder === 0) {
                    this.startIfNeededAndPushData(chunk);
                    this.finishChunk(done);
                } else {
                    this.startIfNeededAndPushData(chunk.slice(0, bytesLeave));
                    chunk = chunk.slice(bytesLeave);
                    this.finishChunk(doTransform);
                }
            }

        }

        doTransform();
    }
}
