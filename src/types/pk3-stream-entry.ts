export interface Pk3StreamEntry {
    file: string;
    path: string;
    // if this flag is set to true, the stream will wait util next() is called
    wait: boolean;
    buffer(): Promise<Buffer>;
    // unblock the stream
    next(): void;
}