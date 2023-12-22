import { readFile } from 'fs/promises';
import { BaseApplication } from './api-base.js';

export class Application extends BaseApplication {
    _fetchUint8Array(url) {
        return readFile(url);
    }

    _fetchWebAssembly(url) {
        return readFile(url).then(WebAssembly.compile);
    }
}

export { Exit } from './api-base.js';
