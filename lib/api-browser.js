import { setRandomBytesImpl } from './wasi-virt.js';

setRandomBytesImpl(function(length) {
    const QUOTA = 65536; // QuotaExceededError thrown when requesting more
    const bytes = new Uint8Array(length);
    for (var offset = 0; offset < length; offset += QUOTA)
      crypto.getRandomValues(bytes.slice(offset, offset + QUOTA));
    return bytes;
});

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
