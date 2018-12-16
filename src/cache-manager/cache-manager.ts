import * as fs from "fs-extra";
import { BspFile, parseBspFile, parseShaders, Shader } from "openarena-bsp-parser";
import { dirname, join } from "path";
import { Pk3StreamEntry, Image, Dictionary } from "../types";
import { streamPk3Dirs, tga2png } from "../utils";

function stripExt(path: string) {
    const pos = path.lastIndexOf('.');
    if (pos !== -1) {
        return path.substr(0, pos);
    }
    return path;
}

/**
 * This class reads the content of a PK3 directory and caches the content
 * 
 * TODO pass a "storage" implemtation into this class to realize an in memory storage
 */
export class CacheManager {
    public static readonly PATTERN_LEVELSHOT = /^levelshots\/(.*)\.(png|tga|jpg)$/;
    public static readonly PATTERN_TEXTURE = /^textures\/.*\.(png|tga|jpg)$/;
    public static readonly PATTERN_MAP = /^maps\/(.*)\.bsp$/;
    public static readonly PATTERN_SHADER = /^scripts\/.*\.shader$/;

    private initialized = false;

    private maps: Dictionary<string> = {};
    private levelshots: Dictionary<string> = {};
    private textures: Dictionary<string> = {};
    private shaders: Dictionary<Shader> = {};

    constructor(private cacheDir: string, private pk3Dirs: string[] = []) {
    }

    public addPk3Dir(dir: string) {
        this.pk3Dirs.push(dir);
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            streamPk3Dirs(this.pk3Dirs, true)
                .on('entry', entry => {
                    this.cacheEntry(entry)
                        .catch(err => reject(`Error in file '${entry.file}::${entry.path}': ${err}`));
                })
                .on('close', () => {
                    this.initialized = true;
                    fs.writeFile(join(this.cacheDir, 'shaders.json'), JSON.stringify(Object.values(this.shaders), undefined, 2))
                        .then(resolve, reject);
                })
                .on('error', reject);
        });
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    public getMapNames(): string[] {
        return Object.keys(this.maps).sort();
    }

    public async getMap(name: string): Promise<BspFile> {
        const path = this.maps[name];
        if (!path || !await fs.pathExists(path)) {
            throw new Error(`No map for name '${name}' found!`);
        }
        const buf = await fs.readFile(path, { encoding: 'utf8' });
        return JSON.parse(buf);
    }

    public getTextureNames(): string[] {
        return Object.keys(this.textures).sort();
    }

    public getTextureFile(path: string): string | undefined {
        return this.textures[stripExt(path)];
    }

    public getLevelshotNames(): string[] {
        return Object.keys(this.levelshots).sort();
    }

    public async getLevelshot(name: string): Promise<Image> {
        const path = this.levelshots[name];
        const data = this.getImageData(path);
        if (!path || !await fs.pathExists(data.fileName)) {
            throw new Error(`No levelshot for name '${name}' found!`);
        }
        const buf = await fs.readFile(path);
        return {
            ext: data.ext,
            data: buf
        } as Image;
    }

    public getLevelshotFile(name: string): string | undefined {
        return this.levelshots[name];
    }

    public getShader(name: string): Shader | undefined {
        return this.shaders[name];
    }

    public getShaders(): Shader[] {
        return Object.values(this.shaders);
    }

    private getMapData(mapPath: string): { name: string, fileName: string } {
        const matcher = CacheManager.PATTERN_MAP.exec(mapPath);
        if (!matcher) {
            throw new Error(`Invalid map path '${mapPath}' given!`);
        }
        const name = matcher[1];
        const fileName = join(this.cacheDir, `maps/${name}.json`);
        return { name, fileName };
    }

    private async cacheEntry(entry: Pk3StreamEntry): Promise<void> {
        let matcher: RegExpMatchArray | null;
        if (matcher = CacheManager.PATTERN_MAP.exec(entry.path)) {
            const name = matcher[1];
            entry.wait = true;
            const file = await this.cacheMap(entry.path, entry.buffer);
            this.maps[name] = file;
            entry.next();
        } else if (CacheManager.PATTERN_TEXTURE.test(entry.path)) {
            entry.wait = true;
            const file = await this.cacheImage(entry.path, entry.buffer);
            this.textures[stripExt(entry.path)] = file;
            entry.next();
        } else if (matcher = CacheManager.PATTERN_LEVELSHOT.exec(entry.path)) {
            const name = matcher[1];
            entry.wait = true;
            const file = await this.cacheImage(entry.path, entry.buffer);
            this.levelshots[name] = file;
            entry.next();
        } else if (CacheManager.PATTERN_SHADER.test(entry.path)) {
            const buf = await entry.buffer();
            const shaders = parseShaders(buf.toString('utf8'));
            shaders.forEach(s => {
                Object.assign(s, { file: entry.file, path: entry.path });
                this.shaders[s.name] = s;
            });
        }
    }

    private async cacheMap(path: string, bufferLoader: () => Promise<Buffer>): Promise<string> {
        const data = this.getMapData(path);
        if (!await fs.pathExists(data.fileName)) {
            await fs.mkdirp(dirname(data.fileName));
            let buffer = await bufferLoader();
            const map = parseBspFile(buffer);
            await fs.writeFile(data.fileName, JSON.stringify(map, undefined, 2), { encoding: 'utf8' });
        }
        return data.fileName;
    }

    private getImageData(imagePath: string): { ext: string, fileName: string, isTga: boolean } {
        let ext = imagePath.substr(imagePath.lastIndexOf('.') + 1);
        const isTga = ext === 'tga';
        ext = isTga ? 'png' : ext;
        const fileName = join(this.cacheDir, isTga ? imagePath.slice(0, -3) + 'png' : imagePath);

        return { ext, fileName, isTga };
    }

    private async cacheImage(path: string, bufferLoader: () => Promise<Buffer>): Promise<string> {
        const data = this.getImageData(path);
        if (!await fs.pathExists(data.fileName)) {
            await fs.mkdirp(dirname(data.fileName));
            let buffer = await bufferLoader();
            if (data.isTga) {
                buffer = await tga2png(buffer);
            }
            await fs.writeFile(data.fileName, buffer);
        }
        return data.fileName;
    }
}