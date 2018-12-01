import { Stream } from "stream";
import { readdir, createReadStream } from "fs-extra";
import * as unzip from 'unzipper';
import { join } from "path";

/**
 * 
 * events:
 *   files: array of files which will be proccesed
 *   file: this file is processed now
 *   close: all done
 *   error: something went wrong
 *   
 */
export function streamPk3Dir(dir: string, ignoreDuplicates = true): Stream {
    const stream = new Stream();

    const paths: string[] = [];
    const entries: ZipEntry[] = [];
    readdir(dir).then(files => {
        files = files.sort().reverse().filter(f => f.endsWith('.pk3'));
        stream.emit('files', files);
        let index = 0;
        let wait = false;
        const nextEntry = () => {
            const entry: ZipEntry | undefined = entries.shift();
            if (entry) {
                if (ignoreDuplicates && paths.includes(entry.path)) {
                    wait = false;
                    entry.autodrain();
                    nextEntry();
                } else {
                    wait = true;
                    if (ignoreDuplicates) {
                        paths.push(entry.path);
                    }

                    let calledBuffer = false;
                    const pk3Entry: Pk3StreamEntry = {
                        file: entry.file,
                        path: entry.path,
                        wait: false,
                        buffer: () => {
                            calledBuffer = true;
                            return entry.buffer();
                        },
                        next: () => {
                            if (!calledBuffer) {
                                entry.autodrain();
                            }
                            nextEntry();
                        }
                    };
                    stream.emit('entry', pk3Entry);
                    if (!pk3Entry.wait) {
                        if (!calledBuffer) {
                            entry.autodrain();
                        }
                        nextEntry();
                    }
                }
            } else {
                wait = false;
            }
        };
        const nextFile = () => {
            const file = files[index++];
            if (file) {
                stream.emit('file', file);
                createReadStream(join(dir, file))
                    .pipe(unzip.Parse())
                    .on('entry', (e: unzip.Entry) => {
                        if (e.type === 'File') {
                            entries.push(Object.assign(e, { file }));
                            if (!wait) {
                                nextEntry();
                            }
                        } else {
                            e.autodrain();
                        }
                    })
                    .on('close', () => nextFile())
                    .on('error', (err: any) => stream.emit(err));
            } else {
                stream.emit('close');
            }
        };
        nextFile();
    });
    return stream;
}

interface ZipEntry extends unzip.Entry {
    file: string;
}

export interface Pk3StreamEntry {
    file: string;
    path: string;
    // if this flag is set to true, the stream will wait util next() is called
    wait: boolean;
    buffer(): Promise<Buffer>;
    // unblock the stream
    next(): void;
}