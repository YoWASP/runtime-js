import { Application } from '@yowasp/runtime';
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
