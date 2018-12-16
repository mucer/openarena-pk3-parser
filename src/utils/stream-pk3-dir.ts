import { Stream } from "stream";
import { readdir, createReadStream } from "fs-extra";
import * as unzip from 'unzipper';
import { join } from "path";
import { Pk3StreamEntry } from "../types";

/**
 * @param dirs Directories containing PK3 files. The directories must be in the same order
 * @param ignoreDuplicates If a file is contained in multiple PK3 files, only the first is emitted.
 * 
 * events:
 *   files=string[]: Array of files which will be proccesed
 *   file=string: This file is processed now
 *   entry=Pk3StreamEntry: The processed entry
 *   close=void: all done
 *   error=any: something went wrong
 *   
 */
export function streamPk3Dirs(dirs: string[], ignoreDuplicates = true): Stream {
    const stream = new Stream();

    const paths: string[] = [];
    const entries: ZipEntry[] = [];
    getPk3Files(dirs).then(pk3Files => {
        stream.emit('files', pk3Files);
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
            const file = pk3Files[index++];
            if (file) {
                stream.emit('file', file);
                createReadStream(file)
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

async function getPk3Files(dirs: string[]): Promise<string[]> {
    const pk3Files: string[] = [];

    for (const dir of dirs) {
        const files = await readdir(dir);
        pk3Files.push(...files //
            .filter(f => f.endsWith('.pk3')) //
            .sort() //
            .reverse() //
            .map(f => join(dir, f)));

    }
    return pk3Files;
}

interface ZipEntry extends unzip.Entry {
    file: string;
}