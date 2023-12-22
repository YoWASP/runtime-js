import { BaseApplication } from './api-base.js';

export class Application extends BaseApplication {
    _fetchUint8Array(url) {
        return fetch(url).then((resp) => resp.arrayBuffer()).then((buf) => new Uint8Array(buf));
    }

    _fetchWebAssembly(url) {
        return fetch(url).then(WebAssembly.compileStreaming);
    }
}

export { Exit } from './api-base.js';
