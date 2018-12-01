import * as pngjs from 'pngjs';
const TGA = require('tga');

export function tga2png(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const tga = new TGA(buffer);
        var png = new pngjs.PNG({
            width: tga.width,
            height: tga.height
        });
        png.data = tga.pixels;
        const stream = png.pack();
        const bufs: Buffer[] = [];
        stream.on('data', d => bufs.push(d));
        stream.on('end', () => resolve(Buffer.concat(bufs)));
    });
}