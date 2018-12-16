import { join } from 'path';
import { Pk3StreamEntry } from '../types';
import { streamPk3Dirs } from './stream-pk3-dir';
import expect = require('expect');

const DIR1 = join(__dirname, '../../assets/dir1');
const DIR2 = join(__dirname, '../../assets/dir2');

describe('#streamPk3Dirs', () => {
    function testStreamPk3Dirs(
        done: (err?: any) => void,
        dirs: string[],
        ignoreDuplicates: boolean,
        expected: { files: string[], paths: string[] }
    ) {
        let files: string[] | undefined;
        const paths: string[] = [];

        const onClose = () => {
            try {
                expect(files).toEqual(expected.files);
                expect(paths).toEqual(expected.paths);
                done();
            } catch (e) {
                done(e);
            }
        };

        streamPk3Dirs(dirs, ignoreDuplicates)
            .on('files', f => files = f)
            .on('entry', (e: Pk3StreamEntry) => paths.push(e.path))
            .on('close', onClose)
            .on('error', done);
    }

    it('should handle empty array', done => {
        testStreamPk3Dirs(done, [], true, {
            files: [],
            paths: []
        });
    });

    it('should read single folder with single file', done => {
        testStreamPk3Dirs(done, [DIR2], true, {
            files: [
                join(DIR2, '01-maps.pk3')
            ],
            paths: [
                'maps/oa_ctf1.bsp'
            ]
        });
    });

    it('should read single folder with multiple files (ignoreDuplicates=true)', done => {
        testStreamPk3Dirs(done, [DIR1], true, {
            files: [
                join(DIR1, '02-maps.pk3'),
                join(DIR1, '01-maps.pk3')
            ],
            paths: [
                'maps/oa_ctf1.bsp',
                'maps/oa_ctf2.bsp',
                'levelshots/oa_ctf2.tga',
                'textures/clown/pipe.jpg',
                'textures/clown/red_banner.tga'
            ]
        });
    });

    it('should read single folder with multiple files (ignoreDuplicates=false)', done => {
        testStreamPk3Dirs(done, [DIR1], false, {
            files: [
                join(DIR1, '02-maps.pk3'),
                join(DIR1, '01-maps.pk3')
            ],
            paths: [
                'maps/oa_ctf1.bsp',
                'maps/oa_ctf2.bsp',
                'levelshots/oa_ctf2.tga',
                'maps/oa_ctf2.bsp',
                'textures/clown/pipe.jpg',
                'textures/clown/red_banner.tga'
            ]
        });
    });
});