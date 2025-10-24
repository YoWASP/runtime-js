let fetch;
if (typeof process === 'object' && process.release?.name === 'node') {
    // Node doesn't have a usable `fetch()`.
    fetch = async function(url, options) {
        if (url.protocol === 'file:') {
            const { readFile } = await import('node:fs/promises');
            const data = await readFile(url);
            const isWasm = url.pathname.endsWith('.wasm');
            const headers = {
                'content-length': data.length,
                'content-type': (isWasm ? 'application/wasm' : 'application/octet-stream'),
            };
            return new Response(data, { headers });
        } else {
            return globalThis.fetch(url, options);
        }
    };
} else {
    fetch = globalThis.fetch;
}

export default fetch;
