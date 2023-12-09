import { Application, Exit } from '@yowasp/runtime';
import { instantiate } from './gen/copy.js';


const yowaspRuntimeTest = new Application(import.meta.url, {
    'share': './gen/share.json'
}, {
    'copy.core.wasm': './gen/copy.core.wasm',
    'copy.core2.wasm': './gen/copy.core2.wasm',
    'copy.core3.wasm': './gen/copy.core3.wasm',
    'copy.core4.wasm': './gen/copy.core4.wasm',
}, instantiate, 'copy');


if ((await yowaspRuntimeTest.run(['share/foo.txt', 'bar.txt'], {}))['bar.txt'] !== 'contents of foo')
    throw 'test 1 failed';

if ((await yowaspRuntimeTest.run(['baz.txt', 'bar.txt'], {'baz.txt': 'contents of baz'}))['bar.txt'] !== 'contents of baz')
    throw 'test 2 failed';

let lines = [];
try {
    await yowaspRuntimeTest.run(['xxx.txt'], {'yyy.txt': 'contents of yyy'}, {
        printLine(line) { lines.push(line); }
    });
    throw 'test 3 failed (1)';
} catch (e) {
    if (!(e instanceof Exit))
        throw 'test 3 failed (2)';
    if (!(Object.hasOwn(e, 'files') && e.files['yyy.txt'] === 'contents of yyy'))
        throw 'test 3 failed (3)';
}
if (!(lines.length === 1 && lines[0] === "fopen:r: No such file or directory"))
    throw 'test 3 failed (4)';

let files4 = await yowaspRuntimeTest.run([], {'a.txt': 'ABC', 'b.txt': '\x01'});
if (files4['a.txt'] !== 'ABC')
    throw 'test 4 failed (1)';
if (!(files4['b.txt'] instanceof Uint8Array && files4['b.txt'].length === 1 && files4['b.txt'][0] === 1))
    throw 'test 4 failed (2)';

let files5 = await yowaspRuntimeTest.run([], {'a.txt': 'ABC', 'b.txt': '\x01'}, { decodeASCII: false });
if (!(files5['a.txt'] instanceof Uint8Array && files5['a.txt'].length === 3 &&
      files5['a.txt'][0] === 0x41 && files5['a.txt'][1] === 0x42 && files5['a.txt'][2] === 0x43))
    throw 'test 5 failed (1)';
if (!(files5['b.txt'] instanceof Uint8Array && files5['b.txt'].length === 1 && files5['b.txt'][0] === 1))
    throw 'test 5 failed (2)';